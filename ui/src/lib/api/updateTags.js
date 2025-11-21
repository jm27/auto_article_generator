import { supabase } from "../../../helpers/supabaseClient.js";
import { authenticateUser } from "../../../helpers/api-helpers.js";

export async function handleUpdateTags(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  console.log("[updateTags] Handler started");

  const authResult = await authenticateUser(req, res, "[updateTags]");

  if (!authResult.success) {
    return res.status(authResult.status).send(authResult.message);
  }

  const { user } = authResult;
  if (!user.id) {
    return res.status(400).send("Missing userId");
  }

  const { tagPreferences } = req.body;
  if (!Array.isArray(tagPreferences)) {
    return res.status(400).send("Invalid request data");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ tag_preferences: tagPreferences })
    .eq("id", user.id);

  if (error) {
    return res.status(500).send("Error updating tags");
  }

  return res.status(200).send("Tags updated successfully");
}
