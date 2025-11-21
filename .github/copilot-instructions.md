# AI Agent Instructions for Auto Article Generator

## Project Overview

**My Daily Feed** is an Astro-based personalized movie newsletter platform that automatically ingests movies from TMDB, generates AI summaries using OpenAI, and sends personalized newsletters via Resend based on user tag preferences.

**Tech Stack:** Astro v5 + React 19 + TypeScript + Tailwind CSS v4 + Supabase + Vercel serverless + MJML email templates

**Key Data Flow:**

1. **Cron Job (daily)** → `/api/ingest-movies` fetches movies from TMDB → generates summaries via OpenAI → stores in Supabase `posts` table
2. **Cron Job (daily)** → `/api/send-newsletter` queries Supabase for subscribers + posts → filters by tag preferences → sends personalized MJML emails via Resend
3. **User Flow:** Sign in via Supabase Auth OTP → Select tag preferences in profile → View posts on feed → Read individual post pages

---

## Critical Architecture Patterns

### Environment Variables: Two Contexts, Different Prefixes

**Astro/Client-side code** (`.astro`, `.tsx`, `.ts` in `src/`):

- Uses `import.meta.env.PUBLIC_SUPABASE_URL` and `import.meta.env.TMDB_API_KEY`
- Client-safe vars MUST have `PUBLIC_` prefix to be exposed to browser

**API Routes/Server-side code** (`api/*.js`):

- Uses `process.env.PUBLIC_SUPABASE_URL` and `process.env.TMDB_API_KEY`
- NO prefix required for server-only secrets (e.g., `OPENAI_API_KEY`, `RESEND_API_KEY`)

**Example:**

```typescript
// src/lib/supabase/supabaseClient.ts (CLIENT)
export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL as string,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string
);

// api/helpers/supabaseClient.js (SERVER)
export const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_ANON_KEY
);
```

### Dual Supabase Clients

- `src/lib/supabase/supabaseClient.ts` → Used in Astro pages/React components (client-side)
- `api/helpers/supabaseClient.js` → Used in API routes (server-side)

**Never mix these!** Using the wrong client causes "supabaseUrl is required" errors.

### API Route Pattern (Vercel Serverless)

All API routes in `api/*.js` must export handlers that return `new Response()` with `JSON.stringify()`:

```javascript
export default async function handler(req, res) {
  return res.status(200).json({ message: "OK" }); // For compatibility with Vercel
}
// OR for GET endpoints:
export async function GET(request) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

### File Import Extensions

**ALL imports in `api/` directory MUST use `.js` extensions**, even when importing from `.ts` files, due to Node.js ESM requirements:

```javascript
// api/ingest-movies.js
import { supabase } from "./helpers/supabaseClient.js"; // ✅ Correct
import { getMovies } from "./get-movies.js"; // ✅ Even for TS files
```

### React Hooks in Astro

**NEVER call React hooks in Astro frontmatter** (causes "Invalid hook call" error). Hooks only work inside React components:

```astro
---
// ❌ WRONG - This is server-side Astro code
import { useSession } from '../hooks/useSession';
const session = useSession(); // ERROR!

// ✅ CORRECT - Use Supabase server-side API
import { supabase } from '../lib/supabase/supabaseClient';
const { data: { session } } = await supabase.auth.getSession();
---

<Layout>
  {/* ✅ CORRECT - Hooks work in React components */}
  <AuthWidget client:load />
</Layout>
```

---

## Database Schema (Supabase)

**Tables:**

- `posts` → `id` (int), `title`, `slug`, `content` (AI summary), `tags` (text[]), `images` (text[]), `reviews` (jsonb[]), `published_at`
- `subscribers` → `id` (uuid), `email`, `tag_preferences` (text[]), `subscription_status` (bool)
- `tags` → `id` (int), `name` (text)

**Key Queries:**

```javascript
// Check existing movies before ingestion
const { data: existingMovies } = await supabase
  .from("posts")
  .select("id")
  .in("id", movieIds);

// Personalized newsletter filtering
const personalizedPosts = posts.filter((post) =>
  post.tags.some((tag) => user.tag_preferences.includes(tag))
);

