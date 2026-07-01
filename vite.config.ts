import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import electron from "vite-plugin-electron/simple";
import { notBundle } from "vite-plugin-electron/plugin";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

function cleanElectronOutput(): Plugin {
  return {
    name: "clean-electron-output",
    apply: "build",
    configResolved() {
      rmSync(fileURLToPath(new URL("./dist-electron", import.meta.url)), {
        recursive: true,
        force: true,
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    cleanElectronOutput(),
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: {
          main: "desktop/main.ts",
          storage: "desktop/storage.ts",
          agent: "desktop/agent.ts",
        },
        vite: {
          plugins: [notBundle({ filter: /^(?![./])/ })],
        },
      },
      preload: {
        input: fileURLToPath(new URL("./desktop/preload.ts", import.meta.url)),
        vite: {
          build: {
            rolldownOptions: {
              output: {
                entryFileNames: "preload.cjs",
              },
            },
          },
        },
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
