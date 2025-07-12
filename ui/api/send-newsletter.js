import fs from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import { supabase } from "./helpers/supabaseClient.js";
import mjml2html from "mjml";
import { Resend } from "resend";
import { link } from "fs";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  console.log("[Newsletter] Handler started");
  const { data: users, error: usersError } = await supabase
    .from("subscribers")
    .select("email, tag_preferences")
    .eq("subscription_status", true);
  if (usersError) {
    console.error("[Newsletter] Error fetching users:", usersError);
    return res
      .status(500)
      .json({ error: "Failed to fetch users", details: usersError });
  }
  console.log(`[Newsletter] Fetched ${users?.length || 0} users`);
  console.log(
    `[Newsletter] Users tag preferences: ${users[0].tag_preferences.join(", ")}`
  );
  console.log(
    `[Newsletter] files in root: ${await fs.readdir(process.cwd())}`
  )

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("title, content, slug, tags, images")
    .gt("published_at", new Date(Date.now() - 7 * 86400000).toISOString());

  if (postsError) {
    console.error("[Newsletter] Error fetching posts:", postsError);
    return res
      .status(500)
      .json({ error: "Failed to fetch posts", details: postsError });
  }
  console.log(`[Newsletter] Fetched ${posts?.length || 0} posts`);

  if (!users || !posts) {
    console.error("[Newsletter] No users or posts found");
    return res.status(500).json({ error: "Failed to fetch users or posts" });
  }

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const mjmlTemplate = await fs.readFile(path.resolve("templates/newsletter.mjml"), "utf8");
  const template = Handlebars.compile(mjmlTemplate);

  for (const user of users) {
    console.log(`[Newsletter] Processing user: ${user.email}`);
    const personalizedPosts = posts.filter((post) =>
      post.tags.some((tag) => user.tag_preferences.includes(tag))
    );
    console.log(
      `[Newsletter] Matched ${personalizedPosts.length} personalized posts for user: ${user.email}`
    );
    if (!personalizedPosts.length) {
      console.log(`[Newsletter] No posts found for user: ${user.email}`);
      skippedCount++;
      continue;
    }
    const htmOutput = template({
      subject: "Your Personalized Newsletter",
      content: personalizedPosts.map((post) => ({
        title: post.title,
        summary: `${post.content.slice(0, 150)}... ` || "No summary available",
        slug: post.slug,
        poster: post.images?.[0] || "",
      })),
      link: `https://mydailyf.com`,
      summary: "Here are the latest posts tailored to your interests.",
    });
    const { html, errors: mjmlErrors } = mjml2html(htmOutput);
    if (mjmlErrors && mjmlErrors.length > 0) {
      console.error(
        `[Newsletter] MJML errors for user ${user.email}:`,
        mjmlErrors
      );
      failedCount++;
      continue;
    }
    try {
      await resend.emails.send({
        from: "My Daily Feed <noreply@mydailyf.com>",
        // from: process.env.EMAIL_FROM,
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
    totalUsers: users.length,
    totalPosts: posts.length,
  });
}
