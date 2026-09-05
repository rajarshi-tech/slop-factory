import re
import json
import ollama

from app.llm.base import LLMProvider
from app.llm.factory import create_llm
from app.utils.storage import youtube_video_dir, load_config


# ============================================================
# CONFIG
# ============================================================

#MODEL = "qwen3:8b"

# Transcript chunking
CHUNK_SIZE = 100
CHUNK_OVERLAP = 25

# Candidate discovery
MAX_CANDIDATES_PER_CHUNK = 8

# Final output
MAX_FINAL_CLIPS = 10

# Clip duration
MIN_CLIP_LENGTH = 15
PREFERRED_MIN_LENGTH = 25
PREFERRED_MAX_LENGTH = 90
MAX_CLIP_LENGTH = 120

# Minimum score required for a clip to survive final filtering
MIN_SCORE = 70


# ============================================================
# VTT PARSING
# ============================================================

def timestamp_to_seconds(timestamp):
    """Convert VTT timestamp to seconds."""

    timestamp = timestamp.split()[0]
    timestamp = timestamp.replace(",", ".")

    parts = timestamp.split(":")

    if len(parts) == 3:
        hours, minutes, seconds = parts

    elif len(parts) == 2:
        hours = 0
        minutes, seconds = parts

    else:
        raise ValueError(f"Invalid timestamp: {timestamp}")

    return (
        int(hours) * 3600
        + int(minutes) * 60
        + float(seconds)
    )


