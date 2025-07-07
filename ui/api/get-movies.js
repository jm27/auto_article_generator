import axios from "axios";
import {
  mapGenreIdsToName,
  fetchReviewsForMovie,
} from "./helpers/movie-helpers.js";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getSampleMovies() {
  console.log("TMDB_API_KEY:", TMDB_API_KEY);
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`
    );
    const { results } = response.data;
    return await Promise.all(
      results.slice(0, 10).map(async (m) => ({
        id: m.id,
        title: m.title,
        synopsis: m.overview,
        tags: mapGenreIdsToName(m.genre_ids) || [],
        reviews: (await fetchReviewsForMovie(m.id)) || [],
        images: [m.poster_path || "", m.backdrop_path || ""],
      }))
    );
  } catch (error) {
    console.error("Error fetching movies:", error);
    throw new Error("Failed to fetch movies");
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const movies = await getSampleMovies();
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch movies" });
  }
}
