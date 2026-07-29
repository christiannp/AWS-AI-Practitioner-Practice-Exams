import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(__dirname, "..");

const playlistSeeds = {
  PLwRKAmP13yer3GDXZlAXt20u7qp9U6fBf: "b7m5BOwufLI",
  "PLMdFrZK3uZdev_uAoHZj-6lO55erQ6zd_": "yrkju-Ch7ME"
};

const headers = {
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
};

function extractAssignedJson(html, markers) {
  for (const marker of markers) {
    let start = html.indexOf(marker);
    if (start < 0) continue;
    start += marker.length;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < html.length; index += 1) {
      const character = html[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(html.slice(start, index + 1));
        }
      }
    }
  }

  throw new Error(`Could not find assigned JSON marker: ${markers.join(", ")}`);
}

function textFromRuns(value) {
  return (
    value?.simpleText ??
    value?.runs?.map((run) => run.text).join("") ??
    ""
  );
}

function collectPlaylistVideos(value, playlistId, output = []) {
  if (!value || typeof value !== "object") return output;

  const renderer =
    value.playlistPanelVideoRenderer ?? value.playlistVideoRenderer;
  if (renderer?.videoId) {
    output.push({
      playlistId,
      videoId: renderer.videoId,
      title: textFromRuns(renderer.title),
      durationText: textFromRuns(renderer.lengthText)
    });
  }

  for (const child of Object.values(value)) {
    collectPlaylistVideos(child, playlistId, output);
  }

  return output;
}

function parseDuration(durationText) {
  const parts = durationText.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((seconds, value) => seconds * 60 + value, 0);
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function captionsFromJson3(payload) {
  return (payload.events ?? [])
    .filter((event) => Array.isArray(event.segs))
    .map((event) => ({
      startSeconds: (event.tStartMs ?? 0) / 1000,
      durationSeconds: (event.dDurationMs ?? 0) / 1000,
      text: event.segs.map((segment) => segment.utf8 ?? "").join("").trim()
    }))
    .filter((segment) => segment.text.length > 0);
}

export function captionsFromXml(xml) {
  const legacy = [
    ...xml.matchAll(
      /<text start="([^"]+)" dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
    )
  ].map((match) => ({
      startSeconds: Number(match[1]),
      durationSeconds: Number(match[2]),
      text: decodeEntities(match[3].replace(/<[^>]+>/g, " ")).trim()
    }));

  if (legacy.length > 0) {
    return legacy.filter((segment) => segment.text.length > 0);
  }

  return [...xml.matchAll(/<p\s+([^>]*)>([\s\S]*?)<\/p>/g)]
    .map((match) => {
      const start = match[1].match(/\bt="(\d+)"/)?.[1];
      const duration = match[1].match(/\bd="(\d+)"/)?.[1] ?? "0";
      const text = [...match[2].matchAll(/<s(?:\s+[^>]*)?>([\s\S]*?)<\/s>/g)]
        .map((word) => decodeEntities(word[1].replace(/<[^>]+>/g, "")))
        .join("")
        .replace(/\s+/g, " ")
        .trim();

      return {
        startSeconds: Number(start ?? 0) / 1000,
        durationSeconds: Number(duration) / 1000,
        text
      };
    })
    .filter((segment) => segment.text.length > 0);
}

async function fetchText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`YouTube request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

async function fetchCaptions(videoId) {
  const html = await fetchText(`https://www.youtube.com/watch?v=${videoId}`);
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  if (!apiKey) {
    throw new Error(`YouTube page did not expose an API key for ${videoId}`);
  }

  const playerResponse = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent":
          "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip"
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 34
          }
        },
        videoId
      })
    }
  );
  if (!playerResponse.ok) {
    throw new Error(
      `YouTube player request failed (${playerResponse.status}) for ${videoId}`
    );
  }
  const player = await playerResponse.json();
  const tracks =
    player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track =
    tracks.find((candidate) => candidate.languageCode === "en") ?? tracks[0];

  if (!track?.baseUrl) {
    return {
      title: player.videoDetails?.title ?? "",
      durationSeconds: Number(player.videoDetails?.lengthSeconds ?? 0),
      captions: [],
      captionKind: "none"
    };
  }

  const captionResponse = await fetch(track.baseUrl, {
    headers: {
      "user-agent":
        "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip"
    }
  });
  if (!captionResponse.ok) {
    throw new Error(
      `YouTube caption request failed (${captionResponse.status}) for ${videoId}`
    );
  }
  const captionBody = await captionResponse.text();
  let captions = captionsFromXml(captionBody);
  if (captions.length === 0) {
    try {
      captions = captionsFromJson3(JSON.parse(captionBody));
    } catch {
      captions = [];
    }
  }

  return {
    title: player.videoDetails?.title ?? "",
    durationSeconds: Number(player.videoDetails?.lengthSeconds ?? 0),
    captions,
    captionKind: track.kind === "asr" ? "auto" : "manual"
  };
}

async function fetchPlaylist(playlistId, seedVideoId) {
  const html = await fetchText(
    `https://www.youtube.com/watch?v=${seedVideoId}&list=${playlistId}`
  );
  const initialData = extractAssignedJson(html, [
    "var ytInitialData = ",
    "ytInitialData = "
  ]);
  const rawVideos = collectPlaylistVideos(initialData, playlistId);
  const deduped = [...new Map(rawVideos.map((video) => [video.videoId, video])).values()];

  return deduped.map((video, index) => ({
    ...video,
    playlistPosition: index + 1
  }));
}

async function main() {
  const requested =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2)
      : Object.keys(playlistSeeds);

  const videos = [];
  const captionCache = {};

  for (const playlistId of requested) {
    const seed = playlistSeeds[playlistId];
    if (!seed) throw new Error(`Unknown playlist ID: ${playlistId}`);
    const playlistVideos = await fetchPlaylist(playlistId, seed);

    for (const video of playlistVideos) {
      const details = await fetchCaptions(video.videoId);
      const title = details.title || video.title;
      const informational =
        /exam details|qualifying score|practitioner result/i.test(title);

      videos.push({
        playlistId,
        playlistPosition: video.playlistPosition,
        videoId: video.videoId,
        title,
        url: `https://www.youtube.com/watch?v=${video.videoId}&list=${playlistId}`,
        durationSeconds:
          details.durationSeconds || parseDuration(video.durationText),
        kind: informational ? "informational" : "questions",
        captionKind: details.captionKind,
        captionSegmentCount: details.captions.length
      });
      captionCache[video.videoId] = details.captions;
      process.stdout.write(
        `${playlistId} ${video.playlistPosition}/${playlistVideos.length} ${video.videoId} ${details.captions.length} captions\n`
      );
    }
  }

  await mkdir(path.join(root, "public", "data"), { recursive: true });
  await mkdir(path.join(root, ".source-cache"), { recursive: true });
  await writeFile(
    path.join(root, "public", "data", "source-videos.json"),
    `${JSON.stringify(videos, null, 2)}\n`
  );
  await writeFile(
    path.join(root, ".source-cache", "captions.json"),
    `${JSON.stringify(captionCache, null, 2)}\n`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
