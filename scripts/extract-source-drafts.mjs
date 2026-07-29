import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

const answerPattern = /\b(?:correct|right)\s+answers?\b/i;
const questionMarkerPattern =
  /\b(?:question\s*(?:number|no\.?)?\s*(?:\d{1,3}(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|one|two|three|four|five|six|seven|eight|nine|ten)|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+question)\b/i;

function joinText(captions, start, end) {
  return captions
    .slice(start, end)
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function findQuestionStart(captions, lowerBound, answerIndex) {
  let markerIndex = -1;
  for (let index = lowerBound; index < answerIndex; index += 1) {
    const rollingText = `${captions[index].text} ${captions[index + 1]?.text ?? ""}`;
    if (questionMarkerPattern.test(rollingText)) markerIndex = index;
  }
  if (markerIndex >= 0) return markerIndex;

  let gapStart = lowerBound;
  for (let index = lowerBound + 1; index < answerIndex; index += 1) {
    const previous = captions[index - 1];
    const current = captions[index];
    const previousEnd =
      previous.startSeconds + Math.max(previous.durationSeconds ?? 0, 0);
    if (
      current.startSeconds - previousEnd >= 3.5 ||
      current.startSeconds - previous.startSeconds >= 4.5
    ) {
      gapStart = index;
    }
  }
  return gapStart;
}

function cleanPrompt(value) {
  return value
    .replace(
      /^.*?(?:now\s+)?(?:question\s*(?:number|no\.?)?\s*(?:\d{1,3}(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|one|two|three|four|five|six|seven|eight|nine|ten)|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+question)(?:\s+of\s+the\s+series)?[.:\s-]*/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function parseAnswerAndExplanation(value) {
  const withoutLead = value
    .replace(
      /^.*?\b(?:correct|right)\s+answers?\b(?:\s+here)?(?:\s+will\s+be|\s+is)?[.:\s-]*/i,
      ""
    )
    .trim();
  const boundary = withoutLead.search(
    /\b(?:explanation|this is because|because|why others are incorrect)\b/i
  );
  const statedAnswer =
    boundary >= 0 ? withoutLead.slice(0, boundary).trim() : withoutLead.trim();
  const explanationSource =
    boundary >= 0 ? withoutLead.slice(boundary).trim() : "";
  const explanation = explanationSource
    .replace(/^(?:explanation[.:\s-]*|this is because\s*|because\s*)/i, "")
    .split(/\bwhy others are incorrect\b/i)[0]
    .replace(/\s+/g, " ")
    .trim();

  return { statedAnswer, explanation };
}

function revealScore(captions, index) {
  const text = captions[index].text;
  const following = `${text} ${captions[index + 1]?.text ?? ""}`;
  let score = 1;
  if (/\b(?:will be|answer is|is option)\b/i.test(following)) score += 10;
  if (/\b(?:option [a-e]|amazon|aws|use|create|build|implement|enable|decrease|increase|select|provide|develop)\b/i.test(following)) {
    score += 3;
  }
  if (/\b(?:guess|pause|take (?:your )?time|reveal)\b/i.test(text)) score -= 10;
  if (
    /\b(?:this is|that is|is the|only)\s+(?:the\s+)?correct answer\b/i.test(
      text
    ) ||
    /\bcorrect answer\b.*\bnow question\b/i.test(text)
  ) {
    score -= 8;
  }
  return score;
}

function selectAnswerIndexes(captions, expectedCount) {
  const candidates = captions
    .map((segment, index) =>
      answerPattern.test(segment.text)
        ? {
            index,
            timestampSeconds: segment.startSeconds,
            score: revealScore(captions, index)
          }
        : undefined
    )
    .filter(Boolean);

  if (candidates.length === expectedCount) {
    return candidates.map((candidate) => candidate.index);
  }

  const minimumGapSeconds = 18;
  const states = candidates.map(() =>
    Array.from({ length: expectedCount + 1 }, () => undefined)
  );

  for (let index = 0; index < candidates.length; index += 1) {
    states[index][1] = {
      score: candidates[index].score,
      indexes: [candidates[index].index]
    };
    for (let count = 2; count <= expectedCount; count += 1) {
      for (let previous = 0; previous < index; previous += 1) {
        const priorState = states[previous][count - 1];
        if (!priorState) continue;
        if (
          candidates[index].timestampSeconds -
            candidates[previous].timestampSeconds <
          minimumGapSeconds
        ) {
          continue;
        }
        const nextState = {
          score: priorState.score + candidates[index].score,
          indexes: [...priorState.indexes, candidates[index].index]
        };
        if (
          !states[index][count] ||
          nextState.score > states[index][count].score
        ) {
          states[index][count] = nextState;
        }
      }
    }
  }

  const best = states
    .map((state) => state[expectedCount])
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)[0];
  return best?.indexes ?? [];
}

export function segmentCaptionQuestions(
  captions,
  expectedCount,
  firstQuestionNumber = 1
) {
  const dedupedAnswerIndexes = selectAnswerIndexes(captions, expectedCount);

  if (dedupedAnswerIndexes.length !== expectedCount) {
    return [];
  }

  const questionStarts = dedupedAnswerIndexes.map((answerIndex, index) =>
    findQuestionStart(
      captions,
      index === 0 ? 0 : dedupedAnswerIndexes[index - 1] + 1,
      answerIndex
    )
  );

  return dedupedAnswerIndexes.map((answerIndex, index) => {
    const questionStart = questionStarts[index];
    const nextQuestionStart = questionStarts[index + 1] ?? captions.length;
    const prompt = cleanPrompt(joinText(captions, questionStart, answerIndex));
    const answerBlock = joinText(captions, answerIndex, nextQuestionStart);
    const { statedAnswer, explanation } =
      parseAnswerAndExplanation(answerBlock);

    return {
      questionNumber: firstQuestionNumber + index,
      timestampSeconds: Math.floor(captions[questionStart].startSeconds),
      prompt,
      statedAnswer,
      explanation
    };
  });
}

async function main() {
  const [audit, captionCache] = await Promise.all([
    readFile(path.join(root, "public", "data", "source-audit.json"), "utf8").then(
      JSON.parse
    ),
    readFile(path.join(root, ".source-cache", "captions.json"), "utf8").then(
      JSON.parse
    )
  ]);

  const grouped = Map.groupBy(audit, (entry) => entry.videoId);
  const drafts = [];
  const unresolved = [];

  for (const [videoId, entries] of grouped) {
    const captions = captionCache[videoId] ?? [];
    if (captions.length === 0) {
      unresolved.push({ videoId, expected: entries.length, recovered: 0 });
      continue;
    }
    const orderedEntries = [...entries].sort(
      (left, right) => left.questionNumber - right.questionNumber
    );
    const recovered = segmentCaptionQuestions(
      captions,
      entries.length,
      orderedEntries[0].questionNumber
    );
    if (recovered.length !== entries.length) {
      const answerCount = captions.filter((segment) =>
        answerPattern.test(segment.text)
      ).length;
      unresolved.push({
        videoId,
        expected: entries.length,
        recovered: recovered.length,
        answerMarkers: answerCount
      });
      continue;
    }

    for (const draft of recovered) {
      drafts.push({
        sourceKey: `${videoId}:${draft.questionNumber}`,
        videoId,
        ...draft
      });
    }
  }

  await writeFile(
    path.join(root, ".source-cache", "source-drafts.json"),
    `${JSON.stringify(drafts, null, 2)}\n`
  );
  console.log(
    JSON.stringify(
      { recovered: drafts.length, unresolvedVideos: unresolved },
      null,
      2
    )
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
