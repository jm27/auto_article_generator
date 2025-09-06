// src/pages/sitemap.xml.js
import { supabase } from "../../../helpers/supabaseClient.js";

// Helper function to escape XML entities
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function generateSitemap(req, res) {
  console.log("[sitemap.xml] Starting sitemap generation...");

  const { data: posts, error } = await supabase
    .from("posts")
    .select("slug, published_at")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[sitemap.xml] Error fetching posts for sitemap:", error);
    return res.status(500).send("Error generating sitemap");
  } else {
    console.log(
      `[sitemap.xml] Successfully fetched ${posts?.length || 0} posts from database`
    );
  }

  // 🔗 Hardcoded static URLs
  const staticUrls = [
    "https://www.mydailyf.com/",
    "https://www.mydailyf.com/privacy-policy/",
    "https://www.mydailyf.com/terms-and-conditions/",
    "https://www.mydailyf.com/thank-you/",
  ];

  console.log(`[sitemap.xml] Including ${staticUrls.length} static URLs`);

  // ✅ Build XML entries with proper escaping
  const staticUrlsXml = staticUrls.map(
    (url) => `<url><loc>${escapeXml(url)}</loc></url>`
  );

  const postUrlsXml = (posts || []).map((post) => {
    const escapedSlug = escapeXml(post.slug);
    const postUrl = `<url><loc>https://www.mydailyf.com/posts/${escapedSlug}</loc></url>`;
    console.log(`[sitemap.xml] Adding post URL: /posts/${post.slug}`);
    return postUrl;
  });

  const allUrls = [...staticUrlsXml, ...postUrlsXml];

  console.log(
    `[sitemap.xml] Generated ${staticUrls.length + (posts?.length || 0)} total URLs`
  );

  // ✅ Clean XML generation without extra whitespace
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${allUrls.join("\n")}
</urlset>`;

  console.log(
    `[sitemap.xml] Generated XML sitemap with ${xml.length} characters`
  );
  console.log("[sitemap.xml] Setting Content-Type header to application/xml");

  // ✅ Set headers before sending response
  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

  console.log("[sitemap.xml] Sitemap generation completed successfully");

  return res.status(200).send(xml);
}
