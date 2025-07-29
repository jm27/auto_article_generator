import React, { useEffect, useState } from "react";
import axios from "axios";
import { buildApiUrl } from "../utils/baseUrl";

interface AuthWidgetProps {
  isTokenValid: boolean;
  userName?: string | null;
}

const SIGNOUT_URL = buildApiUrl("api/auth/signout");

export default function AuthWidget(props: AuthWidgetProps) {
  const [showProfileButton, setShowProfileButton] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowProfileButton(window.location.pathname !== "auth/profile");
    }
  }, []);

  const signIn = async () => {
    console.log("Signing in...");
    window.location.href = "/auth/signin";
  };

  const signOut = async () => {
    console.log("[AuthWidget] Signing out...");
    try {
      const response = await axios.get(SIGNOUT_URL);
      console.log("[AuthWidget] Sign out successful, redirecting to home");
      console.log("[AuthWidget] Response:", response);
      if (response.status === 200 && response.data.success) {
        if (response.data.redirect) {
          window.location.href = response.data.redirect;
        }
      }
    } catch (error) {
      console.error("[AuthWidget] Error signing out:", error);
    }
  };

  function register() {
    window.location.href = "/auth/register";
  }

  function viewProfile() {
    window.location.href = "/auth/profile";
  }

  if (!props.isTokenValid) {
    return (
      <div className="auth-widget flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow border border-gray-200 w-full max-w-xs sm:max-w-sm mx-auto">
        <button
          onClick={signIn}
          className="cursor-pointer w-full px-6 py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 transition text-base sm:text-lg"
        >
          Sign In
        </button>

        <button
          onClick={register}
          className="cursor-pointer w-full px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded hover:bg-gray-300 transition text-base sm:text-lg"
        >
          Register
        </button>
      </div>
    );
  }

  return (
    <div className="auth-widget flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow border border-gray-200 w-full max-w-xs sm:max-w-sm mx-auto">
      <p className="text-base sm:text-lg font-medium text-gray-800 text-center break-words">
        Welcome, {props.userName}!
      </p>
      {showProfileButton && (
        <button
          className="cursor-pointer w-full px-6 py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 transition text-base sm:text-lg"
          onClick={viewProfile}
        >
          View Profile
        </button>
      )}
      <button
        onClick={signOut}
        className="cursor-pointer w-full px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded hover:bg-gray-300 transition text-base sm:text-lg"
      >
        Sign Out
      </button>
    </div>
  );
}
