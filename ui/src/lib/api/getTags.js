import { supabase } from "../../../helpers/supabaseClient.js";
import { authenticateUser } from "../../../helpers/api-helpers.js";

export async function handleGetTags(req, res) {
  console.log("[getTags] Handler started");

  // Use the reusable authentication function
  const authResult = await authenticateUser(req, res, "[getTags]");

  if (!authResult.success) {
    return res.status(authResult.status).send(authResult.message);
  }

  const { user } = authResult;
  console.log(
    "[getTags] User authenticated successfully, fetching profile data"
  );
  console.log("[getTags] Querying profiles table for user ID:", user.id);

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("tag_preferences")
    .eq("id", user.id)
    .single();

  console.log("[getTags] Profile query completed");
  console.log("[getTags] Profile data:", profileData);
  console.log("[getTags] Profile error:", error);
  console.log(
    "[getTags] Tag preferences:",
    profileData?.tag_preferences || "null"
  );

  if (error) {
    console.error("[getTags] Error fetching profile data:", error);
    return res.status(500).send("Error fetching tags");
  }

  const responseData = {
    tagPreferences: profileData?.tag_preferences || [],
  };

  console.log("[getTags] Sending successful response");
  console.log("[getTags] Response data:", responseData);
  return res.status(200).json(responseData);
}
