# Development Environment Setup

## Base URL Configuration

This project uses different URLs for different environments:

### Development (Local)

- **UI Server (Astro)**: `http://localhost:4321` - Run with `npm run dev`
- **API Server (Vercel)**: `http://localhost:3000` - Run with `vercel dev`

### Production

- **Both UI and API**: `https://www.mydailyf.com`

````

## Starting Development Servers

1. **Start the API server** (Terminal 1):

   ```bash
   vercel dev
````

This starts the API routes on `http://localhost:3000`

2. **Start the UI server** (Terminal 2):
   ```bash
   cd ui
   npm run dev
   ```
   This starts the Astro app on `http://localhost:4321`

## How Base URL Detection Works

The `src/utils/baseUrl.js` utility automatically detects the correct URLs:

- **Client-side**: Uses `window.location.origin`, but redirects API calls to `localhost:3000` when on `localhost:4321`
- **Server-side**:
  - Checks environment variables (`API_BASE_URL`, `BASE_URL`)
  - Falls back to Vercel environment variables in production
  - Uses `localhost:3000` for API calls in development
  - Uses `localhost:4321` for UI URLs in development

## URL Functions

```typescript
import { getBaseUrl, getApiBaseUrl, buildApiUrl } from "./src/utils/baseUrl";

// Get UI base URL
const uiUrl = getBaseUrl(); // http://localhost:4321 (dev) or https://www.mydailyf.com (prod)

// Get API base URL
const apiUrl = getApiBaseUrl(); // http://localhost:3000 (dev) or https://www.mydailyf.com (prod)

// Build API endpoint URL
const endpoint = buildApiUrl("/api/auth/signin"); // http://localhost:3000/api/auth/signin (dev)
```
