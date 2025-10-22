import Handlebars from "handlebars";
import { supabase } from "../../../helpers/supabaseClient.js";
import mjml2html from "mjml";
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
import mjmlTemplate from "../../templates/newsletter.mjml.js";
import { convert } from "html-to-text";
import { getBaseUrl, buildApiUrl } from "../../utils/baseUrl.js";

/**
 * Sends a personalized newsletter to users based on their preferences.
 * This function fetches user data, compiles the newsletter content,
 * and sends it via email using the Resend API.
 * JE
 */

export async function handleSendNewsletter(req, res) {
  console.log("[Newsletter] Handler started");

  // Verify authorization header
  const headers = req.headers;
  const authHeader = headers.authorization || headers["authorization"];
  const apiKeyHeader = headers.xApiKey || headers["x-api-key"];
  const apiKey = process.env.MY_DAILY_API_KEY || "";
  const cronSecret = process.env.CRON_SECRET || "";

  if (!cronSecret || !apiKey) {
    console.error(
      "CRON_SECRET or MY_DAILY_API_KEY is not set in environment variables"
    );
    return res.status(403).json({
      error: "Forbidden",
      message: "CRON_SECRET and MY_DAILY_API_KEY are required",
    });
  }

  if (authHeader !== `Bearer ${cronSecret}` || apiKeyHeader !== apiKey) {
    console.error("Invalid authorization");
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid authorization, missing credentials",
    });
  }

  console.log(
    "[Newsletter] Fetching users from profiles and subscribers tables"
  );
  // Fetch users from both tables
  const { data: profileUsers, error: profilesError } = await supabase
    .from("profiles")
    .select("email, tag_preferences")
    .eq("subscription_status", true);
  if (profilesError) {
    console.error("[Newsletter] Error fetching profiles:", profilesError);
    return res
      .status(500)
      .json({ error: "Failed to fetch profiles", details: profilesError });
  } else {
    console.log(
      `[Newsletter] Fetched ${profileUsers?.length || 0} profile users`
    );
  }

  const { data: subscriberUsers, error: subscribersError } = await supabase
    .from("subscribers")
    .select("email")
    .eq("subscription_status", true);
  if (subscribersError) {
    console.error("[Newsletter] Error fetching subscribers:", subscribersError);
    return res.status(500).json({
      error: "Failed to fetch subscribers",
      details: subscribersError,
    });
  } else {
    console.log(
      `[Newsletter] Fetched ${subscriberUsers?.length || 0} subscriber users`
    );
  }

  // Deduplicate users by email, profiles take precedence
  console.log(
    "[Newsletter] Deduplicating users by email (profiles take precedence)"
  );
  const userMap = new Map();
  for (const user of subscriberUsers || []) {
    if (user.email) {
      userMap.set(user.email.toLowerCase(), { ...user, isProfile: false });
      console.log(`[Newsletter] Added subscriber: ${user.email}`);
    }
  }
  for (const user of profileUsers || []) {
    if (user.email) {
      userMap.set(user.email.toLowerCase(), { ...user, isProfile: true });
      console.log(`[Newsletter] Added/overwrote profile: ${user.email}`);
    }
  }
  const allUsers = Array.from(userMap.values());
  console.log(`[Newsletter] Total deduplicated users: ${allUsers.length}`);

  // Fetch posts for both personalized and generic newsletters
  const now = Date.now();
  const fiveDaysAgo = new Date(now - 5 * 86400000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
  console.log(`[Newsletter] Date range for posts: ${fiveDaysAgo} to now`);

  console.log("[Newsletter] Fetching posts from posts table");
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id, title, content, slug, tags, images, published_at")
    .gt("published_at", sevenDaysAgo);

  if (postsError) {
    console.error("[Newsletter] Error fetching posts:", postsError);
    return res
      .status(500)
      .json({ error: "Failed to fetch posts", details: postsError });
  } else {
    console.log(`[Newsletter] Fetched ${posts?.length || 0} posts`);
  }

  if (!allUsers.length || !posts) {
    console.error("[Newsletter] No users or posts found");
    return res.status(500).json({ error: "Failed to fetch users or posts" });
  } else {
    console.log(
      `[Newsletter] Ready to process ${allUsers.length} users and ${posts.length} posts`
    );
  }

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const template = Handlebars.compile(mjmlTemplate);

  for (const user of allUsers) {
    console.log(`[Newsletter] Processing user: ${user.email}`);
    let postsToSend = [];
    let summary = "Here are the latest posts tailored to your interests.";
    if (
      user.isProfile &&
      user.tag_preferences &&
      user.tag_preferences.length > 0
    ) {
      console.log(
        `[Newsletter] User ${user.email} is a profile user with tag preferences. Filtering personalized posts.`
      );
      // Personalized: filter posts by tag_preferences
      const userTags = user.tag_preferences
        .map((t) => {
          try {
            return JSON.parse(t);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      const userTagNames = new Set(
        userTags.flatMap((tag) => [
          tag.name?.toLowerCase(),
          tag.display_name?.toLowerCase(),
        ])
      );
      postsToSend = posts
        .filter((post) =>
          post.tags.some(
            (tag) =>
              userTagNames.has(tag?.toLowerCase?.()) ||
              userTagNames.has(tag.display_name?.toLowerCase?.())
          )
        )
        .slice(0, 7); // Limit to 7 posts
      console.log(
        `[Newsletter] User ${user.email} matched ${postsToSend.length} personalized posts.`
      );
      summary = "Here are the latest posts tailored to your interests.";
    } else {
      // Generic: send the newest 7 posts from the last 5 days
      postsToSend = posts.slice(0, 7);
      console.log(
        `[Newsletter] User ${user.email} is a generic subscriber. Sending ${postsToSend.length} latest posts.`
      );
      summary = "Here are the latest posts from My Daily Feed.";
    }

    if (!postsToSend.length) {
      console.log(`[Newsletter] No posts found for user: ${user.email}`);
      skippedCount++;
      continue;
    } else {
      console.log(
        `[Newsletter] Preparing to send email to ${user.email} with ${postsToSend.length} posts.`
      );
    }
    const baseUrl = getBaseUrl();
    const htmOutput = template({
      subject: "Your Personalized Newsletter",
      content: postsToSend.map((post) => ({
        title: post.title,
        summary: `${post.content.slice(0, 150)}... ` || "No summary available",
        slug: post.slug,
        poster: buildApiUrl(
          `/api/content/image-proxy?imgUrl=${post.images?.[0] || ""}`
        ),
      })),
      link: baseUrl,
      isUserSubscriber: !user.isProfile,
      unsubscribeURL: user.isProfile
        ? null
        : buildApiUrl(
            `/api/auth/unsubscribe?email=${user.email}&unsubscribe_token=${user.unsubscribe_token}`
          ),
      summary,
    });
    const { html, errors: mjmlErrors } = mjml2html(htmOutput);
    const text = convert(html, {
      wordwrap: 80,
    });
    if (mjmlErrors && mjmlErrors.length > 0) {
      console.error(
        `[Newsletter] MJML errors for user ${user.email}:`,
        mjmlErrors
      );
      failedCount++;
      continue;
    } else {
      console.log(`[Newsletter] MJML rendered successfully for ${user.email}`);
    }
    try {
      const now = new Date();
      const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
      const subject = `Your Personalized Newsletter for ${formattedDate}`;
      const { data: respData } = await resend.emails.send({
        from: "My Daily Feed <my_daily_feed@mydailyf.com>",
        to: user.email,
        subject: subject,
        html: html,
        text: text, // include the plain‑text fallback
      });
      sentCount++;
      console.log(`[Newsletter] Email sent to: ${user.email}`);

      // capture in newsletter_log table
      const { error: logError } = await supabase.from("newsletter_log").insert({
        user_email: user.email,
        subject_line: subject,
        sent_date: new Date().toISOString(),
        recipient_count: sentCount,
        broadcast_id: respData?.id,
        content_ids: postsToSend.map((post) => post.id),
      });
      if (logError) {
        console.error(
          `[Newsletter] Failed to log email for ${user.email} broadcast ID: ${respData?.id}:`,
          logError
        );
      } else {
        console.log(
          `[Newsletter] Logged email for ${user.email} broadcast ID: ${respData?.id}`
        );
      }
    } catch (err) {
      failedCount++;
      console.error(`[Newsletter] Failed to send email to ${user.email}:`, err);
    }
  }
  console.log(
    `[Newsletter] Finished. Sent: ${sentCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`
  );
  return res.status(200).json({
    message: "Newsletter process complete",
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount,
    totalUsers: allUsers.length,
    totalPosts: posts.length,
  });
}
