import axios from "axios";
import { supabase } from "../lib/supabase/supabaseClient.ts";
import { getSampleMovies } from "./fetch-movies";
const VERCEL_SITE_URL = import.meta.env.PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
const SITE_URL = VERCEL_SITE_URL
  ? `https://${VERCEL_SITE_URL}`
  : import.meta.env.SITE_URL;

export async function generateAndSaveMovies() {
  console.log("process.env: ", import.meta.env);
  console.log("SITE_URL: ", SITE_URL);
  console.log(
    "PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: ",
    import.meta.env.PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  );

  const movies = await getSampleMovies();

  if (!movies || movies.length === 0) {
    console.error("No movies found to save.");
    return;
  }

  for (const movie of movies) {
    // Generate Summary
    const response = await axios.post(`${SITE_URL}/api/generate-content`, {
      title: movie.title,
      synopsis: movie.synopsis,
      reviews: movie.reviews,
    });
    const summary = response.data.summary;
    if (!summary) {
      console.error(`No summary generated for movie: ${movie.title}`);
      continue;
    }
    // Save to Supabase
    const { error } = await supabase.from("posts").upsert(
      {
        id: movie.tmdb_id,
        title: movie.title,
        slug: movie.title.toLowerCase().replace(/\s+/g, "-"),
        content: summary,
        tags: [...(movie.tags || [])],
        published_at: new Date().toISOString(),
        reviews: [...(movie.reviews || [])],
      },
      { onConflict: ["id"] }
    );

    if (error) {
      console.error(`Error saving movie ${movie.title}:`, error);
    } else {
      console.log(`Movie ${movie.title} saved successfully.`);
    }
  }
}