// Recent posts for newsletter (last 7 days)
const { data: posts } = await supabase
  .from("posts")
  .select("*")
  .gt("published_at", new Date(Date.now() - 7 * 86400000).toISOString());
```

---

## Vercel Cron Jobs (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/ingest-movies",
      "schedule": "30 0 * * *" // Daily at 00:30 UTC
    },
    {
      "path": "/api/send-newsletter",
      "schedule": "45 1 * * *" // Daily at 01:45 UTC (9:45 PM EST/EDT)
    }
  ]
}
```

**Note:** Vercel cron uses UTC only, no timezone support. Plan times accordingly.

---

## Email Template System (MJML + Handlebars)

**Template:** `templates/newsletter.mjml`

- Uses Handlebars for dynamic content: `{{#each content}}`, `{{title}}`, `{{../link}}/posts/{{slug}}`
- MJML compiled to HTML via `mjml2html()` in `api/send-newsletter.js`
- All post elements (image, title, summary, button) use `align="center"` for mobile centering
- Poster images from TMDB: `{{poster}}` = `https://image.tmdb.org/t/p/original${m.poster_path}`

**Mobile Responsiveness:**

```mjml
<mj-style inline="inline">
  @media only screen and (max-width: 480px) { .center-mobile { text-align:
  center !important; display: block !important; margin-left: auto !important;
  margin-right: auto !important; } }
</mj-style>
```

---

## Movie Ingestion Pipeline

### 1. `/api/get-movies` → Fetches from TMDB

- Calls TMDB API `now_playing` endpoint
- Maps genre IDs to names via `mapGenreIdsToName()`
- Fetches reviews via `fetchReviewsForMovie()`
- Returns array with `{ id, title, synopsis, tags, reviews, images: [poster_path, backdrop_path] }`

### 2. `/api/generate-content` → AI Summary Generation

- Takes `{ title, synopsis, reviews }` from request body
- Uses OpenAI GPT-4o-mini to generate 100-150 word spoiler-free summaries
- Includes first review as additional context in prompt

### 3. `/api/ingest-movies` → Orchestrates Pipeline

- Calls `/api/get-movies` via HTTP (not direct import due to module compatibility)
- Checks existing movies in Supabase via `.in("id", movieIds)` to avoid duplicates
- For new movies only: generates summary → upserts to `posts` table
- Sends Resend email notification with ingestion report

**Critical:** Images stored as array in DB but TMDB URLs constructed on read:

