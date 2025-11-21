// src/lib/api/rss.xml.js
import { supabase } from "../../../helpers/supabaseClient.js";

// Helper function to escape XML entities
function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Helper to strip HTML/Markdown and create description
function createDescription(content, maxLength = 200) {
  if (!content) return "";

  // Remove markdown symbols and HTML tags
  const plainText = content
    .replace(/[#*_\[\]]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();

  return plainText.length > maxLength
    ? plainText.slice(0, maxLength) + "..."
    : plainText;
}

export async function generateRssFeed(req, res) {
  console.log("[rss.xml] Starting RSS feed generation...");

  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      `
      slug,
      title,
      content,
      published_at,
      images,
      seo_description,
      hil_assignee,
      directus_users:hil_assignee (
        first_name,
        last_name
      )
    `
    )
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[rss.xml] Error fetching posts for RSS feed:", error);
    return res.status(500).send("Error generating RSS feed");
  }

  console.log(`[rss.xml] Successfully fetched ${posts?.length || 0} posts`);

  const siteUrl = "https://www.mydailyf.com";
  const currentDate = new Date().toUTCString();

  // Build RSS items
  const rssItems = (posts || [])
    .map((post) => {
      const postUrl = `${siteUrl}/posts/${escapeXml(post.slug)}`;
      const pubDate = new Date(post.published_at).toUTCString();
      const description =
        post.seo_description || createDescription(post.content);
      const imageUrl =
        post.images && post.images.length > 0 ? escapeXml(post.images[0]) : "";

      // Get author name
      const author =
        post.directus_users &&
        Array.isArray(post.directus_users) &&
        post.directus_users.length > 0
          ? post.directus_users[0]
          : null;
      const authorName = author
        ? `${author.first_name} ${author.last_name}`
        : "HIL Blog";

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <author>noreply@mydailyf.com (${escapeXml(authorName)})</author>
      ${imageUrl ? `<enclosure url="${imageUrl}" type="image/jpeg" />` : ""}
    </item>`;
    })
    .join("\n");

  // Generate RSS XML
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>My Daily Feed</title>
    <link>${siteUrl}</link>
    <description>Personalized news and updates about movies and more. Stay informed with engaging summaries and curated stories.</description>
    <language>en-us</language>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${siteUrl}/logo.png</url>
      <title>My Daily Feed</title>
      <link>${siteUrl}</link>
    </image>
${rssItems}
  </channel>
</rss>`;

  console.log(`[rss.xml] Generated RSS feed with ${posts?.length || 0} items`);

  // Set headers
  res.setHeader("Content-Type", "application/rss+xml; charset=UTF-8");
  res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

  console.log("[rss.xml] RSS feed generation completed successfully");

  return res.status(200).send(rssXml);
}
