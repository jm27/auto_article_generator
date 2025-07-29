export const prerender = false;
import { handleGetMovies } from "../../src/lib/api/getMovies.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.replace("/api/movies/", "");

  console.log(`[Movies Router] Handling action: ${action}`);

  switch (action) {
    case "":
    case "get":
      return handleGetMovies(req, res);
    default:
      console.warn(`[Movies Router] Unknown action: ${action}`);
      return res.status(404).send("Not found");
  }
}
