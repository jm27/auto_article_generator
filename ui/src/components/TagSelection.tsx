import { useEffect, useState } from "react";
import ProfileForm from "../components/ProfileForm";
import { getCookie } from "../utils/helpers";
import "../styles/global.css";

export type Tag = {
  id: number;
  name: string;
  display_name: string; // assuming this is the name field in your "tags" table
  // add other fields from your "tags" table if needed
};

export default function TagSelection({
  allTags,
  loading,
}: {
  allTags: Tag[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <span className="text-lg text-gray-700 dark:text-gray-200">
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-8 bg-white dark:bg-gray-900 flex flex-col justify-start items-center">
      <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 md:p-8">
        <ProfileForm allTags={allTags} />
      </div>
    </div>
  );
}
