# Auto Article Generator 🎬

An AI-powered content generation system that creates engaging articles from movie data using a multi-agent pipeline with LangGraph and GPT integration.

## 🔧 Tech Stack

- **Frontend**: Astro + React + TypeScript
- **Backend**: Vercel Functions (Node.js, Python)
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: OpenAI GPT, LangGraph Multi-Agent System
- **Email**: Resend + MJML Templates
- **Styling**: Tailwind CSS
- **Data Source**: The Movie Database (TMDB) API

## 📋 Architecture Overview

### 🎯 Movie Ingestion Pipeline

The system automatically fetches and processes movie data:

1. **Data Collection**: Fetches movies from TMDB API including:
   - Title, synopsis, and metadata
   - Professional reviews and ratings
   - High-quality poster and backdrop images
   - Genre tags and release information

2. **AI Processing**: Generates comprehensive movie summaries using GPT
3. **Database Storage**: Saves processed data to Supabase posts table
4. **Status Tracking**: Marks new movies with `is_movie = true` and `processed = false`

### 🤖 Multi-Agent Content Generation

Powered by **LangGraph** running inside Vercel Functions:

```
Topic Selector → Sentiment Filter → Draft Writer → Editor → Publisher
```

#### Agent Responsibilities:

- **Topic Selector**: Identifies 3 unique article angles per movie
- **Sentiment Filter**: Ensures content tone matches target audience
- **Draft Writer**: Creates initial article drafts with research
- **Editor**: Refines content for readability and engagement
- **Publisher**: Finalizes articles with proper formatting and metadata

#### Output:

- **3 unique articles** per movie
- **Complete content pipeline**: topic → draft → final → sources
- **Structured data**: Each article includes research sources and metadata

## 🗄️ Database Schema

Extended Supabase `posts` table with movie-specific fields:

| Field       | Type      | Purpose                           |
| ----------- | --------- | --------------------------------- |
| `is_movie`  | `boolean` | Identifies movie-based content    |
| `processed` | `boolean` | Tracks content generation status  |
| `draft`     | `text`    | Stores initial AI-generated draft |
| `sources`   | `jsonb[]` | Research sources and references   |
| `parent_id` | `uuid`    | Links articles to source movie    |

### Data Strategy

- **Parent Record**: Original movie entry with metadata
- **Child Records**: Generated articles linked via `parent_id`
- **Inheritance**: Articles reuse movie images, tags, and base metadata

## 🚀 Content Publishing Flow

Automated article generation and publishing:

1. **Query Movies**: Find movies with `processed = false`
2. **Generate Content**:
   ```
   POST /api/agents/research
   → Multi-agent pipeline execution
   → 3 articles per movie
   ```
3. **Save Articles**: Insert as new posts with:
   - `title` = selected topic
   - `content` = final polished article
   - Inherited images and tags from parent movie
4. **Update Status**: Mark parent movie as `processed = true`

## 📧 Newsletter System

- **MJML Templates**: Responsive email design
- **Resend Integration**: Reliable email delivery
- **User Management**: Subscription and profile system
- **Content Curation**: Automated newsletter generation from articles

## 🛠️ Development

### Prerequisites

- Node.js 18+
- Vercel CLI
- Supabase account

### Setup

```bash
# Install dependencies
npm install

# Start development servers
npm run dev          # UI (port 4321)
vercel dev           # API (port 3000)
```

### Environment Variables

```env
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
TMDB_API_KEY=your_tmdb_key
RESEND_API_KEY=your_resend_key
```

## 📁 Project Structure

```
ui/
├── api/                    # Vercel Functions
│   ├── agents/            # Multi-agent pipeline
│   ├── auth/              # Authentication endpoints
│   ├── content/           # Content management
│   └── newsletter/        # Email system
├── src/
│   ├── components/        # React components
│   ├── pages/            # Astro pages
│   ├── templates/        # MJML email templates
│   └── scripts/          # Data processing scripts
└── helpers/              # Utility functions
```
