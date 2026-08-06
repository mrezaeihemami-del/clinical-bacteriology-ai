import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // The workspace script runs from apps/web, so explicitly load the repository-root .env.
  const rootEnv = loadEnv(mode, "../../", "");
  const apiPort = process.env.PORT ?? rootEnv.PORT ?? "3001";
  const apiTarget =
    process.env.VITE_API_TARGET ??
    rootEnv.VITE_API_TARGET ??
    `http://localhost:${apiPort}`;
  const webPort = Number(process.env.WEB_PORT ?? rootEnv.WEB_PORT ?? "5173");

  if (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535) {
    throw new Error(`Invalid WEB_PORT: ${String(webPort)}`);
  }

  return {
    plugins: react(),
    server: {
      host: "127.0.0.1",
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: false,
        },
      },
    },
  };
});
