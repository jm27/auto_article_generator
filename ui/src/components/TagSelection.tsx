import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/supabaseClient";
import AuthWidget from "./AuthWidget";
import ProfileForm from "./ProfileForm";
import { useSession } from "../hooks/useSession";

export type Tag = {
  id: number;
  name: string;
  // add other fields from your "tags" table if needed
};

export default function TagSelection() {
  const session = useSession();
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch tags
    setLoading(true);
    supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data }) => {
        setAllTags(data || []);
        setLoading(false);
      });

    return () => {
      setAllTags([]); // Clear tags on unmount
    };
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <AuthWidget />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <ProfileForm session={session} allTags={allTags} />
    </div>
  );
}
