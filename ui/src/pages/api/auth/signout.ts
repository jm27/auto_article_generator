export const prerender = false;
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase/supabaseClient";

export const GET: APIRoute = async ({ cookies, redirect } ) => {
    // Sign out the user
    await supabase.auth.signOut();
    // Clear the session cookies
    cookies.delete("sb-access-token", { path: "/" });
    cookies.delete("sb-refresh-token", { path: "/" });
    // Redirect to the home page or login page
    return redirect('/auth/signin');
}