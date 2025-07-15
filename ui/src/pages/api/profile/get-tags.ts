import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase/supabaseClient";
export const prerender = false;

export const GET: APIRoute = async ({ request, redirect }) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error: getUserError } = await supabase.auth.getUser(token);

  console.log("user data:", data);

  if (getUserError || !data?.user) {
    return redirect("/auth/signin");
  }

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("tag_preferences")
    .eq("id", data.user.id)
    .single();

  if (error) {
    return new Response("Error fetching tags", { status: 500 });
  }

  return new Response(
    JSON.stringify({ tagPreferences: profileData?.tag_preferences || [] }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
