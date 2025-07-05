import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/supabaseClient";
import { useSession } from "../hooks/useSession";
import { validateUserProfile } from "../lib/supabase/helpers";

export default function AuthWidget() {
  const session = useSession();
  const userId = session?.user?.id;

  const signIn = async () => {
    const email = prompt("Enter your email");
    if (email) {
      await supabase.auth.signInWithOtp({ email });
      alert("Check your email for the magic sign-in link!");
    } else {
      alert("Email is required to sign in.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    alert("You have been signed out.");
  };

  if (!session) {
    console.log(session);
    return (
      <div className="auth-widget flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow border border-gray-200 w-full max-w-xs sm:max-w-sm mx-auto">
        <button
          onClick={signIn}
          className="w-full px-6 py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 transition text-base sm:text-lg"
        >
          Sign In / Subscribe
        </button>
      </div>
    );
  }

  if (userId) {
    // Validate user profile on session load
    validateUserProfile(session.user.id);
  }

  return (
    <div className="auth-widget flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow border border-gray-200 w-full max-w-xs sm:max-w-sm mx-auto">
      <p className="text-base sm:text-lg font-medium text-gray-800 text-center break-words">
        Welcome, {session.user.email}!
      </p>
      <button
        onClick={signOut}
        className="w-full px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded hover:bg-gray-300 transition text-base sm:text-lg"
      >
        Sign Out
      </button>
    </div>
  );
}
