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
export async function getUserNameFromToken(
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
