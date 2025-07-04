import type { Session } from "@supabase/supabase-js";
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

/**
 * Fetches the current Supabase session (for use in Astro server scripts).
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error fetching session:", error);
    return null;
  }
  return data.session;
}

export async function validateSubscriber(email: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("subscribers")
      .upsert({ email, subscription_status: true }, { onConflict: ["email"] });
    if (error) {
      console.error("[validateSubscriber] Error upserting subscriber:", error);
      throw new Error("Failed to validate subscriber");
    }
  } catch (error) {
    console.error("[validateSubscriber] Error validating subscriber:", error);
    throw new Error("Failed to validate subscriber");
  }
}
