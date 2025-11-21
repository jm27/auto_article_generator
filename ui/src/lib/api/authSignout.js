import { supabase } from "../../../helpers/supabaseClient.js";

export async function handleSignout(req, res) {
  console.log("[authSignout] Handler started");
  console.log("[authSignout] Request method:", req.method);

  if (req.method !== "GET") {
    console.log("[authSignout] Invalid method, returning 405");
    return res.status(405).send("Method Not Allowed");
  }

  console.log("[authSignout] Signing out user...");
  // Sign out the user from Supabase
  await supabase.auth.signOut();
  console.log("[authSignout] User signed out successfully");

  console.log("[authSignout] Clearing authentication cookies...");
  // Clear the HttpOnly cookies by setting them to expire immediately
  res.setHeader("Set-Cookie", [
    "sb-access-token=; HttpOnly; Path=/; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "sb-refresh-token=; HttpOnly; Path=/; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ]);
  console.log("[authSignout] Cookies cleared successfully");

  // Return JSON response instead of redirect for CORS compatibility
  console.log("[authSignout] Sending success response");
  return res.status(200).json({
    success: true,
    message: "User signed out successfully",
    redirect: "/auth/signin",
  });
}
