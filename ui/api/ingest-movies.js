import axios from "axios";
import { supabase } from "./helpers/supabaseClient.js";
// import { getMovies } from "./get-movies.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const VERCEL_SITE_URL = process.env.VERCEL_URL;
const SITE_URL = VERCEL_SITE_URL
  ? `https://${VERCEL_SITE_URL}`
  : process.env.SITE_URL;

/**
 * Generates and saves movies to Supabase.
 * Summary of steps:
 * Fetch all movies and their IDs.
 * Query Supabase for posts with those IDs.
 * Build a set of existing IDs.
 * Filter out movies already in the DB.
 * Only call the summary API and upsert for new movies.
 **/
async function getMovies() {
  try {
    const response = await axios.get(`${SITE_URL}/api/get-movies`);
    return response.data;
  } catch (error) {
    console.error("Error calling get-movies API:", error);
    return [];
  }
}

async function sendEmailNotification(subject, body) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
    subject: subject,
    html: `<p>${body}</p>`,
  });
}

export async function GET(request) {
  try {
    console.log("PROCESS ENV:", process.env);
    console.log("SITE URL:", SITE_URL);
    console.log("TMDB_API_KEY:", process.env.TMDB_API_KEY);

    const movies = await getMovies();
    console.log("Fetched movies:", movies);
    const movieIds = movies.map((m) => m.id);
    console.log("Movie IDs to check in DB:", movieIds);
    const newMoviesAdded = [
      {
        movieTitle: "",
        movieSummary: "",
        movieId: "",
      },
    ];
    // Query Supabase to check if movies already exist by IDs
    const { data: existingMovies, error: fetchError } = await supabase
      .from("posts")
      .select("id")
      .in("id", movieIds);

    if (fetchError) {
      console.error("Error fetching existing movies:", fetchError);
      return new Response(
        JSON.stringify({
          error: "Error fetching existing movies",
          details: fetchError,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Existing movies in DB:", existingMovies);

    // Create a set of existing movie IDs for quick lookup
    const existingMovieIds = new Set((existingMovies || []).map((m) => m.id));
    console.log("Existing movie IDs:", existingMovieIds);

    // Filter out movies that already exist in Supabase
    const newMovies = movies.filter((movie) => !existingMovieIds.has(movie.id));
    console.log("New movies to process:", newMovies);

    if (newMovies.length === 0) {
      // Send email notification if no new movies
      await sendEmailNotification(
        "Daily Movie Ingestion Report",
        "No new movies to save. All movies already exist in Supabase."
      );
      console.log(
        "No new movies to save. All movies already exist in Supabase."
      );
      return new Response(
        JSON.stringify({
          message:
            "No new movies to save. All movies already exist in Supabase.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!movies || movies.length === 0) {
      console.error("No movies found to save.");
      return new Response(
        JSON.stringify({ error: "No movies found to save." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    let saved = 0;
    let failed = 0;
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
        failed++;
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
          images: movie.images.map((img) => {
            return `https://image.tmdb.org/t/p/original${img}`;
          }),
        },
        { onConflict: ["id"] }
      );

      if (error) {
        console.error(`Error saving movie ${movie.title}:`, error);
        failed++;
      } else {
        console.log(`Movie ${movie.title} saved successfully.`);
        // Add to newMoviesAdded array for email notification
        console.log("Adding movie to newMoviesAdded:", movie.title);
        newMoviesAdded.push({
          movieTitle: movie.title,
          movieSummary: summary,
          movieId: movie.id,
        });
        saved++;
      }
    }
    // Send email notification after processing
    await sendEmailNotification(
      "Daily Movie Ingestion Report",
      `Movies processed. Saved: ${saved}, Failed: ${failed}, New Movies Added: ${newMoviesAdded
        .map(
          (movie) =>
            `<strong>${movie.movieTitle}</strong> (${movie.movieId}) - ${movie.movieSummary}`
        )
        .join("<br>")}`
    );

    return new Response(
      JSON.stringify({
        message: `Movies processed. Saved: ${saved}, Failed: ${failed}, New Movies Added: ${newMoviesAdded
          .map(
            (movie) =>
              `<strong>${movie.movieTitle}</strong> (${movie.movieId}) - ${movie.movieSummary}`
          )
          .join("<br>")}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in ingest-movies:", err);
    await sendEmailNotification(
      "Daily Movie Ingestion Report",
      `Unexpected error in ingest-movies: ${err.message}`
    );
    return new Response(
      JSON.stringify({
        error: "Unexpected error in ingest-movies",
        details: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
