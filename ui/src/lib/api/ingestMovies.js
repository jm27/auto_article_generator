import axios from "axios";
import { supabase } from "../../../helpers/supabaseClient.js";
import { Resend } from "resend";
import { buildApiUrl } from "../../utils/baseUrl.js";

const resend = new Resend(process.env.RESEND_API_KEY);

async function getMovies() {
  try {
    const response = await axios.get(buildApiUrl("/api/movies/get"));
    return response.data;
  } catch (error) {
    console.error("Error calling get-movies API:", error);
    return [];
  }
}

async function sendEmailNotification(subject, body) {
  await resend.emails.send({
    from: process?.env?.EMAIL_FROM || "",
    to: process?.env?.EMAIL_TO || "",
    subject: subject,
    html: `<p>${body}</p>`,
  });
}

export async function handleIngestMovies(req, res) {
  try {
    const movies = await getMovies();
    console.log("Fetched movies:", movies);
    const movieIds = movies.map((m) => m.id);
    console.log("Movie IDs to check in DB:", movieIds);
    const newMoviesAdded = [];

    // Query Supabase to check if movies already exist by IDs
    const { data: existingMovies, error: fetchError } = await supabase
      .from("posts")
      .select("id")
      .in("id", movieIds);

    if (fetchError) {
      console.error("Error fetching existing movies:", fetchError);
      return res.status(500).json({
        error: "Error fetching existing movies",
        details: fetchError,
      });
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
      return res.status(200).json({
        message: "No new movies to save. All movies already exist in Supabase.",
      });
    }

    if (!movies || movies.length === 0) {
      console.error("No movies found to save.");
      return res.status(404).json({ error: "No movies found to save." });
    }

    let saved = 0;
    let failed = 0;
    for (const movie of newMovies) {
      console.log(`Processing movie: ${movie.title} (ID: ${movie.id})`);
      // Generate Summary
      const response = await axios.post(buildApiUrl("/api/content/generate"), {
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
          images: movie.images.map(
            (img) => `https://image.tmdb.org/t/p/original${img}`
          ),
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

    return res.status(200).json({
      message: `Movies processed. Saved: ${saved}, Failed: ${failed}, New Movies Added: ${newMoviesAdded
        .map(
          (movie) =>
            `<strong>${movie.movieTitle}</strong> (${movie.movieId}) - ${movie.movieSummary}`
        )
        .join("<br>")}`,
    });
  } catch (err) {
    console.error("Unexpected error in ingest-movies:", err);
    await sendEmailNotification(
      "Daily Movie Ingestion Report",
      `Unexpected error in ingest-movies: ${err.message}`
    );
    return res.status(500).json({
      error: "Unexpected error in ingest-movies",
      details: err.message,
    });
  }
}
