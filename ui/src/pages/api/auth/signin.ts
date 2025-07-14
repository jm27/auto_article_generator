export const prerender = false;
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase/supabaseClient";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const form = await request.formData();
    const email = form.get("email")?.toString().trim();
    const password = form.get("password")?.toString().trim();
    const useMagic = form.get("magic")?.toString() === 'true';

    if (!email || (!password && !useMagic)) {
        return new Response("Missing required fields", { status: 400 });
    }

    let authResult;
    if (useMagic) {
        // Sign in with magic link
        authResult = await supabase.auth.signInWithOtp({ email });
    } else {
        // At this point, both email and password are guaranteed to be non-empty strings
        authResult = await supabase.auth.signInWithPassword({ email: email as string, password: password as string });
    }

    const { data, error } = authResult;
    if (error) {
        console.error("Authentication error:", error);
        return new Response(error.message, { status: 401 });
    }
    
    const session = data.session
    if (!session) {
        return new Response("No session found", { status: 401 });
    }    

    // Set the session cookie
    if (session) {
        cookies.set("sb-access-token", session.access_token, { path: "/"});
        cookies.set("sb-refresh-token", session.refresh_token, { path: "/" });
    }

    const user = data.user;

    if (user) {
        await supabase
            .from("profiles")
            .upsert({
                id: user.id,
                email: user.email,
                user_name: user.user_metadata?.user_name || "",
                opt_in_subscription: user.user_metadata?.opt_in_subscription || false
            }, { onConflict: "id" });
    }

    // Redirect to the profile page or wherever you want
    return redirect('/profile');
}