import { useEffect, useState } from "react";
import axios from "axios";
import type { Tag } from "../components/TagSelection";
import { getCookie } from "../utils/helpers";
import { buildApiUrl } from "../utils/baseUrl";

interface ProfileFormProps {
  allTags: Tag[];
}

const GET_TAGS_API_URL = buildApiUrl("/api/profile/get-tags");
const UPDATE_TAGS_API_URL = buildApiUrl("/api/profile/update-tags");

export default function ProfileForm({ allTags }: ProfileFormProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  console.log("[ProfileForm] Component rendered");
  console.log("[ProfileForm] Props - allTags:", allTags);
  console.log("[ProfileForm] State - selectedTags:", selectedTags);
  console.log("[ProfileForm] State - loading:", loading);

  useEffect(() => {
    console.log("[ProfileForm] Access token effect triggered");

    // Fetch existing tags for the user from the API
    axios
      .get(GET_TAGS_API_URL, {
        withCredentials: true, // This sends HttpOnly cookies automatically
      })
      .then((res) => {
        console.log("[ProfileForm] GET tags response received:", res);
        console.log("[ProfileForm] Response status:", res.status);
        console.log("[ProfileForm] Response data:", res.data);
        console.log(
          "[ProfileForm] Tag preferences from API:",
          res.data.tagPreferences
        );

        setSelectedTags(res.data.tagPreferences || []);
        setLoading(false);
        console.log(
          "[ProfileForm] Tags loaded successfully, loading set to false"
        );
      })
      .catch((err) => {
        console.error("[ProfileForm] Error fetching user tags:", err);
        console.error("[ProfileForm] Error details:", {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
        });
        setLoading(false);
        console.log("[ProfileForm] Error occurred, loading set to false");
      });

    return () => {
      console.log("[ProfileForm] Cleanup - clearing selected tags");
      setSelectedTags([]);
    };
  }, []);

  const toggleTag = (tag: Tag) => {
    console.log("[ProfileForm] Toggle tag called for:", tag);
    console.log(
      "[ProfileForm] Current selected tags before toggle:",
      selectedTags
    );

    setSelectedTags((prev) => {
      const isSelected = prev.some((t) => JSON.parse(t).name === tag.name);
      console.log("[ProfileForm] Tag currently selected:", isSelected);

      let newTags;
      if (isSelected) {
        newTags = prev.filter((t) => JSON.parse(t).name !== tag.name);
        console.log("[ProfileForm] Removing tag from selection");
      } else {
        newTags = [...prev, JSON.stringify(tag)];
        console.log("[ProfileForm] Adding tag to selection");
      }

      console.log("[ProfileForm] New selected tags after toggle:", newTags);
      return newTags;
    });
  };

  const saveTags = async () => {
    console.log("[ProfileForm] Save tags function called");
    console.log("[ProfileForm] Current selected tags:", selectedTags);
    console.log("[ProfileForm] Selected tags count:", selectedTags.length);

    if (selectedTags.length < 2) {
      console.log(
        "[ProfileForm] Not enough tags selected (minimum 2 required)"
      );
      alert("Please select at least two tags before saving.");
      return;
    }

    try {
      console.log("[ProfileForm] Making POST request to save tags");
      console.log("[ProfileForm] POST URL:", UPDATE_TAGS_API_URL);
      console.log("[ProfileForm] Request payload:", {
        tagPreferences: selectedTags,
      });

      const res = await axios.post(
        UPDATE_TAGS_API_URL,
        {
          tagPreferences: selectedTags,
        },
        {
          withCredentials: true, // This sends HttpOnly cookies automatically
        }
      );

      console.log("[ProfileForm] Save tags response received:", res);
      console.log("[ProfileForm] Response status:", res.status);
      console.log("[ProfileForm] Response data:", res.data);

      if (res.status === 200) {
        console.log("[ProfileForm] Tags saved successfully!");
        alert("User tags saved successfully!");
        console.log(
          "[ProfileForm] User tags saved successfully:",
          selectedTags
        );
      } else {
        console.error("[ProfileForm] Unexpected response status:", res.status);
        alert("Error saving user tags: " + res.data);
      }
    } catch (err: any) {
      console.error("[ProfileForm] Error saving user tags:", err);
      console.error("[ProfileForm] Error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      alert("Error saving user tags: " + (err.response?.data || err.message));
    }
  };

  console.log("[ProfileForm] Rendering component with current state");

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
            {allTags.map((tag: Tag, index) => {
              const isSelected = selectedTags.some(
                (t) => JSON.parse(t).name === tag.name
              );
              return (
                <button
                  className="cursor-pointer rounded-lg"
                  key={index}
                  onClick={() => {
                    console.log("[ProfileForm] Tag button clicked:", tag.name);
                    toggleTag(tag);
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    background: isSelected ? "#333" : "#eee",
                    color: isSelected ? "#fff" : "#000",
                  }}
                >
                  {tag.display_name || tag.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button
        onClick={() => {
          console.log("[ProfileForm] Save button clicked");
          saveTags();
        }}
        className="cursor-pointer w-full p-2 sm:p-3 text-base font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
