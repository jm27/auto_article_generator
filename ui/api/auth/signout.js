import { supabase } from "../../helpers/supabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  // Sign out the user
  await supabase.auth.signOut();

  return res.status(200).json({
    success: true,
    redirect: "/auth/signin",
  });
}
