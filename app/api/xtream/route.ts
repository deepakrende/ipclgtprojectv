import { NextRequest, NextResponse } from "next/server";

// ---- helpers -------------------------------------------------------------

function normalizeServer(server: string) {
  // strip trailing slash so `${server}/player_api.php` never double-slashes
  return server.trim().replace(/\/+$/, "");
}

async function xtreamGet(server: string, username: string, password: string, extraParams: Record<string, string> = {}) {
  const url = new URL(`${server}/player_api.php`);
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);
  for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    // Xtream panels are frequently self-signed / plain http; avoid caching stale creds
    cache: "no-store",
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Provider did not return valid data. Check the server URL.");
  }
  if (!res.ok) throw new Error(json?.message || "Provider rejected the request.");
  return json;
}

function extForStream(streamExt?: string, fallback = "m3u8") {
  return streamExt && typeof streamExt === "string" ? streamExt : fallback;
}

// ---- POST: initial login / library load ----------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body?.mode === "m3u" ? "m3u" : "xtream";

    if (mode === "m3u") {
      const m3uUrl = String(body?.m3u || "").trim();
      if (!m3uUrl) return NextResponse.json({ error: "Playlist URL is required." }, { status: 400 });

      const res = await fetch(m3uUrl, { cache: "no-store" });
      if (!res.ok) return NextResponse.json({ error: "Could not fetch that playlist URL." }, { status: 400 });
      const text = await res.text();

      const lines = text.split(/\r?\n/);
      const channels: any[] = [];
      const categories = new Set<string>();
      let pending: { name: string; logo?: string; category?: string } | null = null;
      let idx = 0;

      for (const line of lines) {
        if (line.startsWith("#EXTINF")) {
          const nameMatch = line.match(/,(.*)$/);
          const logoMatch = line.match(/tvg-logo="([^"]*)"/);
          const groupMatch = line.match(/group-title="([^"]*)"/);
          pending = {
            name: nameMatch ? nameMatch[1].trim() : `Channel ${idx + 1}`,
            logo: logoMatch?.[1],
            category: groupMatch?.[1] || "General",
          };
        } else if (line.trim() && !line.startsWith("#") && pending) {
          idx += 1;
          categories.add(pending.category || "General");
          channels.push({
            id: String(idx),
            name: pending.name,
            stream: line.trim(),
            logo: pending.logo,
            category: pending.category,
            type: "live",
          });
          pending = null;
        }
      }

      return NextResponse.json({
        user: "Playlist",
        categories: [...categories],
        channels,
        movies: [],
        series: [],
        session: { mode: "m3u" },
      });
    }

    // --- xtream mode ---
    const server = normalizeServer(String(body?.server || ""));
    const username = String(body?.username || "");
    const password = String(body?.password || "");
    if (!server || !username || !password) {
      return NextResponse.json({ error: "Server, username and password are required." }, { status: 400 });
    }

    const auth = await xtreamGet(server, username, password);
    if (auth?.user_info?.auth !== 1) {
      return NextResponse.json({ error: "Invalid credentials or inactive subscription." }, { status: 401 });
    }

    const [liveCats, liveStreams, vodCats, vodStreams, seriesCats, seriesStreams] = await Promise.all([
      xtreamGet(server, username, password, { action: "get_live_categories" }),
      xtreamGet(server, username, password, { action: "get_live_streams" }),
      xtreamGet(server, username, password, { action: "get_vod_categories" }),
      xtreamGet(server, username, password, { action: "get_vod_streams" }),
      xtreamGet(server, username, password, { action: "get_series_categories" }),
      xtreamGet(server, username, password, { action: "get_series" }),
    ]);

    const catName = (list: any[], id: any) => list?.find((c) => String(c.category_id) === String(id))?.category_name || "General";

    const channels = (liveStreams || []).map((s: any) => ({
      id: String(s.stream_id),
      name: s.name,
      logo: s.stream_icon,
      category: catName(liveCats, s.category_id),
      type: "live",
      stream: `/api/stream?url=${encodeURIComponent(`${server}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${s.stream_id}.m3u8`)}`,
    }));

    const movies = (vodStreams || []).map((s: any) => ({
      id: String(s.stream_id),
      name: s.name,
      logo: s.stream_icon,
      category: catName(vodCats, s.category_id),
      type: "movie",
      extension: s.container_extension,
      stream: `/api/stream?url=${encodeURIComponent(`${server}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${s.stream_id}.${extForStream(s.container_extension, "mp4")}`)}`,
    }));

    const series = (seriesStreams || []).map((s: any) => ({
      id: String(s.series_id),
      name: s.name,
      logo: s.cover,
      category: catName(seriesCats, s.category_id),
      type: "series",
      stream: "",
    }));

    return NextResponse.json({
      user: auth?.user_info?.username || username,
      categories: [...liveCats].map((c: any) => c.category_name),
      channels,
      movies,
      series,
      session: { mode: "xtream", server, username, password },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unable to connect." }, { status: 500 });
  }
}

// ---- PUT: EPG lookups + series episode listing ----------------------------

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { server, username, password, action, id } = body || {};
    if (!server || !username || !password || !action || !id) {
      return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
    }
    const normalized = normalizeServer(server);

    if (action === "epg") {
      const data = await xtreamGet(normalized, username, password, { action: "get_short_epg", stream_id: String(id) });
      return NextResponse.json(data);
    }

    if (action === "series_info") {
      const data = await xtreamGet(normalized, username, password, { action: "get_series_info", series_id: String(id) });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Request failed." }, { status: 500 });
  }
}
