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
      <div className="auth-widget">
        <button onClick={signIn} className="btn btn-primary">
          Sign In / Subscribe
        </button>
      </div>
    );
  }

  if (userId) {
    console.log("Session: ", session);
    // Validate user profile on session load
    validateUserProfile(session.user.id);
  }

  return (
    <div className="auth-widget">
      <p>Welcome, {session.user.email}!</p>
      <button onClick={signOut} className="btn btn-secondary">
        Sign Out
      </button>
    </div>
  );
}
