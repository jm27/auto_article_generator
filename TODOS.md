# TODO List - My Daily Feed

## High Priority

### Rate Limiting Implementation

- [ ] **TMDB API Rate Limiting**

  - TMDB has rate limits (40 requests per 10 seconds)
  - Implement exponential backoff for failed requests
  - Add request queuing/throttling in `api/get-movies.js` and `api/helpers/movie-helpers.js`
  - Consider caching TMDB genre mappings to reduce API calls

- [ ] **OpenAI API Rate Limiting**

  - Implement retry logic with exponential backoff in `api/generate-content.js`
  - Add rate limit error handling (429 status codes)
  - Consider implementing a queue system for summary generation during peak ingestion
  - Track token usage to avoid exceeding tier limits

- [ ] **Resend API Rate Limiting**
  - Batch email sending in `api/send-newsletter.js` to respect rate limits
  - Implement delays between newsletter sends
  - Add retry logic for failed email sends

### Content Moderation

- [ ] **AI-Generated Summary Moderation**
  - Implement content filtering before storing summaries in Supabase
  - Add profanity/inappropriate content detection
  - Consider using OpenAI moderation API before saving summaries
  - Add manual review flag for suspicious content
  - Create admin dashboard for reviewing flagged content

## Medium Priority

### Error Monitoring & Observability

- [ ] **External Error Tracking**

  - Evaluate Sentry, LogRocket, or similar services
  - Implement structured error logging across all API routes
  - Add alerting for critical failures (ingestion, newsletter sending)
  - Track error rates and set up notifications

- [ ] **Performance Monitoring**
  - Add timing metrics for API endpoints
  - Monitor Supabase query performance
  - Track OpenAI API response times
  - Monitor email delivery rates

### Testing Infrastructure

- [ ] **Playwright E2E Tests**

  - Define testing conventions and patterns
  - Write tests for authentication flow (OTP sign-in)
  - Test tag selection and profile updates
  - Test post viewing and navigation
  - Add CI/CD integration for automated testing

- [ ] **API Testing**
  - Unit tests for movie ingestion pipeline
  - Integration tests for newsletter generation
  - Mock TMDB/OpenAI/Resend APIs for testing
  - Test error handling and edge cases

### Database & Schema

- [ ] **Migration System**
  - Implement formal database migration process (consider Supabase migrations)
  - Version control schema changes
  - Add seed data for development/testing
  - Document rollback procedures

## Low Priority

### Feature Enhancements

- [ ] **Caching Strategy**

  - Cache TMDB movie data to reduce API calls
  - Implement Redis/Upstash for session caching
  - Cache generated summaries for duplicate movies

- [ ] **Newsletter Improvements**

  - Add unsubscribe link to newsletters
  - Implement email preferences (frequency, content types)
  - A/B testing for email subject lines
  - Track email open rates and click-through rates

- [ ] **User Experience**
  - Add loading states for all async operations
  - Improve error messages for users
  - Add toast notifications for success/error states
  - Implement skeleton loaders for content

### DevOps & Infrastructure

- [ ] **CI/CD Pipeline**

  - Automate deployment to Vercel on main branch merge
  - Run tests before deployment
  - Implement staging environment

- [ ] **Monitoring Dashboard**
  - Create admin dashboard for system health
  - Display ingestion stats (movies added, failures)
  - Newsletter delivery metrics
  - User growth and engagement metrics

## Nice to Have

- [ ] **Advanced Personalization**

  - ML-based recommendation system beyond tag matching
  - User rating system for movies
  - Collaborative filtering for better recommendations

- [ ] **Multi-language Support**

  - Internationalize UI and email templates
  - Support multiple languages for movie summaries

- [ ] **Mobile App**
  - React Native or PWA for mobile experience

---

**Last Updated:** 2025-11-21  
**Note:** Prioritize items based on user impact and technical risk. Rate limiting and content moderation should be addressed before scaling user base.
