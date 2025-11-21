import { supabase } from "../../../helpers/supabaseClient.js";

export async function handleRegister(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { email, password, userName, opt_in } = req.body;

  if (!email || !password || !userName) {
    return res.status(400).send("Missing required fields");
  }

  const optInSubscription = opt_in === "true" || opt_in === true;

  // Create user in Supabase Auth
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { user_name: userName, opt_in_subscription: optInSubscription },
    },
  });

  if (signUpError) {
    console.error("Sign up error:", signUpError);
    return res.status(400).send(signUpError.message);
  }

  return res.redirect(302, "/auth/signin");
}
