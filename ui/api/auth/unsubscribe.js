import { supabase } from "../../helpers/supabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  console.log("[Unsubscribe] Handler called");

  const { email, unsubscribe_token } = req.query;

  console.log(
    `[Unsubscribe] Params - email: ${email}, unsubscribe_token: ${unsubscribe_token}`
  );

  if (!email) {
    console.log("[Unsubscribe] No email provided");
    return res.status(400).send("Email is required");
  }

  if (!unsubscribe_token) {
    console.log("[Unsubscribe] No unsubscribe token provided");
    return res.status(400).send("Unsubscribe token is required");
  }

  // Find the user in Supabase
  console.log(`[Unsubscribe] Looking up user in subscribers table`);
  const { data: user, error: userError } = await supabase
    .from("subscribers")
    .select("email")
    .eq("email", email)
    .eq("unsubscribe_token", unsubscribe_token)
    .single();

  if (userError) {
    console.error("[Unsubscribe] User lookup error:", userError);
    return res.status(400).send(userError.message);
  }

  if (!user) {
    console.log(
      `[Unsubscribe] No user found for email: ${email} and token: ${unsubscribe_token}`
    );
    return res.status(404).send("User not found");
  }

  // Unsubscribe the user
  console.log(`[Unsubscribe] Unsubscribing user with email: ${user.email}`);
  const { error: unsubscribeError } = await supabase
    .from("subscribers")
    .update({ subscription_status: false })
    .eq("email", email)
    .eq("unsubscribe_token", unsubscribe_token);

  if (unsubscribeError) {
    console.error("[Unsubscribe] Unsubscribe error:", unsubscribeError);
    return res.status(400).send(unsubscribeError.message);
  }

  console.log(`[Unsubscribe] Successfully unsubscribed user: ${email}`);

  // Redirect to unsubscribed page
  return res.redirect(302, "/goodbye");
}
