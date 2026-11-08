import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { API_BASE_PATH, SOCKET_PATH } from "@polling/shared";
import { developmentApiOrigin, developmentDefaults, serverAddressSchema } from "@polling/shared/development";

export default defineConfig(() => {
  const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
  // Read API address settings without Vite applying the backend's NODE_ENV to the browser build.
  const environment = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
  const address = serverAddressSchema.parse({
    HOST: process.env.HOST ?? environment.HOST,
    PORT: process.env.PORT ?? environment.PORT,
  });
  const target = developmentApiOrigin(address);
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: developmentDefaults.host,
      port: developmentDefaults.webPort,
      strictPort: true,
      proxy: {
        [API_BASE_PATH]: target,
        [SOCKET_PATH]: { target, ws: true },
      },
    },
  };
});
