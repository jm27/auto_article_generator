export const prerender = false;
import { setCorsHeaders } from "../../helpers/api-helpers.js";
import { handleRegister } from "../../src/lib/api/authRegister.js";
import { handleSignin } from "../../src/lib/api/authSignin.js";
import { handleSignout } from "../../src/lib/api/authSignout.js";
import { handleSubscribe } from "../../src/lib/api/authSubscribe.js";
import { handleUnsubscribe } from "../../src/lib/api/authUnsubscribe.js";

export default async function handler(req, res) {
  console.log("[Auth Router] Handler started");
  console.log("[Auth Router] Request details:", {
    method: req.method,
    url: req.url,
    headers: {
      host: req.headers.host,
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
    },
  });
  // Set CORS headers FIRST, before any other logic
  setCorsHeaders(req, res);
  console.log("[Auth Router] CORS headers set");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.replace("/api/auth/", "");

  console.log(`[Auth Router] Parsed URL details:`, {
    fullPath: url.pathname,
    action: action,
    searchParams: Object.fromEntries(url.searchParams),
  });
  console.log(`[Auth Router] Handling action: ${action}`);

  switch (action) {
    case "register":
      console.log("[Auth Router] Routing to handleRegister");
      return handleRegister(req, res);
    case "signin":
      console.log("[Auth Router] Routing to handleSignin");
      return handleSignin(req, res);
    case "signout":
      console.log("[Auth Router] Routing to handleSignout");
      return handleSignout(req, res);
    case "subscribe":
      console.log("[Auth Router] Routing to handleSubscribe");
      return handleSubscribe(req, res);
    case "unsubscribe":
      console.log("[Auth Router] Routing to handleUnsubscribe");
      return handleUnsubscribe(req, res);
    default:
      console.warn(`[Auth Router] Unknown action: ${action}`);
      console.log(
        "[Auth Router] Available actions: register, signin, signout, subscribe, unsubscribe"
      );
      return res.status(404).send("Not found");
  }
}
