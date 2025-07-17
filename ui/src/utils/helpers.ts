/**
 * Fetches the latest 10 posts from the 'posts' table that match the given user_tags.
 * @param {Array<{name?: string, display_name?: string}>} userTags - Array of tag objects to match against post tags.
 * @param {any} supabaseClient - The Supabase client instance.
 * @returns {Promise<any[]>} - Array of matching post objects (max 10).
 */
export async function fetchLatestPostsByUserTags(
  userTags: Array<{ name?: string; display_name?: string }>,
  supabaseClient: any
): Promise<any[]> {
  if (!userTags || userTags.length === 0) {
    console.log("[fetchLatestPostsByUserTags] No user tags provided");
    return [];
  }
  // Build a set of lowercased tag names and display_names for matching
  const userTagNames = new Set(
    userTags.flatMap((tag) => [
      tag.name?.toLowerCase(),
      tag.display_name?.toLowerCase(),
    ])
  );
  console.log("[fetchLatestPostsByUserTags] User tag names:", userTagNames);
  try {
    console.log("[fetchLatestPostsByUserTags] Fetching posts from posts table");
    const { data: posts, error } = await supabaseClient
      .from("posts")
      .select("title, content, slug, tags, images, published_at")
      .order("published_at", { ascending: false })
      .limit(50); // fetch more to filter client-side
    if (error) {
      console.error("[fetchLatestPostsByUserTags] Supabase error:", error);
      return [];
    }
    if (!posts) {
      console.log("[fetchLatestPostsByUserTags] No posts found");
      return [];
    }
    // Filter posts by matching tags
    const matchingPosts = posts.filter(
      (post: any) =>
        Array.isArray(post.tags) &&
        post.tags.some(
          (tag: any) =>
            userTagNames.has(tag?.toLowerCase?.()) ||
            userTagNames.has(tag.display_name?.toLowerCase?.())
        )
    );
    console.log(
      `[fetchLatestPostsByUserTags] Found ${matchingPosts.length} matching posts`
    );
    return matchingPosts.slice(0, 10);
  } catch (err) {
    console.error("[fetchLatestPostsByUserTags] Exception:", err);
    return [];
  }
}

/**
 * Fetches user tags (tag_preferences) from the 'profiles' table for a given user email.
 * @param {string} email - The user's email address.
 * @returns {Promise<Array<{ name?: string; display_name?: string } | null>} - Array of tag_preferences (JSON strings) or null if not found.
 */
export async function fetchUserTagsByEmail(
  email: string,
  supabaseClient: any
): Promise<Array<{ name?: string; display_name?: string }> | null> {
  if (!email) {
    console.log("[fetchUserTagsByEmail] No email provided");
    return null;
  }
  try {
    console.log(
      `[fetchUserTagsByEmail] Querying for user with email: ${email}`
    );
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("tag_preferences")
      .eq("email", email)
      .single();
    if (error) {
      console.error(`[fetchUserTagsByEmail] Supabase error:`, error);
      return null;
    }
    if (!data) {
      console.log(`[fetchUserTagsByEmail] No data found for email: ${email}`);
      return null;
    }
    console.log(
      `[fetchUserTagsByEmail] Found tag_preferences for ${email}:`,
      data.tag_preferences
    );
    if (!Array.isArray(data.tag_preferences)) return null;
    // Parse each tag string as JSON
    const parsedTags = data.tag_preferences
      .map((t: string) => {
        try {
          return JSON.parse(t);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return parsedTags;
  } catch (err) {
    console.error(`[fetchUserTagsByEmail] Exception:`, err);
    return null;
  }
}

/**
 * Retrieves a cookie value by name.
 * @param {string} name - The name of the cookie to retrieve.
 * @returns {string | null} - The value of the cookie or null if not found.
 */
export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const result = parts.pop()?.split(";").shift();
    return result !== undefined ? result : null;
  }
  return null;
}

/**
 * Validates a Supabase access token.
 * @param {string | undefined | null} accessToken - The access token to validate.
 * @returns {Promise<boolean>} - Returns true if valid, false otherwise.
 */
export async function isAccessTokenValid(
  accessToken: string | undefined | null
): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const { supabase } = await import("../lib/supabase/supabaseClient");
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) return false;
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Extracts the userName (email) from a Supabase access token.
 * @param {string | undefined | null} accessToken - The access token to extract user info from.
 * @returns {Promise<string | null>} - Returns the user email if found, otherwise null.
 */
export async function getUserEmailFromToken(
  accessToken: string | undefined | null
): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const { supabase } = await import("../lib/supabase/supabaseClient");
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch (err) {
    return null;
  }
}
