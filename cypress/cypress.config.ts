import { defineConfig } from "cypress";
import "../scripts/loadEnv";

const base_url = process.env.BASE_URL || "http://localhost:5002";

export default defineConfig({
  e2e: {
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    baseUrl: base_url,
  },
});
