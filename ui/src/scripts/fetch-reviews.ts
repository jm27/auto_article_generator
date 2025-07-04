import axios from "axios";

const TMDB_API_KEY = import.meta.env.TMDB_API_KEY;
const TMDB_API_URL = "https://api.themoviedb.org/3";

export async function fetchReviewsForMovie(movieId: number): Promise<any> {
  try {
    const response = await axios.get(
      `${TMDB_API_URL}/movie/${movieId}/reviews?api_key=${TMDB_API_KEY}&language=en-US&page=1`
    );
    const { results } = response.data;
    if (!results || results.length === 0) {
      console.warn(`No reviews found for movie ID: ${movieId}`);
      return [];
    }
    return (results as any[]).map((review) => ({
      author: review.author,
      rating: review.author_details.rating || null,
      content: review.content,
    }));
  } catch (error) {
    console.error(`Error fetching reviews for movie ID ${movieId}:`, error);
    return [];
  }
}