def _normalize_caption_for_comparison(text):
    """Normalize caption text for rolling-caption comparisons."""
    text = re.sub(r"<[^>]+>", "", text or "")
    text = text.lower()
    text = re.sub(r"[^\w\s']", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def _split_sentences(text):
    """
    Split caption text at sentence punctuation while preserving the original
    text as much as possible.
    """
    parts = re.split(r"(?<=[.!?。！？])\s+", text.strip())
    return [part.strip() for part in parts if part.strip()]


def _is_growing_caption(previous_text, current_text):
    """
    Return True when current_text looks like a later, more complete version
    of previous_text.

    Rolling VTT captions commonly look like:
        "I think"
        "I think this"
        "I think this is important."

    We only treat this as duplication when one normalized caption is a
    substantial word-prefix of the other. This avoids collapsing ordinary
    repeated speech.
    """
    previous = _normalize_caption_for_comparison(previous_text)
    current = _normalize_caption_for_comparison(current_text)

    if not previous or not current or previous == current:
        return bool(previous and current)

    previous_words = previous.split()
    current_words = current.split()

    if len(previous_words) < 2 or len(current_words) <= len(previous_words):
        return False

    # Require the complete earlier caption to be the beginning of the
    # later caption.
    return current_words[:len(previous_words)] == previous_words


def clean_rolling_caption_duplicates(subtitles):
    """
    Collapse progressive/rolling VTT captions before transcript chunking.

    The cleaner:
      1. collapses consecutive captions that are growing versions of the
         same speech fragment;
      2. prefers the latest/most complete version;
      3. removes repeated sentence fragments when they are exact duplicates;
      4. leaves unrelated captions untouched.

    Timestamps are retained from the complete/latest caption, which is the
    version that contains the most complete text.
    """
    if not subtitles:
        return []

    cleaned = []

    for subtitle in subtitles:
        current = dict(subtitle)
        current_text = current["text"]

        # Compare against the most recent surviving caption. Rolling
        # captions normally overlap in time or occur immediately after one
        # another.
        if cleaned:
            previous = cleaned[-1]
            temporal_gap = current["start"] - previous["end"]

            same_caption_window = (
                temporal_gap <= 1.0
                and current["start"] <= previous["end"] + 1.0
            )

            if same_caption_window and _is_growing_caption(
                previous["text"],
                current_text
            ):
                # The current caption is the more complete version.
                cleaned[-1] = current
                continue

            # If the two captions are effectively identical, retain the
            # later timestamped version.
            prev_norm = _normalize_caption_for_comparison(previous["text"])
            curr_norm = _normalize_caption_for_comparison(current_text)

            if (
                same_caption_window
                and prev_norm
                and prev_norm == curr_norm
            ):
                cleaned[-1] = current
                continue

        cleaned.append(current)

    # Remove duplicated sentence fragments that survived the rolling pass.
    # This is deliberately conservative: only adjacent captions are merged
    # when a sentence is repeated verbatim.
    final = []

    for subtitle in cleaned:
        current = dict(subtitle)

        if final:
            previous = final[-1]
            previous_sentences = _split_sentences(previous["text"])
            current_sentences = _split_sentences(current["text"])

            previous_norm = {
                _normalize_caption_for_comparison(sentence)
                for sentence in previous_sentences
            }

            # If the current caption consists only of sentences already
            # present in the immediately preceding caption, keep the latest
            # timestamped copy.
            current_norm = [
                _normalize_caption_for_comparison(sentence)
                for sentence in current_sentences
            ]

            if (
                current_norm
                and all(sentence in previous_norm for sentence in current_norm)
            ):
                final[-1] = current
                continue

        final.append(current)

    return final


def vtt_to_json(vtt_file):
    """Convert VTT subtitles into timestamped, cleaned transcript entries."""

    with open(vtt_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove WEBVTT header
    content = re.sub(
        r"^WEBVTT.*?\n",
        "",
        content,
        count=1,
        flags=re.DOTALL
    )

    subtitles = []

    blocks = re.split(r"\n\n+", content.strip())

    for block in blocks:

        lines = block.splitlines()

        timestamp = None
        text_lines = []

        for line in lines:

            if "-->" in line:

                parts = line.split("-->")

                timestamp = (
                    parts[0].strip()
                    + " --> "
                    + parts[1].strip().split()[0]
                )

            elif timestamp:

                text_lines.append(line)

        if timestamp:

            start, end = [
                x.strip()
                for x in timestamp.split("-->")
            ]

            text = " ".join(text_lines)

            # Remove VTT formatting
            text = re.sub(r"<[^>]+>", "", text)

            # Normalize whitespace
            text = re.sub(r"\s+", " ", text).strip()

            if text:

                subtitles.append({
                    "start": timestamp_to_seconds(start),
                    "end": timestamp_to_seconds(end),
                    "text": text
                })

    # IMPORTANT:
    # Clean rolling/progressive captions before anything is chunked or sent
    # to the LLM. This prevents the same growing speech fragment from being
    # interpreted as multiple separate pieces of content.
    return clean_rolling_caption_duplicates(subtitles)

def chunk_transcript(
    transcript,
    chunk_size=CHUNK_SIZE,
    overlap=CHUNK_OVERLAP
):
    """
    Create overlapping transcript chunks.

    Example:

        0 - 100
        75 - 175
        150 - 250
    """

    if not transcript:
        return []

    chunks = []

    step = max(1, chunk_size - overlap)

    for start in range(0, len(transcript), step):

        chunk = transcript[start:start + chunk_size]

        if not chunk:
            break

        chunks.append(chunk)

        if start + chunk_size >= len(transcript):
            break

    return chunks


def format_transcript(entries):
    """
    Convert transcript entries into a compact format
    that is easy for the LLM to reason about.
    """

    lines = []

    for item in entries:

        lines.append(
            f"[{item['start']:.2f} - {item['end']:.2f}] "
            f"{item['text']}"
        )

    return "\n".join(lines)


# ============================================================
# PASS 1 — CANDIDATE DISCOVERY
# ============================================================

def create_candidate_prompt(chunk):

    transcript_text = format_transcript(chunk)

    return f"""
You are an expert short-form video editor.

You are analyzing part of a long-form video and looking for moments
that could become strong YouTube Shorts, TikToks, or Instagram Reels.

Your job in this step is CANDIDATE DISCOVERY.

Do NOT try to make the final editorial decision yet.

Find moments that have clear potential to become engaging short-form
videos.

## WHAT TO LOOK FOR

Prioritize moments containing things such as:

- surprising revelations
- unusual facts
- strong opinions
- controversial opinions
- funny moments
- emotional moments
- compelling stories
- conflict or disagreement
- unexpected outcomes
- useful insights
- counterintuitive ideas
- impressive achievements
- failures or mistakes
- predictions
- interesting explanations
- questions that create curiosity
- strong reactions
- memorable statements
- stories with a payoff
- moments where something unexpected happens

Think like a professional Shorts editor.

Ask yourself:

"Would a viewer scrolling through Shorts have a reason to stop
and listen to this?"

## HOOKS

Strong candidates often contain a natural hook.

Examples:

- "I lost $2 million because of this."
- "Nobody tells you this about..."
- "I thought it was impossible until..."
- "The weirdest thing happened..."
- "Everyone gets this completely wrong."
- "I made one huge mistake..."
- "Here's what actually happened..."

DO NOT invent a hook.

The hook must naturally exist in what the speaker actually says.

The clip can begin before the strongest statement if some context is
necessary.

## CLIP LENGTH

Prefer approximately 25-90 seconds.

15-25 seconds is acceptable when the moment is exceptionally strong.

90-120 seconds is acceptable when the story genuinely requires it.

Do not artificially extend clips.

Do not reject a good moment simply because it is shorter than ideal.

## STANDALONE CONTENT

The eventual clip should ideally make sense to somebody who has never
seen the original video.

Avoid moments that obviously depend on a large amount of missing context.

However, do NOT reject a candidate just because it needs a small amount
of setup.

The next editorial pass will inspect surrounding transcript context.

## AVOID

Do not prioritize:

- greetings
- introductions
- sponsor messages
- advertisements
- housekeeping
- generic motivational statements
- filler
- repeated information
- rambling
- boring setup
- extremely context-dependent statements

## IMPORTANT

Do not assume that every complete idea is a good clip.

"Complete" is necessary but NOT sufficient.

We care about viewer interest.

At the same time, do not be excessively conservative.

This is candidate discovery.

If something has clear potential, include it and let the second
editorial pass decide.

Return up to {MAX_CANDIDATES_PER_CHUNK} candidates.

If there is genuinely nothing interesting, return [].

## TIMESTAMPS

Use timestamps from the transcript.

Do not invent timestamps.

The start and end should roughly surround the interesting moment.

Do not intentionally cut through a sentence.

## OUTPUT

Return ONLY valid JSON.

Return:

[
    {{
        "start": 123.45,
        "end": 178.90,
        "hook": "What makes the opening interesting",
        "topic": "What the moment is about"
    }}
]

No markdown.
No explanation.
No additional text.

Transcript:

{transcript_text}
"""


def create_candidate_schema():

    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "start": {
                    "type": "number"
                },
                "end": {
                    "type": "number"
                },
                "hook": {
                    "type": "string"
                },
                "topic": {
                    "type": "string"
                }
            },
            "required": [
                "start",
                "end",
                "hook",
                "topic"
            ]
        }
    }


