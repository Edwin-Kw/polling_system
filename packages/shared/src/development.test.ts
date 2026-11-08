import { describe, expect, it } from "vitest";
import { developmentApiOrigin, developmentDefaults, httpOrigin, serverAddressSchema } from "./development.ts";

describe("shared development address settings", () => {
  it("keeps existing defaults and uses a configured API port", () => {
    const defaults = serverAddressSchema.parse({});
    expect(defaults).toEqual({ HOST: developmentDefaults.host, PORT: developmentDefaults.apiPort });
    expect(developmentApiOrigin(defaults)).toBe("http://127.0.0.1:3000");
    expect(developmentApiOrigin(serverAddressSchema.parse({ HOST: "localhost", PORT: "3100" }))).toBe("http://localhost:3100");
  });
  it.each(["0.0.0.0", "::", "[::]"])("uses a connectable loopback proxy target for wildcard bind %s", (HOST) => {
    expect(developmentApiOrigin(serverAddressSchema.parse({ HOST, PORT: 3100 }))).toBe("http://127.0.0.1:3100");
  });
  it("formats IPv6 addresses and rejects invalid ports", () => {
    expect(httpOrigin("::1", 3100)).toBe("http://[::1]:3100");
    expect(() => serverAddressSchema.parse({ PORT: "bad" })).toThrow();
    expect(() => serverAddressSchema.parse({ PORT: 0 })).toThrow();
    expect(() => serverAddressSchema.parse({ PORT: 65536 })).toThrow();
  });
});
