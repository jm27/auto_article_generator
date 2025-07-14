import { useEffect, useState } from "react";
import axios from "axios";
import type { Tag } from "../components/TagSelection";
import { getCookie } from "../utils/helpers";

interface ProfileFormProps {
  allTags: Tag[];
}

export default function ProfileForm({ allTags }: ProfileFormProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    setAccessToken(getCookie("sb-access-token"));
  }, []);

  useEffect(() => {
    if (accessToken) {
      setLoading(true);
      // Fetch existing tags for the user from the API
      axios
        .get("/api/profile/get-tags", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .then((res) => {
          setSelectedTags(res.data.tagPreferences || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching user tags:", err);
          setLoading(false);
        });
    } else {
      console.error(
        "No accessToken found. User must be logged in to view profile."
      );
      setLoading(false);
    }
    return () => {
      setSelectedTags([]);
    };
  }, [accessToken]);

  const toggleTag = (tag: Tag) =>
    setSelectedTags((prev) =>
      prev.some((t) => JSON.parse(t).name === tag.name)
        ? prev.filter((t) => JSON.parse(t).name !== tag.name)
        : [...prev, JSON.stringify(tag)]
    );

  const saveTags = async () => {
    if (!accessToken) {
      console.error(
        "No access token found. User must be logged in to save tags."
      );
      return;
    }
    if (selectedTags.length < 2) {
      alert("Please select at least two tags before saving.");
      return;
    }
    try {
      const res = await axios.post(
        "/api/profile/update-tags",
        {
          tagPreferences: selectedTags,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (res.status === 200) {
        alert("User tags saved successfully!");
        console.log("User tags saved successfully:", selectedTags);
      } else {
        alert("Error saving user tags: " + res.data);
      }
    } catch (err: any) {
      console.error("Error saving user tags:", err);
      alert("Error saving user tags: " + (err.response?.data || err.message));
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
                {tag.display_name || tag.name}
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
