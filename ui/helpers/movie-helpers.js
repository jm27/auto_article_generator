import axios from "axios";

// Genres by id from TMDB
// Source: https://developers.themoviedb.org/3/genres/get-movie-list
const GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];

function mapGenreIdsToName(genreIds) {
  return genreIds.map((id) => {
    const found = GENRES.find((genre) => genre.id === id);
    return found ? found.name : "Unknown";
  });
}

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_API_URL = "https://api.themoviedb.org/3";

async function fetchReviewsForMovie(movieId) {
  try {
    const response = await axios.get(
      `${TMDB_API_URL}/movie/${movieId}/reviews?api_key=${TMDB_API_KEY}&language=en-US&page=1`
    );
    const { results } = response.data;
    if (!results || results.length === 0) {
      console.warn(`No reviews found for movie ID: ${movieId}`);
      return [];
    }
    return results.map((review) => ({
      author: review.author,
      rating: (review.author_details && review.author_details.rating) || null,
      content: review.content,
    }));
  } catch (error) {
    console.error(`Error fetching reviews for movie ID ${movieId}:`, error);
    return [];
  }
}

export { mapGenreIdsToName, fetchReviewsForMovie };
