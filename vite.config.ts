import { defineConfig } from "vite";

export default defineConfig({
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        background: "background.html",
        bossbar: "bossbar.html",
        cinematic: "cinematic.html",
      },
    },
  },
});
