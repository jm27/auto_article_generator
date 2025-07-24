import { supabase } from "../../helpers/supabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { email, password, magic } = req.body;
  const useMagic = magic === "true" || magic === true;

  if (!email || (!password && !useMagic)) {
    return res.status(400).send("Missing required fields");
  }

  let authResult;
  if (useMagic) {
    // Sign in with magic link
    authResult = await supabase.auth.signInWithOtp({ email });
  } else {
    // Sign in with password
    authResult = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
  }

  const { data, error } = authResult;
  if (error) {
    console.error("Authentication error:", error);
    return res.status(401).send(error.message);
  }

  const session = data.session;
  if (!session) {
    return res.status(401).send("No session found");
  }

  const user = data.user;

  if (user) {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        user_name: user.user_metadata?.user_name || "",
        opt_in_subscription: user.user_metadata?.opt_in_subscription || false,
      },
      { onConflict: "id" }
    );
  }

  // Return session tokens for client-side storage
  return res.status(200).json({
    success: true,
    redirect: "/auth/profile",
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
    user: user,
  });
}
