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

  // Unsubscribe function (optional)
  //   await supabase
  //   .from('subscribers')
  //   .update({ subscription_status: false })
  //   .eq('email', subscriberEmail);

  return (
    <form
      onSubmit={subscribe}
      style={{
        display: "flex",
        gap: "10px",
        flexDirection: "column",
        maxWidth: "400px",
        margin: "0 auto",
      }}
    >
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{ padding: "10px", fontSize: "16px" }}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        style={{
          padding: "10px",
          fontSize: "16px",
          backgroundColor: "#0070f3",
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
      >
        {status === "loading" ? "Subscribing..." : "Subscribe"}
      </button>
      {status === "sent" && (
        <p style={{ color: "green" }}>Subscribed! Thank you. </p>
      )}
      {status === "error" && (
        <p style={{ color: "red" }}>Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
