export const prerender = false;
import { handleGenerateContent } from "../../src/lib/api/generateContent.js";
import { handleIngestMovies } from "../../src/lib/api/ingestMovies.js";
import { handleImageProxy } from "../../src/lib/api/imageProxy.js";
import { generateSitemap } from "../../src/lib/api/sitemap.xml.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.replace("/api/content/", "");

  console.log(`[Content Router] Handling action: ${action}`);

  switch (action) {
    case "generate":
      return handleGenerateContent(req, res);
    case "ingest-movies":
      return handleIngestMovies(req, res);
    case "image-proxy":
      return handleImageProxy(req, res);
    case "sitemap.xml":
      return generateSitemap(req, res);
    default:
      console.warn(`[Content Router] Unknown action: ${action}`);
      return res.status(404).send("Not found");
  }
}
