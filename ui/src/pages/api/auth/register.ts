export const prerender = false;
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase/supabaseClient";

export const POST: APIRoute = async ({ request, redirect }) => {
    const form = await request.formData();
    const email = form.get("email")?.toString().trim();
    const password = form.get("password")?.toString().trim();;
    const userName = form.get("userName")?.toString().trim();;

    const optInSubscription = form.get('opt_in')?.toString() === 'true' ? true : false;

    if (!email || !password || !userName) {
        return new Response("Missing required fields", { status: 400 });
    }

    // Create user in Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { user_name: userName, opt_in_subscription: optInSubscription }
        }
    });

    if (signUpError) {
        console.error("Sign up error:", signUpError);
        return new Response(signUpError.message, { status: 400 });
    }

    // const userId = signUpData.user?.id;

    // // 2) Upsert into profiles

    // const { error: profileError } = await supabase
    //     .from("profiles")
    //     .upsert(
    //         {
    //             id: userId,
    //             email: email,
    //             user_name: userName,
    //             subscription_status: optInSubscription
    //         },
    //     { onConflict: "id" }
    // );
    
    // if (profileError) {
    //     console.error("Profile upsert error:", profileError);
    //     return new Response(profileError.message, { status: 400 });
    // }

    // 3) Upsert into subscriptions
    return redirect('/auth/signin');
} 