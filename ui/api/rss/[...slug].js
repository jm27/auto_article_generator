export const prerender = false;
import { generateRssFeed } from "../../src/lib/api/rss.xml.js";

export default async function handler(req, res) {
  console.log(`[RSS Router] Handling RSS feed request`);
  return generateRssFeed(req, res);
}
