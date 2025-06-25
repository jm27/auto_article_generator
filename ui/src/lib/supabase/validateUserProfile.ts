import { supabase } from "./supabaseClient";

/**
 * Ensures a user profile exists in the `profiles` table for the given user ID.
 * If no profile exists, it creates one.
 *
 * @param userId - The authenticated user's Supabase UUID
 */

export async function validateUserProfile(userId: string): Promise<void> {
  try {
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (profile) {
      console.log(
        "[validateUserProfile] User profile already exists: ",
        profile
      );
      return; // Profile already exists, no action needed
    }
    // If fetchError is not related to profile not found, log and return
    // PGRST116 is the error code for "No rows found" in Supabase
    if (fetchError && fetchError?.code !== "PGRST116") {
      console.log("[validateUserProfile] Profile fetch error: ", fetchError);
      return;
    }

    // If no profile exists, create a new one
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: userId });

    if (insertError) {
      console.error(
        "[validateUserProfile] Error creating user profile: ",
        insertError
      );
      throw new Error("Failed to create user profile");
    }
  } catch (error) {
    console.error(
      "[validateUserProfile] Error validating user profile: ",
      error
    );
    throw new Error("Failed to validate user profile");
  }
}