def discover_candidates(chunk, llm: LLMProvider):

    prompt = create_candidate_prompt(chunk)

    output = llm.generate(
        prompt=prompt,
        response_schema=create_candidate_schema(),
    )

    try:

        parsed = json.loads(output)

        if not isinstance(parsed, list):
            return []

        return parsed

    except json.JSONDecodeError:

        print("Failed to parse candidate response.")
        print(output)

        return []


# ============================================================
# CANDIDATE DEDUPLICATION
# ============================================================

def _text_similarity(text_a, text_b):
    """
    Calculate a conservative lexical similarity score.

    This intentionally avoids another LLM call. Topic/title similarity is
    used as a second signal alongside timestamp overlap.
    """
    from difflib import SequenceMatcher

    a = _normalize_caption_for_comparison(text_a)
    b = _normalize_caption_for_comparison(text_b)

    if not a or not b:
        return 0.0

    if a == b:
        return 1.0

    a_words = set(a.split())
    b_words = set(b.split())

    if not a_words or not b_words:
        return 0.0

    jaccard = len(a_words & b_words) / len(a_words | b_words)
    sequence = SequenceMatcher(None, a, b).ratio()

    # Jaccard catches shared topic vocabulary; sequence catches similar
    # wording/order. Requiring both signals makes this less aggressive.
    return (0.6 * jaccard) + (0.4 * sequence)


