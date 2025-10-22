import axios from "axios";
import { supabase } from "../../../helpers/supabaseClient.js";
import { Resend } from "resend";
import { buildApiUrl } from "../../utils/baseUrl.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to create a URL-friendly slug
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

async function createAgentPostPerMovie() {
  const { data: movies, error } = await supabase
    .from("posts")
    .select("*")
    .eq("is_movie", true)
    .eq("processed", false);

  if (error) {
    console.error("Error fetching movies:", error);
    return;
  }

  try {
    for (const movie of movies) {
      try {
        // Create an agent post for each movie
        const agentResponse = await axios.post(
          buildApiUrl("/api/agents/research"),
          {
            topic: movie.title,
          },
          {
            headers: { "x-api-key": process?.env?.MY_DAILY_API_KEY || "" },
          }
        );

        console.log(
          `Created agent post for movie ${movie.title}:`,
          agentResponse.data
        );

        if (agentResponse.data.status !== "success") {
          console.error(
            `Error creating agent post for movie ${movie.title}:`,
            agentResponse.data
          );
          continue;
        }

        // Process each post from the agent response
        for (const post of agentResponse.data.posts) {
          const { error: upsertError } = await supabase.from("posts").upsert({
            title: post.title,
            slug: slugify(post.title),
            content: post.final,
            draft: post.draft,
            sources: post.sources,
            tags: [...(movie.tags || []), "generated"],
            published_at: new Date().toISOString(),
            images: movie.images,
            parent_id: movie.id,
            is_movie: false,
            processed: true,
            topic_ref: movie.title,
            seo_title: post.seo_title,
            seo_desc: post.seo_description,
          });

          if (upsertError) {
            console.error(`Error saving post for ${post.topic}:`, upsertError);
          } else {
            console.log(`Successfully saved post: ${post.topic}`);
          }
        }

        // Mark the movie as processed
        const { error: updateError } = await supabase
          .from("posts")
          .update({ processed: true })
          .eq("id", movie.id);

        if (updateError) {
          console.error(
            `Error updating movie ${movie.title} as processed:`,
            updateError
          );
        }
      } catch (movieError) {
        console.error(`Error processing movie ${movie.title}:`, movieError);
      }
    }
  } catch (err) {
    console.error(`Unexpected error in createAgentPostPerMovie:`, err);
  }
}

async function getMovies() {
  try {
    const response = await axios.get(buildApiUrl("/api/movies/get"), {
      headers: { "x-api-key": process?.env?.MY_DAILY_API_KEY || "" },
    });
    return response.data;
  } catch (error) {
    console.error("Error calling get-movies API:", error);
    return [];
  }
}

async function sendEmailNotification(subject, body) {
  try {
    await resend.emails.send({
      from: process?.env?.EMAIL_FROM || "",
      to: process?.env?.EMAIL_TO || "",
      subject: subject,
      html: `<p>${body}</p>`,
    });
  } catch (error) {
    console.error("Error sending email notification:", error);
  }
}

export async function handleIngestMovies(req, res) {
  try {
    const headers = req.headers;
    const authHeader = headers.authorization || headers["authorization"];
    const apiKeyHeader = headers.xApiKey || headers["x-api-key"];
    const apiKey = process.env.MY_DAILY_API_KEY || "";
    const cronSecret = process.env.CRON_SECRET || "";

    if (!cronSecret || !apiKey) {
      console.error(
        "CRON_SECRET or MY_DAILY_API_KEY is not set in environment variables"
      );
      return res.status(403).json({
        error: "Forbidden",
        message: "CRON_SECRET and MY_DAILY_API_KEY are required",
      });
    }

    if (authHeader !== `Bearer ${cronSecret}` || apiKeyHeader !== apiKey) {
      console.error("Invalid authorization");
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid authorization, missing credentials",
      });
    }

    const movies = await getMovies();
    console.log("Fetched movies:", movies);
    const movieIds = movies.map((m) => m.id);
    console.log("Movie IDs to check in DB:", movieIds);
    const newMoviesAdded = [];
    const failedMovies = [];

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

      try {
        // Generate Summary
        const response = await axios.post(
          buildApiUrl("/api/content/generate"),
          {
            title: movie.title,
            synopsis: movie.synopsis,
            reviews: movie.reviews,
          },
          {
            headers: { "x-api-key": process?.env?.MY_DAILY_API_KEY || "" },
          }
        );

        console.log("Summary API response:", response.data);
        const summary = response.data.summary;

        if (!summary) {
          console.error(`No summary generated for movie: ${movie.title}`);
          failedMovies.push({
            movieTitle: movie.title,
            movieId: movie.id,
            reason: "Summary generation returned empty response.",
          });
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
            is_movie: true,
            processed: false,
            topic_ref: movie.title,
          },
          { onConflict: ["id"] }
        );

        if (error) {
          console.error(`Error saving movie ${movie.title}:`, error);
          failedMovies.push({
            movieTitle: movie.title,
            movieId: movie.id,
            reason: error.message || "Supabase upsert failed.",
          });
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
      } catch (movieError) {
        console.error(`Error processing movie ${movie.title}:`, movieError);
        failedMovies.push({
          movieTitle: movie.title,
          movieId: movie.id,
          reason:
            movieError instanceof Error
              ? movieError.message
              : String(movieError),
        });
        failed++;
      }
    }

    // Send email notification after processing
    const newMoviesSection = newMoviesAdded.length
      ? newMoviesAdded
          .map(
            (movie) =>
              `<strong>${movie.movieTitle}</strong> (${movie.movieId}) - ${movie.movieSummary}`
          )
          .join("<br>")
      : "None";

    const failedMoviesSection = failedMovies.length
      ? failedMovies
          .map(
            (movie) =>
              `<strong>${movie.movieTitle}</strong> (${movie.movieId}) - ${movie.reason}`
          )
          .join("<br>")
      : "None";

    await sendEmailNotification(
      "Daily Movie Ingestion Report",
      `Movies processed. Saved: ${saved}, Failed: ${failed}<br><br><strong>New Movies Added:</strong><br>${newMoviesSection}<br><br><strong>Failed Movies:</strong><br>${failedMoviesSection}`
    );

    try {
      console.log("Creating agent posts for new movies...");
      // Call the function to create agent posts for each movie
      await createAgentPostPerMovie();
    } catch (err) {
      console.error("Error creating agent posts:", err);
      await sendEmailNotification(
        "Daily Movie Ingestion Report",
        `Error creating agent posts: ${err.message}`
      );
    }

    return res.status(200).json({
      message: `Movies processed. Saved: ${saved}, Failed: ${failed}`,
      newMoviesAdded: newMoviesAdded.length,
      details: newMoviesAdded,
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
