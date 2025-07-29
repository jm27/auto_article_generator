import { supabase } from "../../../helpers/supabaseClient.js";
import { v4 as uuidv4 } from "uuid";

export async function handleSubscribe(req, res) {
  console.log("[authSubscribe] Handler started");
  console.log("[authSubscribe] Request method:", req.method);
  console.log("[authSubscribe] Request body:", req.body);

  if (req.method !== "POST") {
    console.log("[authSubscribe] Invalid method, returning 405");
    return res.status(405).send("Method Not Allowed");
  }

  const { email, agree_to_terms } = req.body;

  console.log("[authSubscribe] Parsed data:", { email, agree_to_terms });

  if (!email || !agree_to_terms) {
    console.log("[authSubscribe] Missing required fields");
    return res.status(400).send("Missing required fields");
  }

  console.log("[authSubscribe] Creating subscription in Supabase...");
  // Create user in Supabase
  const { error: signUpError } = await supabase.from("subscribers").upsert({
    email: email.trim(),
    subscription_status: Boolean(agree_to_terms),
    unsubscribe_token: uuidv4(),
  });

  if (signUpError) {
    console.error("[authSubscribe] Subscription error:", signUpError);
    return res.status(400).send(signUpError.message);
  }

  console.log("[authSubscribe] Subscription successful, returning response");
  return res.status(200).json({
    success: true,
    redirect: "/thank-you",
  });
}
