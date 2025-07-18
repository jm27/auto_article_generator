import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase/supabaseClient";
import { v4 as uuidv4 } from "uuid";

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const email = form.get("email")?.toString().trim();
  const agreeToTerms = Boolean(form.get("agree_to_terms"));

  if (!email || !agreeToTerms) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Create user in Supabase Auth
  const { error: signUpError } = await supabase.from("subscribers").upsert({
    email,
    subscription_status: agreeToTerms,
    unsubscribe_token: uuidv4(),
  });

  if (signUpError) {
    console.error("Subscription error:", signUpError);
    return new Response(signUpError.message, { status: 400 });
  }
  return new Response(null, {
    status: 200,
    headers: {
      Location: "/thank-you",
      "Access-Control-Expose-Headers": "Location",
    },
  });
};
