export const prerender = false;
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase/supabaseClient";

export const GET: APIRoute = async ({ request, redirect }) => {
  console.log("[Unsubscribe] Handler called");
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const unsubscribeToken = url.searchParams.get("unsubscribe_token");
  console.log(
    `[Unsubscribe] Params - email: ${email}, unsubscribe_token: ${unsubscribeToken}`
  );
  if (!email) {
    console.log("[Unsubscribe] No email provided");
    return new Response("Email is required", { status: 400 });
  }
  if (!unsubscribeToken) {
    console.log("[Unsubscribe] No unsubscribe token provided");
    return new Response("Unsubscribe token is required", { status: 400 });
  }

  // Find the user in Supabase
  console.log(`[Unsubscribe] Looking up user in subscribers table`);
  const { data: user, error: userError } = await supabase
    .from("subscribers")
    .select("id")
    .eq("email", email)
    .eq("unsubscribe_token", unsubscribeToken)
    .single();

  if (userError) {
    console.error("[Unsubscribe] User lookup error:", userError);
    return new Response(userError.message, { status: 400 });
  }
  if (!user) {
    console.log(
      `[Unsubscribe] No user found for email: ${email} and token: ${unsubscribeToken}`
    );
    return new Response("User not found", { status: 404 });
  }

  // Unsubscribe the user
  console.log(`[Unsubscribe] Unsubscribing user with id: ${user.id}`);
  const { error: unsubscribeError } = await supabase
    .from("subscribers")
    .update({ subscription_status: false })
    .eq("id", user.id);

  if (unsubscribeError) {
    console.error("[Unsubscribe] Unsubscribe error:", unsubscribeError);
    return new Response(unsubscribeError.message, { status: 400 });
  }

  console.log(`[Unsubscribe] Successfully unsubscribed user: ${email}`);
  return redirect("/auth/unsubscribed");
  // return new Response("Successfully unsubscribed", { status: 200 });
};
