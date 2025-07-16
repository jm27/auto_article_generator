import axios from "axios";
import { useState } from "react";

export default function SubscribeForm() {
  const [email, setEmail] = useState<string>("");
  const [agreeToTerms, setAgreeToTerms] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      // Send as form data so the API receives application/x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append("email", email);
      formData.append("agree_to_terms", agreeToTerms ? "true" : "");

      const response = await axios.post("/api/auth/subscribe", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        validateStatus: () => true, // allow handling 303 manually
      });

      if (response.status === 200 && response.headers.location) {
        window.location.href = response.headers.location;
        return;
      }

      if (response.status !== 200) {
        throw new Error("Subscription failed");
      }
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
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={agreeToTerms}
          onChange={(e) => setAgreeToTerms(e.target.checked)}
          required
          className="mr-2"
        />
        I agree to the terms and conditions...
      </label>
      <button
        type="submit"
        disabled={status === "loading"}
        className="cursor-pointer w-full p-2 sm:p-3 text-base font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
