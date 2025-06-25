import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthWidget() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const session = supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session));

    // Listen for auth state change
    const { data: subsciption } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setSession(session);
      }
    );

    return () => {
      subsciption.unsubscribe();
    };
  }, []);

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

  return (
    <div className="auth-widget">
      <p>Welcome, {session.user.email}!</p>
      <button onClick={signOut} className="btn btn-secondary">
        Sign Out
      </button>
    </div>
  );
}
