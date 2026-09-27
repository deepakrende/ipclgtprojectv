import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveUrl(base: string, maybeRelative: string) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function proxied(absoluteUrl: string) {
  return `/api/stream?url=${encodeURIComponent(absoluteUrl)}`;
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return new Response("Missing url", { status: 400 });

  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    decoded = target;
  }

  const range = req.headers.get("range") || undefined;

  let upstream: Response;
  try {
    upstream = await fetch(decoded, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
      redirect: "follow",
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Upstream error", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") || "";
  const isPlaylist =
    decoded.toLowerCase().split("?")[0].endsWith(".m3u8") ||
    contentType.includes("mpegurl");

  if (isPlaylist) {
    const text = await upstream.text();
    const base = upstream.url || decoded; // resolves relative segment paths even after redirects

    const rewritten = text
      .split(/\r?\n/)
      .map((line) => {
        if (!line.trim()) return line;

        // rewrite absolute URIs embedded in tag attributes, e.g. #EXT-X-KEY:URI="..."
        if (line.startsWith("#")) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch) {
            const abs = resolveUrl(base, uriMatch[1]);
            return line.replace(uriMatch[1], proxied(abs));
          }
          return line;
        }

        // a segment or nested playlist reference
        const abs = resolveUrl(base, line.trim());
        return proxied(abs);
      })
      .join("\n");

    return new Response(rewritten, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }

  // binary passthrough: video segments, mp4 files, etc.
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("access-control-allow-origin", "*");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