def _topics_are_similar(topic_a, topic_b):
    """Return True only for strong topic/title similarity."""
    similarity = _text_similarity(topic_a, topic_b)

    if similarity >= 0.72:
        return True

    # Short topic strings can have lower lexical scores despite being the
    # same idea. Require substantial shared vocabulary in that case.
    a_words = set(_normalize_caption_for_comparison(topic_a).split())
    b_words = set(_normalize_caption_for_comparison(topic_b).split())

    if len(a_words) >= 2 and len(b_words) >= 2:
        shared = len(a_words & b_words)
        return shared >= 2 and shared / min(len(a_words), len(b_words)) >= 0.75

    return False


def deduplicate_candidates(candidates):

    valid_candidates = []

    for candidate in candidates:

        try:

            start = float(candidate["start"])
            end = float(candidate["end"])

        except (
            KeyError,
            TypeError,
            ValueError
        ):
            continue

        if end <= start:
            continue

        duration = end - start

        if duration < MIN_CLIP_LENGTH:
            continue

        if duration > MAX_CLIP_LENGTH:
            continue

        valid_candidates.append({
            "start": start,
            "end": end,
            "hook": candidate.get("hook", ""),
            "topic": candidate.get("topic", "")
        })

    # Sort chronologically
    valid_candidates.sort(
        key=lambda x: x["start"]
    )

    unique = []

    for candidate in valid_candidates:

        duplicate = False

        for existing in unique:

            overlap_start = max(
                candidate["start"],
                existing["start"]
            )

            overlap_end = min(
                candidate["end"],
                existing["end"]
            )

            overlap = max(
                0,
                overlap_end - overlap_start
            )

            candidate_duration = (
                candidate["end"] -
                candidate["start"]
            )

            existing_duration = (
                existing["end"] -
                existing["start"]
            )

            shorter_duration = min(
                candidate_duration,
                existing_duration
            )

            temporal_duplicate = (
                shorter_duration > 0
                and overlap / shorter_duration > 0.6
            )

            semantic_duplicate = _topics_are_similar(
                candidate.get("topic", ""),
                existing.get("topic", "")
            )

            # Keep the original strong temporal rule, but also catch
            # candidates that describe essentially the same editorial topic
            # even when their timestamps do not overlap much.
            if temporal_duplicate or semantic_duplicate:
                duplicate = True
                break

        if not duplicate:
            unique.append(candidate)

    return unique

# ============================================================
# PASS 2 — FINAL EDITOR
# ============================================================

def get_context_for_candidate(
    candidate,
    transcript,
    context_before=25,
    context_after=25
):
    """
    Give the final editor surrounding transcript context so it can
    improve the clip boundaries.
    """

    start = candidate["start"]
    end = candidate["end"]

    context_start = max(
        0,
        start - context_before
    )

    context_end = end + context_after

    return [
        item
        for item in transcript
        if item["end"] >= context_start
        and item["start"] <= context_end
    ]


