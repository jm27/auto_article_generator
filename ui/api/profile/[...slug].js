export const prerender = false;
import { handleGetTags } from "../../src/lib/api/getTags.js";
import { handleUpdateTags } from "../../src/lib/api/updateTags.js";
import { setCorsHeaders } from "../../helpers/api-helpers.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.replace("/api/profile/", "");

  setCorsHeaders(req, res);
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    console.log("[Profile Router] Handling OPTIONS preflight request");
    return res.status(200).end();
  }
  console.log(`[Profile Router] Handling action: ${action}`);

  switch (action) {
    case "get-tags":
      return handleGetTags(req, res);
    case "update-tags":
      return handleUpdateTags(req, res);
    default:
      console.warn(`[Profile Router] Unknown action: ${action}`);
      return res.status(404).send("Not found");
  }
}
