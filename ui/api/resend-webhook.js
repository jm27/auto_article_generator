import { supabase } from "../lib/supabase/supabaseClient.js";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
const TOLERANCE = 300; // 5 minutes in seconds

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const payload = req.body;
  const { type, data } = payload;
  const { broadcast_id } = data || {};

  console.log(`[Resend Webhook] Received type: ${type}, data:`, data);
  console.log(`[Resend Webhook] Headers: `, req.headers);

  // Validate the webhook secret
  const signature = req.headers["x-resend-signature"];
  if (!signature || signature !== RESEND_WEBHOOK_SECRET) {
    console.error("[Resend Webhook] Invalid signature");
    return res.status(401).send("Invalid signature");
  }

  // Reject old payloads
  const timestamp = parseInt(req.headers["x-resend-timestamp"] || "0", 10);
  if (isNaN(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE) {
    console.error("[Resend Webhook] Payload is too old");
    return res.status(400).send("Payload is too old");
  }

  // find log entry by broadcast_id
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
  await supabase.from("newsletter_events").insert({
    newsletter_log_id: logEntry.id,
    event_type: type.replace("resend.", ""),
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