def create_editor_prompt(
    candidate,
    context
):

    transcript_text = format_transcript(context)

    return f"""
You are the final editor for a short-form video clipping system.

Another AI found the candidate below.

Your job is to determine whether this is a GOOD short-form video,
and if it is, improve its timestamps.

Do NOT demand that the clip be perfect or guaranteed viral.

Your goal is to find the strongest publishable moments.

A good clip should have clear viewer appeal.

## EVALUATION

Consider:

1. Hook strength
2. Curiosity
3. Entertainment
4. Emotional impact
5. Interestingness
6. Information/value
7. Storytelling
8. Payoff
9. Standalone context
10. Natural beginning and ending

Not every category needs to be strong.

A clip can be good because it is funny.
Another can be good because it is surprising.
Another can be good because it tells a compelling story.

## HOOK

The beginning is extremely important.

Prefer starting with:

- a surprising statement
- a bold claim
- an unusual fact
- a provocative opinion
- an emotional statement
- an interesting story beginning
- a statement that creates curiosity

Avoid starting with unnecessary:

- greetings
- introductions
- filler
- generic setup
- repeated information

You MAY move the start timestamp.

If the candidate starts too early, remove boring setup.

If it starts too late, include the preceding context needed to
understand the hook.

Do not remove necessary setup merely to make the first sentence
sound more dramatic.

## PAYOFF

The clip should reach the interesting conclusion.

Do not end immediately after the hook.

Keep enough material to deliver the payoff.

You MAY move the end timestamp.

End after:

- the answer
- the punchline
- the revelation
- the conclusion
- the important statement
- the natural end of the story

Do not include unnecessary material after the payoff.

## CONTEXT

A viewer should be able to understand the clip without watching
the original video.

Reject the clip if understanding it requires a large amount of
missing conversation.

Small amounts of context are acceptable.

## LENGTH

Preferred: 25-90 seconds.

15-25 seconds is acceptable for a very strong moment.

90-120 seconds is acceptable for a compelling story or explanation.

Do not add filler just to reach a target length.

Do not shorten a good story just because it exceeds 90 seconds.

## IMPORTANT

Do NOT reject a clip merely because it is not extraordinary.

Select it if it has clear short-form potential.

Reject it when there is a concrete problem such as:

- mostly filler
- no interesting point
- incomplete thought
- no payoff
- extremely weak opening
- impossible to understand without missing context
- repetitive or redundant content

When uncertain, prefer selecting a reasonably interesting candidate.

## SCORE

Give the candidate a score from 0-100.

90-100 = exceptional
80-89 = very strong
70-79 = good and publishable
60-69 = mediocre
50-59 = weak
below 50 = poor

The score should represent realistic short-form potential,
NOT how important the information is.

A boring educational explanation should not receive a high score
just because the information is useful.

## CANDIDATE

Start: {candidate["start"]}
End: {candidate["end"]}

Potential hook:
{candidate["hook"]}

Topic:
{candidate["topic"]}

## SURROUNDING TRANSCRIPT

{transcript_text}

## OUTPUT

If the candidate is good enough to publish:

{{
    "selected": true,
    "start": 123.45,
    "end": 178.90,
    "score": 82,
    "title": "Why he walked away from a $300K salary",
    "reason": "The clip opens with a strong personal revelation, gives enough context to understand the decision, and ends with a clear payoff."
}}

If the candidate is weak:

{{
    "selected": false,
    "start": 0,
    "end": 0,
    "score": 40,
    "title": "",
    "reason": "The moment is informative but lacks enough viewer curiosity or payoff."
}}

Return ONLY valid JSON.
"""


def create_editor_schema():

    return {
        "type": "object",
        "properties": {
            "selected": {
                "type": "boolean"
            },
            "start": {
                "type": "number"
            },
            "end": {
                "type": "number"
            },
            "score": {
                "type": "number"
            },
            "title": {
                "type": "string"
            },
            "reason": {
                "type": "string"
            }
        },
        "required": [
            "selected",
            "start",
            "end",
            "score",
            "title",
            "reason"
        ]
    }


def refine_candidate(
    candidate,
    transcript,
    llm: LLMProvider
):

    context = get_context_for_candidate(
        candidate,
        transcript
    )

    prompt = create_editor_prompt(
        candidate,
        context
    )

    output = llm.generate(
        prompt=prompt,
        response_schema=create_editor_schema(),
    )


    try:

        result = json.loads(output)

        if not isinstance(result, dict):
            return None

        if not result.get("selected", False):
            return None

        start = float(result["start"])
        end = float(result["end"])
        score = float(result["score"])

        duration = end - start

        if duration < MIN_CLIP_LENGTH:
            return None

        if duration > MAX_CLIP_LENGTH:
            return None

        if score < MIN_SCORE:
            return None

        return {
            "start": start,
            "end": end,
            "score": score,
            "title": result["title"],
            "topic": candidate.get("topic", ""),
            "hook": candidate.get("hook", ""),
            "reason": result["reason"]
        }

    except (
        json.JSONDecodeError,
        KeyError,
        TypeError,
        ValueError
    ):

        print("Failed to parse editor response.")
        print(output)

        return None


