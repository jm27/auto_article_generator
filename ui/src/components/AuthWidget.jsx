import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/supabaseClient";
import { useSession } from "../lib/supabase/useSession";
import { validateUserProfile } from "../lib/supabase/validateUserProfile";

export default function AuthWidget() {
  const session = useSession();
  const userId = session?.user?.id;

  const signIn = async () => {
    await supabase.auth.signInWithOtp({ email: prompt("Enter your email") });
    alert("Check your email for the magic sign-in link!");
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
    //   .then((isValid) => {
    //     if (!isValid) {
    //       alert("Your profile is incomplete. Please update your profile.");
    //     }
    //   })
    //   .catch((error) => {
    //     console.error("Error validating user profile:", error);
    //   });
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
