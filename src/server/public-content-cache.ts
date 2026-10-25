import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  stat,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
]);
const CATALOG =
  /\/booking-engine\/clients\/([^/]+)\/(public-profile|gallery|accommodation-categories|rate-plans|reviews(?:\/summary)?|property-content-sections(?:\/[^/]+)?)$/;
type Entry = {
  version: 1;
  savedAt: number;
  checkedAt: number;
  status: number;
  data: unknown;
};
export class PublicContentCache {
  private pending = new Map<string, Promise<Entry>>();
  private retryAfter = new Map<string, number>();
  constructor(
    readonly root: string,
    readonly clientId: string,
    readonly backend: string,
    readonly mediaOrigin: string,
    private request: typeof fetch = fetch,
    readonly interval = 300000,
  ) {}
  private file(key: string) {
    return path.join(this.root, key + ".json");
  }
  async read(key: string): Promise<Entry | null> {
    try {
      const entry = JSON.parse(await readFile(this.file(key), "utf8"));
      return entry.version === 1 && typeof entry.savedAt === "number"
        ? entry
        : null;
    } catch {
      return null;
    }
  }
  async save(key: string, value: unknown) {
    await mkdir(this.root, { recursive: true });
    const file = this.file(key),
      temporary = file + "." + randomUUID();
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await rename(temporary, file);
  }
  matches(url: string, method = "GET") {
    const parsed = new URL(url, this.backend),
      match = CATALOG.exec(parsed.pathname);
    return (
      method.toUpperCase() === "GET" &&
      parsed.origin === new URL(this.backend).origin &&
      match?.[1] === this.clientId
    );
  }
  async media(source: string): Promise<string> {
    if (source.startsWith("/api/site-media/")) return source;
    const parsed = new URL(source, this.mediaOrigin);
    const allowed = [
      new URL(this.backend).origin,
      new URL(this.mediaOrigin).origin,
    ];
    if (
      !allowed.includes(parsed.origin) ||
      parsed.username ||
      parsed.password ||
      !["http:", "https:"].includes(parsed.protocol)
    )
      throw new Error("invalid_media_source");
    // Fetch from the trusted internal origin. No caller-controlled host or redirect.
    const url = new URL(parsed.pathname + parsed.search, this.backend);
    if (!/^\/(?:media|uploads|assets|storage)(?:\/|$)/.test(url.pathname))
      throw new Error("invalid_media_path");
    const key = "source-" + digest(url.toString());
    let old = await this.read(key);
    if (old && !(await this.image(String(old.data).split("/").pop() || "")))
      old = null;
    if (old && Date.now() - old.checkedAt < this.interval)
      return old.data as string;
    try {
      const response = await this.request(url, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const mime = response.headers.get("content-type")?.split(";")[0] || "";
      if (
        !response.ok ||
        !IMAGE_TYPES.has(mime) ||
        Number(response.headers.get("content-length")) > 12582912
      )
        throw new Error("invalid_media");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("invalid_media");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 12582912) throw new Error("media_too_large");
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      const bytes = Buffer.concat(chunks),
        id = digest(bytes);
      const files = await readdir(this.root).catch(() => []);
      let stored = 0;
      for (const file of files.filter((f) => f.endsWith(".bin")))
        stored += (
          await stat(path.join(this.root, file)).catch(() => ({ size: 0 }))
        ).size;
      if (stored + bytes.length > 536870912)
        throw new Error("media_cache_full");
      await mkdir(this.root, { recursive: true });
      const target = path.join(this.root, id + ".bin");
      try {
        await stat(target);
      } catch {
        const temp = target + "." + randomUUID();
        await writeFile(temp, bytes);
        await rename(temp, target);
      }
      await this.save("image-" + id, { mime });
      const local = "/api/site-media/" + id;
      await this.save(key, {
        version: 1,
        savedAt: Date.now(),
        checkedAt: Date.now(),
        status: 200,
        data: local,
      });
      return local;
    } catch (error) {
      if (old) return old.data as string;
      throw error;
    }
  }
  private async knownMedia(source: string) {
    if (source.startsWith("/api/site-media/")) return source;
    try {
      const parsed = new URL(source, this.mediaOrigin);
      if (
        ![
          new URL(this.backend).origin,
          new URL(this.mediaOrigin).origin,
        ].includes(parsed.origin)
      )
        return "";
      const url = new URL(parsed.pathname + parsed.search, this.backend);
      const entry = await this.read("source-" + digest(url.toString()));
      return typeof entry?.data === "string" ? entry.data : "";
    } catch {
      return "";
    }
  }
  async localize(
    value: unknown,
    parent = "",
    strict = true,
    knownOnly = false,
  ): Promise<unknown> {
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value)
        result.push(await this.localize(item, parent, strict, knownOnly));
      return result;
    }
    if (!value || typeof value !== "object") return value;
    const object = value as Record<string, unknown>,
      result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(object)) {
      const image =
        /^(imageUrl|thumbnailUrl|coverUrl|logoUrl)$/.test(key) ||
        (key === "url" &&
          (/media|gallery|logo/i.test(parent) ||
            (typeof object.mimeType === "string" &&
              object.mimeType.startsWith("image/")) ||
            "mediaId" in object));
      if (image && typeof item === "string" && item) {
        try {
          result[key] = knownOnly
            ? await this.knownMedia(item)
            : await this.media(item);
        } catch (error) {
          if (strict) throw error;
          result[key] = "";
        }
      } else if (key === "body" && typeof item === "string")
        result[key] = item.replace(/<img\b[^>]*>/gi, "");
      else
        result[key] = await this.localize(
          item,
          key === "url" ? parent : key,
          strict,
          knownOnly,
        );
    }
    return result;
  }
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    if (!this.matches(url, init.method || "GET"))
      throw new Error("non_public_resource");
    const headers = new Headers(init.headers);
    const locale = headers.get("x-locale") === "en" ? "en" : "pt-BR";
    headers.set("x-locale", locale);
    init = { ...init, headers };
    const key = "content-" + digest(this.clientId + "|" + locale + "|" + url);
    const cached = await this.read(key);
    const refresh = () => {
      const running = this.pending.get(key);
      if (running) return running;
      const task = (async () => {
        const response = await this.request(url, {
          ...init,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        });
        if ([401, 403, 404, 410].includes(response.status)) {
          await unlink(this.file(key)).catch(() => {});
          throw new Error("content_unavailable");
        }
        if (!response.ok) throw new Error("content_unavailable");
        if (Number(response.headers.get("content-length")) > 8388608)
          throw new Error("content_too_large");
        const text = response.status === 204 ? "" : await response.text();
        if (text.length > 8388608) throw new Error("content_too_large");
        const data = response.status === 204 ? null : JSON.parse(text);
        if (
          url.includes("/public-profile") &&
          (!data ||
            data.clientId !== this.clientId ||
            data.isPublished !== true ||
            !Array.isArray(data.translations) ||
            !data.translations.some(
              (translation: { displayName?: unknown }) =>
                typeof translation?.displayName === "string" &&
                translation.displayName.trim(),
            ))
        ) {
          await unlink(this.file(key)).catch(() => {});
          throw new Error("content_unavailable");
        }
        if (data !== null && typeof data !== "object")
          throw new Error("invalid_content");
        const resource = new URL(url).pathname.split("/").pop();
        if (
          response.status !== 204 &&
          [
            "gallery",
            "accommodation-categories",
            "accommodations",
            "rate-plans",
            "reviews",
            "property-content-sections",
          ].includes(resource || "") &&
          !Array.isArray(data)
        )
          throw new Error("invalid_content");

        const entry: Entry = {
          version: 1,
          savedAt: Date.now(),
          checkedAt: Date.now(),
          status: response.status,
          data: await this.localize(
            data,
            new URL(url).pathname.split("/").pop(),
            Boolean(cached),
          ),
        };
        await this.save(key, entry);
        await this.prune();
        return entry;
      })().finally(() => this.pending.delete(key));
      this.pending.set(key, task);
      return task;
    };
    let entry = cached;
    if (!entry) {
      if ((this.retryAfter.get(key) || 0) > Date.now())
        return new Response(null, { status: 503 });
      try {
        entry = await refresh();
      } catch {
        this.retryAfter.set(key, Date.now() + 30000);
        return new Response(null, { status: 503 });
      }
    } else if (
      Date.now() - entry.checkedAt >= this.interval &&
      (this.retryAfter.get(key) || 0) <= Date.now()
    ) {
      void refresh().catch(() => this.retryAfter.set(key, Date.now() + 30000));
    }
    return new Response(
      entry.status === 204 ? null : JSON.stringify(entry.data),
      { status: entry.status, headers: { "Content-Type": "application/json" } },
    );
  }
  async image(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    try {
      const metadata = JSON.parse(
        await readFile(this.file("image-" + id), "utf8"),
      );
      if (!IMAGE_TYPES.has(metadata.mime)) return null;
      return {
        bytes: await readFile(path.join(this.root, id + ".bin")),
        mime: metadata.mime,
      };
    } catch {
      return null;
    }
  }
  private async prune() {
    // Keep all media referenced by valid snapshots. Drop only old, unreferenced files.
    const files = await readdir(this.root),
      references = new Set<string>();
    for (const file of files.filter((f) => f.startsWith("content-"))) {
      const text = await readFile(path.join(this.root, file), "utf8").catch(
        () => "",
      );
      for (const match of text.matchAll(/\/api\/site-media\/([a-f0-9]{64})/g))
        references.add(match[1]);
    }
    for (const file of files.filter((f) => f.endsWith(".bin"))) {
      const id = file.slice(0, -4),
        info = await stat(path.join(this.root, file)).catch(() => null);
      if (!info) continue;
      if (!references.has(id) && Date.now() - info.mtimeMs > 2592000000) {
        await unlink(path.join(this.root, file)).catch(() => {});
        await unlink(this.file("image-" + id)).catch(() => {});
      }
    }
  }
}
