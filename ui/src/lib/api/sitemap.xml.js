// src/pages/sitemap.xml.js
import { supabase } from "../../../helpers/supabaseClient.js";

// Helper function to escape XML entities
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/:/g, "&#58;")
    .replace(/'/g, "&#39;");
}

export async function generateSitemap(req, res) {
  console.log("[sitemap.xml] Starting sitemap generation...");

  const { data: posts, error } = await supabase
    .from("posts")
    .select("slug, published_at, hil_published_at")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[sitemap.xml] Error fetching posts for sitemap:", error);
    return res.status(500).send("Error generating sitemap");
  } else {
    console.log(
      `[sitemap.xml] Successfully fetched ${posts?.length || 0} posts from database`
    );
  }

  // 🔗 Hardcoded static URLs with priority and changefreq
  const staticUrls = [
    {
      url: "https://www.mydailyf.com/",
      lastmod: "2025-07-07",
      changefreq: "daily",
      priority: "1.0",
    },
    {
      url: "https://www.mydailyf.com/privacy-policy/",
      lastmod: "2025-07-07",
      changefreq: "yearly",
      priority: "0.3",
    },
    {
      url: "https://www.mydailyf.com/terms-and-conditions/",
      lastmod: "2025-07-07",
      changefreq: "yearly",
      priority: "0.3",
    },
    {
      url: "https://www.mydailyf.com/thank-you/",
      lastmod: "2025-07-07",
      changefreq: "monthly",
      priority: "0.2",
    },
  ];

  console.log(`[sitemap.xml] Including ${staticUrls.length} static URLs`);

  // ✅ Build XML entries with proper escaping
  const staticUrlsXml = staticUrls.map(
    (item) => `<url>
    <loc>${item.url}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`
  );

  const postUrlsXml = (posts || []).map((post) => {
    const escapedSlug = escapeXml(post.slug);
    const formattedDate = new Date(post.published_at)
      .toISOString()
      .split("T")[0];
    const updatedDate = new Date(post.hil_published_at || post.published_at)
      .toISOString()
      .split("T")[0];

    // Calculate how fresh the post is to determine priority
    const daysSincePublished = Math.floor(
      (Date.now() - new Date(post.published_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Newer posts get higher priority (0.8 for < 7 days, 0.6 for < 30 days, 0.5 for older)
    const priority =
      daysSincePublished < 7 ? "0.8" : daysSincePublished < 30 ? "0.6" : "0.5";

    const postUrl = `<url>
    <loc>https://www.mydailyf.com/posts/${escapedSlug}</loc>
    <lastmod>${updatedDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`;
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
