import { supabase } from "./helpers/supabaseClient.js";
import { Webhook } from "svix";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // Get raw payload as string for signature verification
  const rawPayload = JSON.stringify(req.body);
  const payload = req.body;
  const { type, data } = payload;
  // For click events, use email_id as the broadcast identifier
  const broadcast_id = data?.email_id;

  console.log(`[Resend Webhook] Received type: ${type}, data:`, data);
  console.log(`[Resend Webhook] Headers: `, req.headers);

  // Verify webhook signature using Svix
  const headers = {
    "svix-id": req.headers["svix-id"],
    "svix-timestamp": req.headers["svix-timestamp"],
    "svix-signature": req.headers["svix-signature"],
  };

  try {
    const wh = new Webhook(RESEND_WEBHOOK_SECRET);
    wh.verify(rawPayload, headers);
    console.log("[Resend Webhook] Signature verified successfully");
  } catch (err) {
    console.error(
      "[Resend Webhook] Webhook signature verification failed:",
      err
    );
    return res.status(401).send("Webhook signature verification failed");
  }

  // find log entry by broadcast_id (email_id in this payload)
  const { data: logEntry, error: logError } = await supabase
    .from("newsletter_log")
    .select("*")
    .eq("broadcast_id", broadcast_id)
    .single();

  if (logError) {
    console.error("[Resend Webhook] Log entry lookup error:", logError);
    return res.status(400).send(logError.message);
  } else if (!logEntry) {
    console.log(
      `[Resend Webhook] No log entry found for broadcast_id: ${broadcast_id}`
    );
    return res.status(404).send("Log entry not found");
  }
  console.log(
    `[Resend Webhook] Found log entry for broadcast_id: ${broadcast_id}`,
    logEntry
  );
  // Store the full event data (e.g., click info) if present
  await supabase.from("newsletter_events").insert({
    newsletter_log_id: logEntry.id,
    event_type: type.replace("email.", ""),
    // event_data: data.click || data,
    created_at: new Date().toISOString(),
  });
  console.log(
    `[Resend Webhook] Inserted event for broadcast_id: ${broadcast_id}, type: ${type}`
  );
  return res.status(200).send("Webhook processed successfully");
}

export const config = {
  api: {
    bodyParser: true,
  },
};
