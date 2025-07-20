import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase/supabaseClient";

export const POST: APIRoute = async ({ request }) => {
  const payload = await request.json();
  const { type, data } = payload;
  const { broadcast_id } = data;

  console.log(`[Resend Webhook] Received type: ${type}, data:`, data);
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