# ============================================================
# TIMESTAMP VALIDATION
# ============================================================

def snap_to_subtitle_boundaries(
    clip,
    transcript,
    max_start_drift=2.0,
    max_end_drift=2.0
):
    """
    Snap timestamps to nearby subtitle boundaries without allowing large
    timestamp drift.

    The old implementation always selected the nearest subtitle boundary,
    even if that boundary was several seconds away. This version only snaps
    when the nearest boundary is within a small, configurable tolerance.

    For starts, the subtitle's start must be close to the requested start.
    For ends, the subtitle's end must be close to the requested end.
    Otherwise the LLM-selected timestamp is preserved.
    """

    if not transcript:
        return clip

    start = float(clip["start"])
    end = float(clip["end"])

    closest_start = min(
        transcript,
        key=lambda x: abs(x["start"] - start)
    )

    closest_end = min(
        transcript,
        key=lambda x: abs(x["end"] - end)
    )

    start_drift = abs(closest_start["start"] - start)
    end_drift = abs(closest_end["end"] - end)

    if start_drift <= max_start_drift:
        clip["start"] = closest_start["start"]

    if end_drift <= max_end_drift:
        clip["end"] = closest_end["end"]

    return clip

# ============================================================
# FINAL DEDUPLICATION
# ============================================================

def deduplicate_final_clips(clips):

    # IMPORTANT:
    # Highest quality clips are considered first.
    clips = sorted(
        clips,
        key=lambda x: x["score"],
        reverse=True
    )

    result = []

    for clip in clips:

        duplicate = False

        for existing in result:

            overlap_start = max(
                clip["start"],
                existing["start"]
            )

            overlap_end = min(
                clip["end"],
                existing["end"]
            )

            overlap = max(
                0,
                overlap_end - overlap_start
            )

            clip_duration = (
                clip["end"] -
                clip["start"]
            )

            existing_duration = (
                existing["end"] -
                existing["start"]
            )

            shorter_duration = min(
                clip_duration,
                existing_duration
            )

            temporal_duplicate = (
                shorter_duration > 0
                and overlap / shorter_duration > 0.5
            )

            # Final clips have generated titles and, after the change in
            # refine_candidate(), preserved candidate topics. Use both as
            # semantic signals so near-duplicate clips can be removed even
            # when their time ranges are different.
            title_similarity = _text_similarity(
                clip.get("title", ""),
                existing.get("title", "")
            )

            topic_similarity = _text_similarity(
                clip.get("topic", ""),
                existing.get("topic", "")
            )

            semantic_duplicate = (
                topic_similarity >= 0.72
                or (
                    title_similarity >= 0.78
                    and topic_similarity >= 0.55
                )
            )

            if temporal_duplicate or semantic_duplicate:
                duplicate = True
                break

        if not duplicate:
            result.append(clip)

    return result

# ============================================================
# MAIN PIPELINE
# ============================================================

