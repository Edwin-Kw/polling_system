import { z } from "zod";

export const developmentDefaults = {
  host: "127.0.0.1",
  apiPort: 3000,
  webPort: 5173,
} as const;

export const serverAddressSchema = z.object({
  HOST: z.string().min(1).default(developmentDefaults.host),
  PORT: z.coerce.number().int().min(1).max(65535).default(developmentDefaults.apiPort),
});

export function httpOrigin(host: string, port: number) {
  const hostname = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return new URL(`http://${hostname}:${port}`).origin;
}

export function developmentApiOrigin(address: z.infer<typeof serverAddressSchema>) {
  const host = ["0.0.0.0", "::", "[::]"].includes(address.HOST) ? developmentDefaults.host : address.HOST;
  return httpOrigin(host, address.PORT);
}
