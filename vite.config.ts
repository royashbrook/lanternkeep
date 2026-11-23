import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig({
  plugins: [
    svelte(),
    {
      name: "build-marker",
      transformIndexHtml: (html) =>
        html.replaceAll(
          "%LANTERNKEEP_BUILD%",
          process.env.LANTERNKEEP_BUILD || "development",
        ),
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.LANTERNKEEP_VERSION || "development",
    ),
    __BUILD_ID__: JSON.stringify(process.env.LANTERNKEEP_BUILD || "development"),
    __SOURCE_SHA__: JSON.stringify(
      process.env.LANTERNKEEP_SOURCE || "development",
    ),
  },
  server: { host: "127.0.0.1", port: 4397, strictPort: true },
  preview: {
    host: "127.0.0.1",
    port: Number(process.env.PORT || 4397),
    strictPort: true,
  },
  build: {
    target: "es2022",
    license: { fileName: "licenses.md" },
    rolldownOptions: {
      preserveEntrySignatures: "strict",
      input: { app: "index.html", sw: "src/sw.ts" },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "sw"
            ? "[name].js"
            : "assets/[name]-[hash].js",
        postBanner: "/* Bundled dependency licenses: /licenses.md */",
      },
    },
  },
});
