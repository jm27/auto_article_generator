// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";
// import vercelServerless from "@astrojs/vercel/serverless";
import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  output: "server",
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    maxDuration: 60,
    includeFiles: ['templates/**'],
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
