import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const numberWords = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
  ["sixteen", 16],
  ["seventeen", 17],
  ["eighteen", 18],
  ["nineteen", 19],
  ["twenty", 20],
  ["twenty one", 21],
  ["twenty two", 22],
  ["twenty three", 23],
  ["twenty four", 24],
  ["twenty five", 25],
  ["first", 1],
  ["second", 2],
  ["third", 3],
  ["fourth", 4],
  ["fifth", 5],
  ["sixth", 6],
  ["seventh", 7],
  ["eighth", 8],
  ["ninth", 9],
  ["tenth", 10]
]);

function inferDeclaredRange(video) {
  const range = video.title.match(/\((\d+)\s*-\s*(\d+)\)/);
  if (range) {
    return {
      first: Number(range[1]),
      last: Number(range[2])
    };
  }

  const count = video.title.match(/\b(\d+)\s+exam style questions\b/i);
  if (count) {
    return { first: 1, last: Number(count[1]) };
  }

  if (video.playlistId === "PLMdFrZK3uZdev_uAoHZj-6lO55erQ6zd_") {
    const part = video.title.match(/\bpart\s*[-:]?\s*(\d{1,2})\b/i);
    if (part) {
      const partNumber = Number(part[1]);
      return {
        first: (partNumber - 1) * 10 + 1,
        last: partNumber * 10
      };
    }
  }

  return undefined;
}

function markerNumber(value) {
  const normalized = value
    .toLowerCase()
    .replace(/(\d+)(?:st|nd|rd|th)\b/, "$1")
    .replace(/-/g, " ")
    .trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return numberWords.get(normalized);
}

function findQuestionMarkers(captions) {
  const markers = [];
  const pattern =
    /\bquestion\s*(?:number|no\.?)?\s*(\d{1,3}(?:st|nd|rd|th)?|twenty[- ](?:one|two|three|four|five)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i;

  for (let index = 0; index < captions.length; index += 1) {
    const segment = captions[index];
    const match = segment.text.match(pattern);
    if (!match) continue;
    const number = markerNumber(match[1]);
    if (!number) continue;
    const previous = markers.at(-1);
    if (
      previous &&
      previous.number === number &&
      segment.startSeconds - previous.timestampSeconds < 8
    ) {
      continue;
    }
    markers.push({
      number,
      timestampSeconds: Math.floor(segment.startSeconds),
      captionIndex: index
    });
  }

  return markers;
}

function excerptAt(captions, index) {
  return captions
    .slice(index, index + 8)
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 420);
}

function statedAnswerAt(captions, startIndex, endIndex) {
  const text = captions
    .slice(startIndex, endIndex)
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ");
  const match = text.match(
    /(?:correct answer|answer is|right answer)\s*(?:is|:)?\s*([^.!?]{1,180})/i
  );
  return match?.[1]?.trim() ?? "";
}

function buildKnownRangeEntries(video, captions, range, markers) {
  const total = range.last - range.first + 1;
  return Array.from({ length: total }, (_, offset) => {
    const globalNumber = range.first + offset;
    const marker =
      markers.find((item) => item.number === globalNumber) ??
      markers.find((item) => item.number === offset + 1);
    const timestampSeconds =
      marker?.timestampSeconds ??
      Math.floor((video.durationSeconds * offset) / total);
    const captionIndex =
      marker?.captionIndex ??
      captions.findIndex(
        (segment) => segment.startSeconds >= timestampSeconds
      );
    const nextMarker = markers.find(
      (item) => item.timestampSeconds > timestampSeconds
    );

    return {
      sourceKey: `${video.videoId}:${globalNumber}`,
      playlistId: video.playlistId,
      videoId: video.videoId,
      videoTitle: video.title,
      sourceUrl: `${video.url}&t=${timestampSeconds}s`,
      questionNumber: globalNumber,
      timestampSeconds,
      promptSummary: excerptAt(captions, Math.max(0, captionIndex)),
      statedAnswer: statedAnswerAt(
        captions,
        Math.max(0, captionIndex),
        nextMarker?.captionIndex ?? captions.length
      ),
      status: "pending",
      reason: marker
        ? "Recovered from the captioned question marker; awaiting answer verification."
        : "Declared by the video title range; timestamp estimated for manual verification."
    };
  });
}

function buildMarkerEntries(video, captions, markers) {
  return markers.map((marker, index) => {
    const next = markers[index + 1];
    return {
      sourceKey: `${video.videoId}:${marker.number}`,
      playlistId: video.playlistId,
      videoId: video.videoId,
      videoTitle: video.title,
      sourceUrl: `${video.url}&t=${marker.timestampSeconds}s`,
      questionNumber: marker.number,
      timestampSeconds: marker.timestampSeconds,
      promptSummary: excerptAt(captions, marker.captionIndex),
      statedAnswer: statedAnswerAt(
        captions,
        marker.captionIndex,
        next?.captionIndex ?? captions.length
      ),
      status: "pending",
      reason:
        "Recovered from the captioned question marker; awaiting answer verification."
    };
  });
}

async function main() {
  const videos = JSON.parse(
    await readFile(
      path.join(root, "public", "data", "source-videos.json"),
      "utf8"
    )
  );
  const captionCache = JSON.parse(
    await readFile(
      path.join(root, ".source-cache", "captions.json"),
      "utf8"
    )
  );

  const audit = [];
  for (const video of videos.filter((item) => item.kind === "questions")) {
    const captions = captionCache[video.videoId] ?? [];
    const markers = findQuestionMarkers(captions);
    const range = inferDeclaredRange(video);
    const entries = range
      ? buildKnownRangeEntries(video, captions, range, markers)
      : buildMarkerEntries(video, captions, markers);

    if (entries.length === 0) {
      audit.push({
        sourceKey: `${video.videoId}:unresolved`,
        playlistId: video.playlistId,
        videoId: video.videoId,
        videoTitle: video.title,
        sourceUrl: video.url,
        questionNumber: 0,
        timestampSeconds: 0,
        promptSummary: "",
        statedAnswer: "",
        status: "excluded",
        reason:
          "No distinct practice-question markers were recoverable from the available captions."
      });
    } else {
      audit.push(...entries);
    }
  }

  audit.sort(
    (left, right) =>
      videos.findIndex((video) => video.videoId === left.videoId) -
        videos.findIndex((video) => video.videoId === right.videoId) ||
      left.questionNumber - right.questionNumber
  );

  await writeFile(
    path.join(root, "public", "data", "source-audit.json"),
    `${JSON.stringify(audit, null, 2)}\n`
  );

  const counts = audit.reduce((result, entry) => {
    result[entry.videoId] = (result[entry.videoId] ?? 0) + 1;
    return result;
  }, {});
  console.log(JSON.stringify({ total: audit.length, byVideo: counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
