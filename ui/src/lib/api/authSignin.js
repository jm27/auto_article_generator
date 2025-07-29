import { supabase } from "../../../helpers/supabaseClient.js";

export async function handleSignin(req, res) {
  console.log("[authSignin] Handler started");
  console.log("[authSignin] Request method:", req.method);

  if (req.method !== "POST") {
    console.log("[authSignin] Invalid method, returning 405");
    return res.status(405).send("Method Not Allowed");
  }

  console.log("[authSignin] Request body:", req.body);
  const { email, password, magic } = req.body;
  const useMagic = magic === "true" || magic === true;

  console.log(
    "[authSignin] Parsed values - email:",
    email,
    "useMagic:",
    useMagic,
    "hasPassword:",
    !!password
  );

  if (!email || (!password && !useMagic)) {
    console.log(
      "[authSignin] Missing required fields - email:",
      !!email,
      "password:",
      !!password,
      "useMagic:",
      useMagic
    );
    return res.status(400).send("Missing required fields");
  }

  console.log("[authSignin] Starting authentication process...");
  let authResult;
  if (useMagic) {
    console.log(
      "[authSignin] Using magic link authentication for email:",
      email
    );
    // Sign in with magic link
    authResult = await supabase.auth.signInWithOtp({ email });
  } else {
    console.log("[authSignin] Using password authentication for email:", email);
    // Sign in with password
    authResult = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
  }

  console.log("[authSignin] Authentication attempt completed");
  const { data, error } = authResult;

  if (error) {
    console.error("[authSignin] Authentication error:", error);
    console.error("[authSignin] Error details:", {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return res.status(401).send(error.message);
  }

  console.log("[authSignin] Authentication successful, checking session...");
  const session = data.session;
  if (!session) {
    console.error("[authSignin] No session found in response data");
    console.log("[authSignin] Data received:", data);
    return res.status(401).send("No session found");
  }

  console.log("[authSignin] Session found, extracting user data...");
  const user = data.user;
  console.log("[authSignin] User data:", {
    id: user?.id,
    email: user?.email,
    user_metadata: user?.user_metadata,
  });

  if (user) {
    console.log("[authSignin] Upserting user profile...");
    const profileData = {
      id: user.id,
      email: user.email,
      user_name: user.user_metadata?.user_name || "",
      opt_in_subscription: user.user_metadata?.opt_in_subscription || false,
    };
    console.log("[authSignin] Profile data to upsert:", profileData);

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) {
      console.error("[authSignin] Profile upsert error:", profileError);
    } else {
      console.log("[authSignin] Profile upserted successfully");
    }
  }

  console.log("[authSignin] Preparing response...");

  // Set session cookies for client-side access
  res.setHeader("Set-Cookie", [
    `sb-access-token=${session.access_token}; HttpOnly; Path=/; Max-Age=3600`,
    `sb-refresh-token=${session.refresh_token}; HttpOnly; Path=/; Max-Age=2592000`,
  ]);

  console.log("[authSignin] Session cookies set, redirecting to profile");

  // Server-side redirect
  return res.redirect(302, "/auth/profile");
}
