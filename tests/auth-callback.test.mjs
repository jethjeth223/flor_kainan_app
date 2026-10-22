import { test, mock } from "node:test";
import assert from "node:assert/strict";

const publicOrigin = "https://flors-kainan.onrender.com";
const internalOrigin = "http://0.0.0.0:3000";
let exchanges = [];
let exchangeError = null;
mock.module(new URL("../lib/supabase/server.ts", import.meta.url).href, {
  namedExports: {
    authClient: async () => ({
      auth: {
        exchangeCodeForSession: async (code) => {
          exchanges.push(code);
          return { error: exchangeError };
        },
      },
    }),
  },
});
const { GET } = await import("../app/auth/callback/route.ts");
const { appOrigin } = await import("../lib/app-origin.ts");

test("proxy callbacks return to the configured public origin and reject external destinations", async () => {
  const savedApp = process.env.APP_URL;
  const savedRender = process.env.RENDER_EXTERNAL_URL;
  delete process.env.APP_URL;
  process.env.RENDER_EXTERNAL_URL = publicOrigin;
  try {
    const callback = async (params = {}) => {
      const url = new URL("/auth/callback", internalOrigin);
      url.search = new URLSearchParams(params).toString();
      return GET(new Request(url, { headers: { "x-forwarded-host": "evil.example" } }));
    };
    let response = await callback();
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), publicOrigin + "/login");
    assert.equal(response.headers.get("cache-control"), "no-store");

    response = await callback({ code: "confirmation-code" });
    assert.equal(response.headers.get("location"), publicOrigin + "/");
    response = await callback({ code: "reset-code", next: "/login?mode=reset" });
    assert.equal(response.headers.get("location"), publicOrigin + "/login?mode=reset");
    assert.deepEqual(exchanges, ["confirmation-code", "reset-code"]);

    for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "http://["]) {
      response = await callback({ code: "must-not-exchange", next });
      assert.equal(response.headers.get("location"), publicOrigin + "/login");
    }
    assert.equal(exchanges.length, 2);
    exchangeError = new Error("Expired confirmation");
    response = await callback({ code: "expired", next: "/" });
    assert.equal(response.headers.get("location"), publicOrigin + "/login");

    process.env.APP_URL = "https://shop.example";
    assert.equal(appOrigin(new Request(internalOrigin)), "https://shop.example");
    delete process.env.APP_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    assert.equal(appOrigin(new Request("http://localhost:3000")), "http://localhost:3000");
  } finally {
    if (savedApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = savedApp;
    if (savedRender === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = savedRender;
  }
});
