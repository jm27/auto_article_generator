export const prerender = false;
import { handleSendNewsletter } from "../../src/lib/api/sendNewsletter.js";
import { handleResendWebhook } from "../../src/lib/api/resendWebhook.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.replace("/api/newsletter/", "");

  console.log(`[Newsletter Router] Handling action: ${action}`);

  switch (action) {
    case "send-newsletter":
      return handleSendNewsletter(req, res);
    case "resend-webhook":
      return handleResendWebhook(req, res);
    default:
      console.warn(`[Newsletter Router] Unknown action: ${action}`);
      return res.status(404).send("Not found");
  }
}
