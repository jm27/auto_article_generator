/**
 * Get the base URL for the application
 * Returns local URL for development, production URL for deployed environment
 */
export function getBaseUrl() {
  console.log("[getBaseUrl] Starting base URL detection...");

  // Check if we're in a browser environment
  if (typeof window !== "undefined") {
    const url = window.location.origin;
    console.log("[getBaseUrl] Browser environment detected, using:", url);
    return url;
  }

  console.log("[getBaseUrl] Server-side environment detected");

  // Server-side logic
  // Check for explicit BASE_URL environment variable first
  if (process.env.BASE_URL) {
    console.log("[getBaseUrl] Using BASE_URL env var:", process.env.BASE_URL);
    return process.env.BASE_URL;
  }

  // Check if we're in development mode
  if (process.env.NODE_ENV === "development") {
    const devUrl = "http://localhost:4321";
    console.log("[getBaseUrl] Development mode detected, using:", devUrl);
    return devUrl;
  }

  // Default to production URL
  const prodUrl = "https://www.mydailyf.com";
  console.log("[getBaseUrl] Using production URL:", prodUrl);
  return prodUrl;
}

/**
 * Get API base URL - different from UI base URL in development
 * In development: API runs on localhost:3000, UI runs on localhost:4321
 * In production: Both use the same domain
 */
export function getApiBaseUrl() {
  console.log("[getApiBaseUrl] Starting API base URL detection...");

  // Check if we're in a browser environment
  if (typeof window !== "undefined") {
    console.log(
      "[getApiBaseUrl] Browser environment - hostname:",
      window.location.hostname,
      "port:",
      window.location.port
    );

    // In browser, check if we're in development
    if (
      window.location.hostname === "localhost" &&
      window.location.port === "4321"
    ) {
      const apiUrl = "http://localhost:3000";
      console.log(
        "[getApiBaseUrl] Development browser detected, using API server:",
        apiUrl
      );
      return apiUrl;
    }
    const url = window.location.origin;
    console.log("[getApiBaseUrl] Production browser detected, using:", url);
    return url;
  }

  console.log("[getApiBaseUrl] Server-side environment detected");
  console.log(
    "[getApiBaseUrl] Environment variables - API_BASE_URL:",
    process.env.API_BASE_URL,
    "NODE_ENV:",
    process.env.NODE_ENV
  );

  // Server-side logic
  // Check for explicit API_BASE_URL environment variable first
  if (process.env.API_BASE_URL) {
    console.log(
      "[getApiBaseUrl] Using API_BASE_URL env var:",
      process.env.API_BASE_URL
    );
    return process.env.API_BASE_URL;
  }

  // Check if we're in development mode - API server runs on port 3000
  if (process.env.NODE_ENV === "development") {
    const devApiUrl = "http://localhost:3000";
    console.log(
      "[getApiBaseUrl] Development mode detected, using API server:",
      devApiUrl
    );
    return devApiUrl;
  }

  // Default to production URL
  const prodUrl = "https://www.mydailyf.com";
  console.log("[getApiBaseUrl] Using production URL:", prodUrl);
  return prodUrl;
}

/**
 * Build a full API URL from a relative path
 */
export function buildApiUrl(path) {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = `${baseUrl}${cleanPath}`;
  console.log("[buildApiUrl] Built API URL:", fullUrl, "from path:", path);
  return fullUrl;
}

/**
 * Build a full UI URL from a relative path
 */
export function buildUiUrl(path) {
  const baseUrl = getBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = `${baseUrl}${cleanPath}`;
  console.log("[buildUiUrl] Built UI URL:", fullUrl, "from path:", path);
  return fullUrl;
}

/**
 * Check if we're in development environment
 */
export function isDevelopment() {
  if (typeof window !== "undefined") {
    const isDev = window.location.hostname === "localhost";
    console.log(
      "[isDevelopment] Browser check - hostname:",
      window.location.hostname,
      "isDev:",
      isDev
    );
    return isDev;
  }
  const isDev = process.env.NODE_ENV === "development";
  console.log(
    "[isDevelopment] Server check - NODE_ENV:",
    process.env.NODE_ENV,
    "isDev:",
    isDev
  );
  return isDev;
}

/**
 * Get the appropriate host for the current environment
 */
export function getHost() {
  if (typeof window !== "undefined") {
    const host = window.location.host;
    console.log("[getHost] Browser host:", host);
    return host;
  }

  const host = isDevelopment() ? "localhost:4321" : "www.mydailyf.com";
  console.log("[getHost] Server host:", host);
  return host;
}
