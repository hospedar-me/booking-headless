import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PublicContentCache } from "./public-content-cache";
const directories: string[] = [];
async function setup(request: typeof fetch, interval = 300000) {
  const root = await mkdtemp(path.join(tmpdir(), "public-content-test-"));
  directories.push(root);
  return new PublicContentCache(
    root,
    "client-a",
    "http://backend:8080",
    "https://api.example.com",
    request,
    interval,
  );
}
const url =
  "http://backend:8080/booking-engine/clients/client-a/public-profile";
const profile = {
  clientId: "client-a",
  isPublished: true,
  translations: [{ locale: "pt-BR", displayName: "Hotel das Montanhas" }],
  brandMedia: {
    logoHorizontal: { mimeType: "image/png", url: "/media/client-a/logo.png" },
  },
};
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
  vi.useRealTimers();
});
describe("durable public content", () => {
  it("downloads images, hides the upstream and survives an outage and process restart", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async (input) =>
      String(input).includes("/media/")
        ? new Response(new Uint8Array([137, 80, 78, 71]), {
            headers: { "Content-Type": "image/png" },
          })
        : Response.json(profile),
    );
    const cache = await setup(request);
    const data = await (await cache.fetch(url)).json();
    expect(data.translations[0].displayName).toBe("Hotel das Montanhas");
    expect(data.brandMedia.logoHorizontal.url).toMatch(
      /^\/api\/site-media\/[a-f0-9]{64}$/,
    );
    expect(JSON.stringify(data)).not.toContain("api.example.com");
    const offline = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    const restarted = new PublicContentCache(
      cache.root,
      "client-a",
      "http://backend:8080",
      "https://api.example.com",
      offline,
      0,
    );
    expect(await (await restarted.fetch(url)).json()).toEqual(data);
    expect(
      (
        await restarted.image(
          data.brandMedia.logoHorizontal.url.split("/").pop(),
        )
      )?.bytes.length,
    ).toBe(4);
  });
  it("returns unavailable without a snapshot and does not cache operational requests or another client", async () => {
    const cache = await setup(
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
    );
    expect((await cache.fetch(url)).status).toBe(503);
    expect(cache.matches(url)).toBe(true);
    expect(cache.matches(url, "POST")).toBe(false);
    for (const suffix of [
      "options",
      "my-reservations",
      "accommodations",
      "pre-reservations",
      "payment-session",
    ])
      expect(cache.matches(url.replace("public-profile", suffix))).toBe(false);
    expect(cache.matches(url.replace("client-a", "client-b"))).toBe(false);
  });
  it("updates content, preserves the last good image when an origin fails, and honors explicit removal", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async (input) =>
      String(input).includes("/media/")
        ? new Response(new Uint8Array([1]), {
            headers: { "Content-Type": "image/png" },
          })
        : Response.json(profile),
    );
    const cache = await setup(request, 0);
    await cache.fetch(url);
    request.mockImplementation(async (input) =>
      String(input).includes("/media/")
        ? new Response(null, { status: 503 })
        : Response.json({
            ...profile,
            translations: [{ displayName: "Novo nome" }],
          }),
    );
    await cache.fetch(url);
    await new Promise((r) => setTimeout(r, 40));
    expect(
      (await (await cache.fetch(url)).json()).translations[0].displayName,
    ).toBe("Novo nome");
    await new Promise((r) => setTimeout(r, 40));
    request.mockResolvedValue(new Response(null, { status: 404 }));
    await cache.fetch(url);
    await new Promise((r) => setTimeout(r, 40));
    expect((await cache.fetch(url)).status).toBe(503);
  });
  it("does not replace a valid catalog with an error but accepts a successful empty list", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json([{ id: 1 }]));
    const cache = await setup(request, 0),
      gallery = url.replace("public-profile", "gallery");
    await cache.fetch(gallery);
    request.mockResolvedValue(new Response(null, { status: 500 }));
    await cache.fetch(gallery);
    await new Promise((r) => setTimeout(r, 40));
    expect(await (await cache.fetch(gallery)).json()).toEqual([{ id: 1 }]);
    const fresh = new PublicContentCache(
      cache.root,
      "client-a",
      "http://backend:8080",
      "https://api.example.com",
      async () => Response.json([]),
      0,
    );
    await fresh.fetch(gallery);
    await new Promise((r) => setTimeout(r, 40));
    expect(await (await fresh.fetch(gallery)).json()).toEqual([]);
  });
  it("rejects redirects and arbitrary upstream hosts and bounds public media", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("bad", { headers: { "Content-Type": "text/html" } }),
      );
    const cache = await setup(request);
    await expect(cache.media("http://169.254.169.254/media/a")).rejects.toThrow(
      "invalid_media_source",
    );
    await expect(cache.media("/auth/token")).rejects.toThrow(
      "invalid_media_path",
    );
    await expect(cache.media("/media/a")).rejects.toThrow("invalid_media");
    expect(await cache.image("../../secrets")).toBeNull();
  });
});

it("never downloads or persists private response images", async () => {
  const request = vi.fn<typeof fetch>();
  const cache = await setup(request);
  const result = (await cache.localize(
    {
      guest: {
        media: [{ mimeType: "image/png", url: "/media/client-a/private.png" }],
      },
    },
    "",
    false,
    true,
  )) as { guest: { media: { url: string }[] } };
  expect(result.guest.media[0].url).toBe("");
  expect(request).not.toHaveBeenCalled();
});

it("rejects private resources even when called without the transport allowlist", async () => {
  const request = vi.fn<typeof fetch>();
  const cache = await setup(request);
  await expect(
    cache.fetch(url.replace("public-profile", "my-reservations")),
  ).rejects.toThrow("non_public_resource");
  expect(request).not.toHaveBeenCalled();
});
