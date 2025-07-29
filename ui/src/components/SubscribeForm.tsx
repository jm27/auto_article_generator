import axios from "axios";
import { useState } from "react";
import { buildApiUrl } from "../utils/baseUrl";

const SUBSCRIBE_URL = buildApiUrl("api/auth/subscribe");

export default function SubscribeForm() {
  const [email, setEmail] = useState<string>("");
  const [agreeToTerms, setAgreeToTerms] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );

  const subscribe = async (e: React.FormEvent) => {
    console.log("[SubscribeForm] Form submit event triggered");
    e.preventDefault();
    console.log("[SubscribeForm] Default prevented");
    console.log("[SubscribeForm] Subscribe form submitted");
    console.log("[SubscribeForm] Email:", email);
    console.log("[SubscribeForm] Agree to terms:", agreeToTerms);

    setStatus("loading");
    console.log("[SubscribeForm] Status set to loading");

    try {
      console.log("[SubscribeForm] Sending request to:", SUBSCRIBE_URL);
      // Send as JSON data - but don't stringify, axios will do it
      const response = await axios.post(
        SUBSCRIBE_URL,
        { email, agree_to_terms: agreeToTerms }, // Remove JSON.stringify
        {
          headers: {
            "Content-Type": "application/json",
          },
          validateStatus: () => true, // allow handling errors manually
          withCredentials: true, // Add this for CORS
        }
      );

      console.log("[SubscribeForm] Response received:", {
        status: response.status,
        data: response.data,
      });

      if (response.status === 200 && response.data.success) {
        console.log("[SubscribeForm] Subscription successful");
        if (response.data.redirect) {
          console.log(
            "[SubscribeForm] Redirecting to:",
            response.data.redirect
          );
          window.location.href = response.data.redirect;
        } else {
          console.log("[SubscribeForm] No redirect, setting status to sent");
          setStatus("sent");
        }
        return;
      }

      if (response.status !== 200) {
        console.error("[SubscribeForm] Non-200 status:", response.status);
        console.error("[SubscribeForm] Response data:", response.data);
        throw new Error("Subscription failed");
      }
    } catch (error) {
      console.error("[SubscribeForm] Subscription error:", error);
      if (axios.isAxiosError(error)) {
        console.error("[SubscribeForm] Axios error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
      }
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
