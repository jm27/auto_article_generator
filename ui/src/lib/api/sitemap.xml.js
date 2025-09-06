// src/pages/sitemap.xml.js
import { supabase } from "../../../helpers/supabaseClient.js";

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

  // ✅ Build XML entries
  const urls = [
    ...staticUrls.map((url) => `<url><loc>${url}</loc></url>`),
    ...(posts || []).map((post) => {
      const postUrl = `<url><loc>https://www.mydailyf.com/posts/${post.slug}</loc></url>`;
      console.log(`[sitemap.xml] Adding post URL: /posts/${post.slug}`);
      return postUrl;
    }),
  ].join("");

  console.log(
    `[sitemap.xml] Generated ${staticUrls.length + (posts?.length || 0)} total URLs`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
          xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
          xmlns:xhtml="http://www.w3.org/1999/xhtml"
          xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
          xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
    ${urls}
  </urlset>`;

  console.log(
    `[sitemap.xml] Generated XML sitemap with ${xml.length} characters`
  );
  console.log("[sitemap.xml] Sitemap generation completed successfully");

  return res.status(200).send(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
