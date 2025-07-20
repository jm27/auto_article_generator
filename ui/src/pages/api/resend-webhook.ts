import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase/supabaseClient";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
const TOLERANCE = 300; // 5 minutes in seconds

export const POST: APIRoute = async ({ request }) => {
  const payload = await request.json();
  const { type, data } = payload;
  const { broadcast_id } = data;

  console.log(`[Resend Webhook] Received type: ${type}, data:`, data);

  console.log(`[Resend Webhook] Headers: `, request.headers);

  // Validate the webhook secret
  const signature = request.headers.get("x-resend-signature");
  if (!signature || signature !== RESEND_WEBHOOK_SECRET) {
    console.error("[Resend Webhook] Invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }

  // Reject old payloads
  const timestamp = parseInt(
    request.headers.get("x-resend-timestamp") || "0",
    10
  );
  if (isNaN(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE) {
    console.error("[Resend Webhook] Payload is too old");
    return new Response("Payload is too old", { status: 400 });
  }

  // find log entry by broadcast_id
  const { data: logEntry, error: logError } = await supabase
    .from("newsletter_log")
    .select("*")
    .eq("broadcast_id", broadcast_id)
    .single();

  if (logError) {
    console.error("[Resend Webhook] Log entry lookup error:", logError);
    return new Response(logError.message, { status: 400 });
  } else if (!logEntry) {
    console.log(
      `[Resend Webhook] No log entry found for broadcast_id: ${broadcast_id}`
    );
    return new Response("Log entry not found", { status: 404 });
  }
  console.log(
    `[Resend Webhook] Found log entry for broadcast_id: ${broadcast_id}`,
    logEntry
  );
  await supabase.from("newsletter_events").insert({
    newsletter_log_id: logEntry.broadcast_id,
    event_type: type.replace("resend.", ""),
    created_at: new Date().toISOString(),
  });
  console.log(
    `[Resend Webhook] Inserted event for broadcast_id: ${broadcast_id}, type: ${type}`
  );
  return new Response("Webhook processed successfully", { status: 200 });
};
