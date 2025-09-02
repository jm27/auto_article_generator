// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";
// import vercelServerless from "@astrojs/vercel/serverless";
import vercel from "@astrojs/vercel/serverless";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !page.includes("/api/") && // Exclude API routes
        !page.includes("/auth/") && // Exclude auth pages
        !page.includes("/unsubscribed") && // Exclude utility pages
        !page.includes("/goodbye"), // Exclude goodbye pages
    }),
  ],
  output: "server",
  adapter: vercel({
    includeFiles: ["src/templates/newsletter.mjml.js"],
    webAnalytics: {
      enabled: true,
    },
    maxDuration: 60,
    edgeMiddleware: true,
  }),
  vite: {
    plugins: [tailwindcss()],
  },
  compilerOptions: {
    // Enable React's JSX transform
    jsx: "react-jsx",
    // Enable React's automatic runtime
    jsxImportSource: "react",
  },
  site: "https://www.mydailyf.com/",
});
