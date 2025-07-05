import axios from "axios";
import { supabase } from "../lib/supabase/supabaseClient.ts";
import { getSampleMovies } from "./fetch-movies";
const VERCEL_SITE_URL = import.meta.env.PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
const SITE_URL = VERCEL_SITE_URL
  ? `https://${VERCEL_SITE_URL}`
  : import.meta.env.SITE_URL;

/**
 * Generates and saves movies to Supabase.
 * Summary of steps:
 * Fetch all movies and their IDs.
 * Query Supabase for posts with those IDs.
 * Build a set of existing IDs.
 * Filter out movies already in the DB.
 * Only call the summary API and upsert for new movies.
 **/

export async function generateAndSaveMovies() {
  const movies = await getSampleMovies();
  console.log("Fetched movies:", movies);
  const movieIds = movies.map((m) => m.id);
  console.log("Movie IDs to check in DB:", movieIds);

  // Query Supabase to check if movies already exist by IDs
  const { data: existingMovies, error: fetchError } = await supabase
    .from("posts")
    .select("id")
    .in("id", movieIds);

  if (fetchError) {
    console.error("Error fetching existing movies:", fetchError);
    return;
  }

  console.log("Existing movies in DB:", existingMovies);

  // Create a set of existing movie IDs for quick lookup
  const existingMovieIds = new Set((existingMovies || []).map((m) => m.id));
  console.log("Existing movie IDs:", existingMovieIds);

  // Filter out movies that already exist in Supabase
  const newMovies = movies.filter((movie) => !existingMovieIds.has(movie.id));
  console.log("New movies to process:", newMovies);

  if (newMovies.length === 0) {
    console.log("No new movies to save. All movies already exist in Supabase.");
    return;
  }

  if (!movies || movies.length === 0) {
    console.error("No movies found to save.");
    return;
  }

  for (const movie of newMovies) {
    console.log(`Processing movie: ${movie.title} (ID: ${movie.id})`);
    // Generate Summary
    const response = await axios.post(`${SITE_URL}/api/generate-content`, {
      title: movie.title,
      synopsis: movie.synopsis,
      reviews: movie.reviews,
    });
    console.log("Summary API response:", response.data);
    const summary = response.data.summary;
    if (!summary) {
      console.error(`No summary generated for movie: ${movie.title}`);
      continue;
    }
    // Save to Supabase
    const { error } = await supabase.from("posts").upsert(
      {
        id: movie.id,
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