def generateTimestamps(id):

    video_dir = youtube_video_dir(id)

    metadata_path = video_dir / "metadata.json"

    with open(
        str(metadata_path),
        "r",
        encoding="utf-8"
    ) as f:

        metadata = json.load(f)

    if metadata["pipeline"]["transcript-analysed"] is True:

        print(
            "clips timestamps already generated"
        )

        return

    # --------------------------------------------------------
    # LOAD TRANSCRIPT
    # --------------------------------------------------------

    vtt_path = video_dir / (
        id + ".en.vtt"
    )

    transcript = vtt_to_json(
        vtt_path
    )

    if not transcript:

        print("Transcript is empty.")

        return

    print(
        f"Loaded {len(transcript)} subtitle entries."
    )

    # --------------------------------------------------------
    # CREATE OVERLAPPING CHUNKS
    # --------------------------------------------------------

    chunks = chunk_transcript(
        transcript
    )

    print(
        f"Created {len(chunks)} overlapping chunks."
    )

    # --------------------------------------------------------
    # PASS 1
    # --------------------------------------------------------

    all_candidates = []

    config = load_config()

    llm = create_llm(**config["llm"])

    for index, chunk in enumerate(chunks):

        print(
            f"\n[PASS 1] "
            f"Chunk {index + 1}/{len(chunks)}"
        )

        candidates = discover_candidates(
            chunk,
            llm
        )

        print(
            f"Found {len(candidates)} candidates."
        )

        all_candidates.extend(
            candidates
        )

    print(
        f"\nRaw candidates: "
        f"{len(all_candidates)}"
    )

    # --------------------------------------------------------
    # DEDUPLICATE CANDIDATES
    # --------------------------------------------------------

    all_candidates = deduplicate_candidates(
        all_candidates
    )

    print(
        f"Unique candidates: "
        f"{len(all_candidates)}"
    )

    # --------------------------------------------------------
    # PASS 2
    # --------------------------------------------------------

    final_clips = []

    for index, candidate in enumerate(
        all_candidates
    ):

        print(
            f"\n[PASS 2] "
            f"Candidate {index + 1}/"
            f"{len(all_candidates)}"
        )

        print(
            f"  Candidate: "
            f"{candidate['start']:.2f} → "
            f"{candidate['end']:.2f}"
        )

        clip = refine_candidate(
            candidate,
            transcript,
            llm
        )

        if clip is None:

            print("  REJECTED")

            continue

        # Snap to actual subtitle boundaries
        clip = snap_to_subtitle_boundaries(
            clip,
            transcript
        )

        duration = (
            clip["end"] -
            clip["start"]
        )

        if duration < MIN_CLIP_LENGTH:

            print(
                "  REJECTED: too short after "
                "boundary adjustment"
            )

            continue

        if duration > MAX_CLIP_LENGTH:

            print(
                "  REJECTED: too long after "
                "boundary adjustment"
            )

            continue

        final_clips.append(
            clip
        )

        print(
            f"  SELECTED "
            f"| score={clip['score']:.0f} "
            f"| duration={duration:.1f}s"
        )

    # --------------------------------------------------------
    # FINAL DEDUPLICATION
    # --------------------------------------------------------

    final_clips = deduplicate_final_clips(
        final_clips
    )

    # --------------------------------------------------------
    # RANK BY QUALITY
    # --------------------------------------------------------

    final_clips.sort(
        key=lambda x: x["score"],
        reverse=True
    )

    final_clips = final_clips[
        :MAX_FINAL_CLIPS
    ]

    # --------------------------------------------------------
    # PRINT FINAL RESULTS
    # --------------------------------------------------------

    print(
        f"\n========================================"
    )

    print(
        f"FINAL CLIPS: {len(final_clips)}"
    )

    print(
        f"========================================"
    )

    for index, clip in enumerate(
        final_clips,
        start=1
    ):

        duration = (
            clip["end"] -
            clip["start"]
        )

        print(
            f"{index}. "
            f"[{clip['score']:.0f}] "
            f"{clip['start']:.2f} → "
            f"{clip['end']:.2f} "
            f"({duration:.1f}s)"
        )

        print(
            f"   {clip['title']}"
        )

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------

    output_path = (
        video_dir /
        "clipTimestamps.json"
    )

    with open(
        str(output_path),
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            final_clips,
            file,
            indent=4,
            ensure_ascii=False
        )

    # --------------------------------------------------------
    # UPDATE PIPELINE STATUS
    # --------------------------------------------------------

    metadata["pipeline"][
        "transcript-analysed"
    ] = True

    with open(
        str(metadata_path),
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            metadata,
            f,
            indent=4,
            ensure_ascii=False
        )

    print(
        f"\nSaved {len(final_clips)} clips to "
        f"{output_path}"
    )