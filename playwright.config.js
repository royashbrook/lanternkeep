import { defineConfig, devices } from "@playwright/test";
const url =
  process.env.GAME_URL || `http://127.0.0.1:${process.env.PORT || 4397}`;
// the tablet this game is designed for, in portrait, driven by both engines.
// specs that care about other sizes set their own viewport.
const tablet = devices["iPad (gen 7)"];
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 120000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: url,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...tablet, browserName: "chromium" } },
    { name: "webkit", use: { ...tablet, browserName: "webkit" } },
  ],
  webServer: process.env.GAME_URL
    ? undefined
    : { command: "npm run preview", url, reuseExistingServer: false },
});
