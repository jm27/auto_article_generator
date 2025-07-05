import { useState } from "react";
import { supabase } from "../lib/supabase/supabaseClient";
import { validateSubscriber } from "../lib/supabase/helpers";

export default function SubscribeForm() {
  const [email, setEmail] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );

  const subscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await validateSubscriber(email.toLowerCase());
      setStatus("sent");
    } catch (error) {
      console.error("Subscription error:", error);
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={subscribe}
      className="flex flex-col gap-4 w-full max-w-full sm:max-w-md mx-auto p-3 sm:p-6 bg-white rounded-lg shadow border border-gray-200"
    >
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full p-2 sm:p-3 text-base rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full p-2 sm:p-3 text-base font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Subscribing..." : "Subscribe"}
      </button>
      {status === "sent" && (
        <p className="text-green-600 font-medium text-center">
          Subscribed! Thank you.
        </p>
      )}
      {status === "error" && (
        <p className="text-red-600 font-medium text-center">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