```javascript
images: movie.images.map((img) => `https://image.tmdb.org/t/p/original${img}`);
```

---

## Development Workflow

### Running Locally

The app requires **two separate processes** running simultaneously:

**1. UI Server (Astro)**

```powershell
cd C:\Users\jme27\Documents\projects\auto_article_generator\repo\ui\auto_article_generator\ui
npm run dev          # Starts Astro dev server at localhost:4321
```

**2. App Server (Vercel Serverless Functions)**

```powershell
cd C:\Users\jme27\Documents\projects\auto_article_generator\repo\ui\auto_article_generator
vercel dev           # Starts Vercel dev server for API routes
```

**Note:** Both servers must be running for full functionality. The UI server handles pages/components, while Vercel dev server handles `/api/*` routes.

### Production Commands

```bash
npm run build        # Build for production
npm run preview      # Preview production build locally
```

### Testing API Endpoints Locally

```bash
# Test ingest-movies (requires TMDB_API_KEY, OPENAI_API_KEY, RESEND_API_KEY)
curl http://localhost:4321/api/ingest-movies

# Test newsletter send (requires RESEND_API_KEY, subscribers in DB)
curl http://localhost:4321/api/send-newsletter
```

### Environment Setup

Required env vars in Vercel (or `.env` locally):

- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (Supabase project credentials)
- `TMDB_API_KEY` (The Movie Database API key)
- `OPENAI_API_KEY` (OpenAI API key for GPT-4o-mini)
- `RESEND_API_KEY` (Resend email API key)
- `EMAIL_FROM`, `EMAIL_TO` (email notification addresses)
- `VERCEL_PROJECT_PRODUCTION_URL` (auto-set by Vercel for API calls)

**Security Note:** Never hardcode secrets. Always use `process.env` or `import.meta.env`.

### Database Migrations

Using Supabase as database provider. Schema changes are managed through Supabase Studio/SQL editor. No formal migration system implemented yet.

### Error Monitoring & Testing

- **No external error tracking** (Sentry, etc.) - relies on console logging and Vercel logs
- **Testing:** Playwright installed for E2E testing (in development, conventions TBD)
- **Content Moderation:** No filtering on AI-generated summaries before storage

See `TODOS.md` for planned improvements (rate limiting, content moderation, etc.).

---

## Common Pitfalls

1. **"supabaseUrl is required"** → Using wrong Supabase client for context (client vs server)
2. **"Invalid hook call"** → Calling React hooks in Astro frontmatter instead of React components
3. **Import errors in API routes** → Missing `.js` extension on imports
4. **Cron jobs not triggering** → Check Vercel dashboard for cron logs, verify UTC time conversion
5. **Newsletter not personalized** → Ensure `tag_preferences` array in `subscribers` table matches `tags` array in `posts`
6. **Images not displaying** → Verify TMDB URL construction: `https://image.tmdb.org/t/p/original${path}`

---

## Mobile Responsiveness Standards

All components use Tailwind's responsive prefixes (`sm:`, `md:`) for mobile-first design:

- Text: `text-base sm:text-xl` (16px mobile, 20px desktop)
- Padding: `p-2 sm:p-4` (8px mobile, 16px desktop)
- Width: `max-w-full sm:max-w-2xl` (full mobile, 672px desktop)
- Buttons: Always include `cursor-pointer` for UX

**Example from `src/pages/index.astro`:**

```astro
<h1 class="text-2xl sm:text-4xl font-extrabold text-gray-900 mb-6 sm:mb-8">
  Latest Posts
</h1>
```

---

## File Structure Map

```
ui/
├── api/                          # Vercel serverless functions
│   ├── generate-content.js       # OpenAI summary generation
│   ├── get-movies.js             # TMDB API fetcher
│   ├── ingest-movies.js          # Movie ingestion orchestrator
│   ├── send-newsletter.js        # Newsletter sender
│   └── helpers/
│       ├── movie-helpers.js      # Genre mapping, review fetching
│       └── supabaseClient.js     # Server-side Supabase client
├── src/
│   ├── components/               # React components
│   │   ├── AuthWidget.tsx        # Supabase OTP auth
│   │   ├── ProfileForm.tsx       # Tag preference editor
│   │   ├── SubscribeForm.tsx     # Subscriber form
│   │   └── TagSelection.tsx      # Tag selection UI
│   ├── lib/supabase/             # Client-side Supabase
│   │   ├── supabaseClient.ts     # Browser Supabase client
│   │   └── helpers.ts            # User profile validation
│   ├── pages/                    # Astro routes
│   │   ├── index.astro           # Post feed
│   │   ├── profile.astro         # User profile page
│   │   └── posts/[slug].astro    # Dynamic post pages
│   └── scripts/
│       ├── fetch-movies.ts       # TMDB fetcher (client-side)
│       └── generate-and-save.ts  # Movie generation script
├── templates/
│   └── newsletter.mjml           # Email template
└── vercel.json                   # Cron job configuration
```

---

## Key Principles for AI Agents

1. **Always check context** before using Supabase/env vars (client vs server)
2. **Read existing error patterns** in conversation history before suggesting fixes
3. **Use `.js` extensions** for all imports in `api/` directory
4. **Test mobile responsiveness** when adding UI components
5. **Follow OWASP security guidelines** (see `.github/instructions/security-and-owasp.instructions.md`)
6. **Preserve existing logging** in API routes for debugging (extensive `console.log` usage is intentional)
7. **MJML alignment** for email templates: always use `align="center"` for mobile centering
8. **TypeScript/Node compatibility:** API routes use plain JS for Vercel compatibility

---

**Last Updated:** 2025-11-21  
**Maintained By:** AI agents following this guide should update this file when discovering new patterns or fixing recurring issues.
