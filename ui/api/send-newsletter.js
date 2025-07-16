import Handlebars from "handlebars";
import { supabase } from "./helpers/supabaseClient.js";
import mjml2html from "mjml";
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
import mjmlTemplate from "../src/templates/newsletter.mjml.js";

export default async function handler(req, res) {
  console.log("[Newsletter] Handler started");

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
    .select("title, content, slug, tags, images, published_at")
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
      postsToSend = posts.filter((post) =>
        post.tags.some(
          (tag) =>
            userTagNames.has(tag?.toLowerCase?.()) ||
            userTagNames.has(tag.display_name?.toLowerCase?.())
        )
      );
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
    const htmOutput = template({
      subject: "Your Personalized Newsletter",
      content: postsToSend.map((post) => ({
        title: post.title,
        summary: `${post.content.slice(0, 150)}... ` || "No summary available",
        slug: post.slug,
        poster: post.images?.[0] || "",
      })),
      link: `https://mydailyf.com`,
      summary,
    });
    const { html, errors: mjmlErrors } = mjml2html(htmOutput);
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
      await resend.emails.send({
        from: "My Daily Feed <noreply@mydailyf.com>",
        to: user.email,
        subject: "Your Personalized Newsletter",
        html: html,
      });
      sentCount++;
      console.log(`[Newsletter] Email sent to: ${user.email}`);
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
