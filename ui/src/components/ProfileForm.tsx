import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/supabaseClient";
import { validateUserProfile } from "../lib/supabase/helpers";
import type { Session } from "@supabase/supabase-js";
import type { Tag } from "../components/TagSelection"; // Adjust the import path as necessary

interface ProfileFormProps {
  allTags: Tag[];
  session: Session; // Replace 'any' with the correct session type if available
}

export default function ProfileForm({ allTags, session }: ProfileFormProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState<Boolean>(true);

  useEffect(() => {
    if (session) {
      // Validate user profile on session load
      validateUserProfile(session.user.id);
      // Fetch existing tags for the user
      supabase
        .from("profiles")
        .select("tag_preferences")
        .eq("id", session.user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching user tags:", error);
          } else if (data && data.tag_preferences) {
            // Parse the tag_preferences if they are stored as JSON strings
            setSelectedTags(data.tag_preferences);
          }
          setLoading(false);
        });
    } else {
      console.error(
        "No session found. User must be logged in to view profile."
      );
      setLoading(false);
    }
    // Cleanup function to clear selected tags on unmount
    // This ensures that when the component is unmounted, the state is reset
    return () => {
      setSelectedTags([]); // Clear selected tags on unmount
    };
  }, [session]);

  const toggleTag = (tag: Tag) =>
    setSelectedTags((prev) =>
      prev.some((t) => JSON.parse(t).name === tag.name)
        ? prev.filter((t) => JSON.parse(t).name !== tag.name)
        : [...prev, JSON.stringify(tag)]
    );

  const saveTags = async () => {
    if (!session) {
      console.error("No session found. User must be logged in to save tags.");
      return;
    }
    if (selectedTags.length < 2) {
      alert("Please select at least two tags before saving.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: session.user.id, tag_preferences: selectedTags });

    if (error) {
      console.error("Error saving user tags:", error);
    } else {
      alert("User tags saved successfully!");
      console.log("User tags saved successfully:", selectedTags);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Your tag preferences</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Tags:</label>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span>Loading tags...</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag: Tag, index) => (
              <button
                className="cursor-pointer rounded-lg"
                key={index}
                onClick={() => toggleTag(tag)}
                style={{
                  padding: "0.5rem 1rem",
                  background: selectedTags.some(
                    (t) => JSON.parse(t).name === tag.name
                  )
                    ? "#333"
                    : "#eee",
                  color: selectedTags.some(
                    (t) => JSON.parse(t).name === tag.name
                  )
                    ? "#fff"
                    : "#000",
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={saveTags}
        className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        style={{ marginTop: "1rem" }}
        disabled={selectedTags.length < 2 || loading}
        title={
          selectedTags.length < 2
            ? "Please select at least two tags before saving."
            : undefined
        }
      >
        Save Tags
      </button>
      {selectedTags.length < 2 && !loading && (
        <p
          className="text-red-500 mt-2"
          style={{ marginTop: "1rem", color: "red" }}
        >
          Please select at least two tags before saving.
        </p>
      )}
    </div>
  );
}
