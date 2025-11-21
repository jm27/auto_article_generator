import { supabase } from "../helpers/supabaseClient.js";
export function setCorsHeaders(req, res) {
  const allowedOrigins = ["http://localhost:4321", "https://www.mydailyf.com"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export async function authenticateUser(req, res, logPrefix = "[Auth]") {
  console.log(`${logPrefix} Starting user authentication`);
  console.log(`${logPrefix} Request method:`, req.method);

  // Extract cookies from request
  const cookies = req.headers.cookie;
  console.log(`${logPrefix} Cookies:`, cookies ? "***PRESENT***" : "null");

  if (!cookies) {
    console.log(`${logPrefix} No cookies found, returning 401`);
    return {
      success: false,
      error: "No cookies found",
      status: 401,
      message: "Unauthorized - No cookies",
    };
  }

  // Extract access token from cookies
  const tokenMatch = cookies.match(/sb-access-token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  console.log(
    `${logPrefix} Token extracted:`,
    token ? "***TOKEN_EXTRACTED***" : "null"
  );
  console.log(`${logPrefix} Token length:`, token ? token.length : 0);

  if (!token) {
    console.log(`${logPrefix} No token found after extraction, returning 401`);
    return {
      success: false,
      error: "No access token found",
      status: 401,
      message: "Unauthorized - No access token",
    };
  }

  // Authenticate with Supabase
  console.log(`${logPrefix} Calling supabase.auth.getUser with token`);
  const { data, error: getUserError } = await supabase.auth.getUser(token);

  console.log(`${logPrefix} Supabase getUser response:`);
  console.log(
    `${logPrefix} User data:`,
    data ? "***USER_DATA_PRESENT***" : "null"
  );
  console.log(`${logPrefix} User ID:`, data?.user?.id || "null");
  console.log(`${logPrefix} User email:`, data?.user?.email || "null");
  console.log(`${logPrefix} GetUser error:`, getUserError);

  if (getUserError || !data?.user) {
    console.log(`${logPrefix} User authentication failed, returning 401`);
    console.log(`${logPrefix} Error details:`, getUserError);
    return {
      success: false,
      error: getUserError,
      status: 401,
      message: "Unauthorized - Invalid token",
    };
  }

  console.log(`${logPrefix} User authenticated successfully`);
  return {
    success: true,
    user: data.user,
    token: token,
  };
}
