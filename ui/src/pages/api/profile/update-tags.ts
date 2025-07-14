import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase/supabaseClient";
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
        return new Response("Unauthorized", { status: 401 });
    }
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { data, error: getUserError } = await supabase.auth.getUser(token);
    const userId = data?.user?.id;
    if (!userId) {
        return new Response("Missing userId", { status: 400 });
    }

    const { tagPreferences } = await request.json();
    if (!Array.isArray(tagPreferences)) {
        return new Response("Invalid request data", { status: 400 });
    }

    const { error } = await supabase
        .from("profiles")
        .update({ tag_preferences: tagPreferences })
        .eq("id", userId);

    if (error) {
        return new Response("Error updating tags", { status: 500 });
    }

    return new Response("Tags updated successfully", { status: 200 });
};