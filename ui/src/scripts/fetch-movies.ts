import axios from "axios";
import { mapGenreIdsToName } from "../utils/movies";
import { fetchReviewsForMovie } from "./fetch-reviews";

const TMDB_API_KEY = import.meta.env.TMDB_API_KEY;
interface Movie {
  genre_ids: number[];
  id: number;
  title: string;
  overview: string;
}

interface MovieResult {
  id: number;
  title: string;
  synopsis: string;
  tags: string[];
  reviews: any[];
}
export async function getSampleMovies(): Promise<any[]> {
  try {
    console.log("API Key:", TMDB_API_KEY);
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`
    );
    const { results } = await response.data;

    const typedResults: Movie[] = results as Movie[];

    return await Promise.all(
      typedResults.slice(0, 5).map(async (m: Movie): Promise<MovieResult> => {
        return {
          id: m.id,
          title: m.title,
          synopsis: m.overview,
          tags: mapGenreIdsToName(m.genre_ids) || [],
          reviews: (await fetchReviewsForMovie(m.id)) || [],
        };
      })
    );
  } catch (error) {
    console.error("Error fetching movies:", error);
    throw new Error("Failed to fetch movies");
  }
}
