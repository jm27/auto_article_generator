import { supabase } from "../../helpers/supabaseClient.js";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { email, agree_to_terms } = req.body;

  if (!email || !agree_to_terms) {
    return res.status(400).send("Missing required fields");
  }

  // Create user in Supabase
  const { error: signUpError } = await supabase.from("subscribers").upsert({
    email: email.trim(),
    subscription_status: Boolean(agree_to_terms),
    unsubscribe_token: uuidv4(),
  });

  if (signUpError) {
    console.error("Subscription error:", signUpError);
    return res.status(400).send(signUpError.message);
  }

  return res.status(200).json({
    success: true,
    redirect: "/thank-you",
  });
}
