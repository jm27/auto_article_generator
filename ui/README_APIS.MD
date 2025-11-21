# Complete API Reference

This documentation provides a comprehensive overview of all 13 API handlers, including their function signatures, input parameters, response formats, HTTP methods, and detailed process flows. It also covers authentication, user management, content management, newsletter system, user preferences, common response patterns, security features, and required environment variables.

---

## 1. Authentication & User Management

### 1.1 User Registration

- **Endpoint:** `POST /api/auth/register`
- **Input:** `{ email: string, password: string, name: string }`
- **Response:** `{ userId: string, email: string, name: string }`
- **Process Flow:** Validates input → Creates user → Returns user info
- **Security:** Password hashing, input validation

### 1.2 User Signin

- **Endpoint:** `POST /api/auth/signin`
- **Input:** `{ email: string, password: string }`
- **Response:** `{ token: string, user: { userId, email, name } }`
- **Process Flow:** Validates credentials → Issues JWT token
- **Security:** Rate limiting, token generation

### 1.3 User Signout

- **Endpoint:** `POST /api/auth/signout`
- **Input:** `{ token: string }`
- **Response:** `{ success: boolean }`
- **Process Flow:** Invalidates session/token

### 1.4 Subscription Management

- **Endpoint:** `POST /api/user/subscribe`
- **Input:** `{ userId: string, planId: string }`
- **Response:** `{ subscriptionId: string, status: string }`
- **Process Flow:** Validates user → Activates subscription

---

## 2. Content Management

### 2.1 Fetch Movies

- **Endpoint:** `GET /api/movies`
- **Input:** Query params: `?genre=string&limit=number`
- **Response:** `[{ movieId, title, genre, ... }]`
- **Process Flow:** Fetches movies based on filters

### 2.2 AI Content Generation

- **Endpoint:** `POST /api/content/generate`
- **Input:** `{ prompt: string, options?: object }`
- **Response:** `{ content: string }`
- **Process Flow:** Validates prompt → Calls AI model → Returns content

### 2.3 Data Ingestion

- **Endpoint:** `POST /api/data/ingest`
- **Input:** `{ data: object }`
- **Response:** `{ success: boolean, ingestedCount: number }`
- **Process Flow:** Validates data → Stores in database

---

## 3. Newsletter System

### 3.1 Send Email

- **Endpoint:** `POST /api/newsletter/send`
- **Input:** `{ to: string, subject: string, body: string }`
- **Response:** `{ messageId: string, status: string }`
- **Process Flow:** Validates email → Sends via provider

### 3.2 Webhook Handling

- **Endpoint:** `POST /api/newsletter/webhook`
- **Input:** `{ event: string, payload: object }`
- **Response:** `{ received: boolean }`
- **Process Flow:** Verifies signature → Processes event

### 3.3 Event Tracking

- **Endpoint:** `GET /api/newsletter/events`
- **Input:** Query params: `?userId=string`
- **Response:** `[{ eventId, type, timestamp, ... }]`
- **Process Flow:** Fetches events for user

---

## 4. User Preferences

### 4.1 Tag Management

- **Endpoint:** `POST /api/user/tags`
- **Input:** `{ userId: string, tags: string[] }`
- **Response:** `{ updated: boolean, tags: string[] }`
- **Process Flow:** Updates user tags

### 4.2 Profile Updates

- **Endpoint:** `PUT /api/user/profile`
- **Input:** `{ userId: string, profile: object }`
- **Response:** `{ updated: boolean, profile: object }`
- **Process Flow:** Validates and updates profile

---

## 5. Common Patterns

- **Response Format:** All responses are JSON. On success: `{ ...data }`. On error: `{ error: string, code: number }`
- **Error Handling:** Standardized error codes and messages for all endpoints

---

## 6. Security Features

- **CORS:** Configured for allowed origins
- **Validation:** Input validation on all endpoints
- **Tokens:** JWT for authentication, refresh tokens as needed
- **Webhook Signatures:** HMAC verification for incoming webhooks

---

## 7. Environment Variables

- `DATABASE_URL`: Connection string for database
- `JWT_SECRET`: Secret key for token signing
- `EMAIL_PROVIDER_API_KEY`: API key for email service
- `AI_API_KEY`: API key for AI content generation
- `CORS_ORIGINS`: Allowed origins for CORS
- `WEBHOOK_SECRET`: Secret for webhook signature verification

---

## Sample map

## Sample layout of APIS

```
/api
  auth-register.ts        ← Node.js (your existing handlers)
  auth-signin.ts          ← Node.js
  movies.ts               ← Node.js
  newsletter.ts           ← Node.js
  agents/
    research.py           ← Python (LangGraph research agent)
    draft.py              ← Python (LangGraph drafting agent)
    editor.py             ← Python (LangGraph fact‑check agent)
    distribute.py         ← Python (LangGraph distribution agent)
requirements.txt          ← Python deps (langgraph, openai, etc.)
```
