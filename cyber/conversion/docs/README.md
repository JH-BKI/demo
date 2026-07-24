# Decimal Conversion Activity (Binary, 8-bit)

A self-contained, dependency-free learning activity. A live decimal→binary
converter shows the manual working step by step — with colour-coded
remainder paths flowing from column to column — followed by a 10-question
quiz with progressive difficulty, optional per-column hints, instant
feedback, and banded results.

No build step, no libraries, no network requests, no stored data.

## Running it

- **Locally:** open `index.html` in any modern browser (double-click works —
  everything runs over `file://`).
- **LMS:** upload the whole folder (or the zip) keeping the structure intact,
  and point the LMS at `index.html`. All paths are relative.

Supported browsers: current Chrome, Edge, Firefox and Safari (desktop and
mobile). Nothing persists between sessions by design — reloading the page
resets everything, including the question pools.

## What's in the activity

- **Learn screen (converter):** type any number 0–255 and watch the full
  working: "Can X fit into Y?" at each place value, the subtraction, the
  remainder carried to the next column (matching tints and connector lines
  trace each remainder's journey), the resulting bits, and a verification
  sum.
- **Quiz:** 10 questions with difficulty bands — Q1–4 draw from 0–16,
  Q5–6 from 17–32, Q7–8 from 33–64, Q9 from 65–96, Q10 from 97–128.
  Numbers never repeat within a round, and each band draws through its pool
  across rounds before reshuffling. One attempt per question; the correct
  answer is revealed after Submit.
- **Hints:** a footer toggle; while on, flipping a bit shows that column's
  "Can X fit into Y?" question based on the learner's answer so far. Hint
  use is recorded per question and reported on the results screen. Hints
  switch off automatically at each new question.
- **Results:** score out of 10, hint-usage summary, and banded feedback
  (0–6 / 7–8 / 9–10), with Try Again and Home.

## File map

```
index.html          all screens + static copy
css/styles.css      design tokens (incl. path colour palette) + all styling
js/conversion.js    pure conversion maths + mode config  ← hex seam
js/converter-ui.js  Learn-screen renderer, colour paths, SVG connectors
js/quiz.js          banded question pools, quiz logic, hints, results
js/main.js          editable dynamic copy + router + wiring
```

## Editing the text

All learner-facing text lives in exactly two marked places:

1. **Static screen text** — `index.html`, under the `EDITABLE COPY` comment
   (start screen, help popup, results footer).
2. **Dynamic strings** — `js/main.js`, the `COPY` object at the top of the
   file (feedback messages, results bands, hint strings, labels, all
   screen-reader announcements). Keep any `{placeholders}` intact.

Nothing else needs touching to change wording.

## Adjusting the quiz

- **Length:** `QUESTIONS_PER_ROUND` in `js/quiz.js`, plus the "/ 10" copy
  strings in `main.js` (deliberately not derived).
- **Difficulty bands:** `QUESTION_BANDS` in `js/quiz.js`. Keep every
  question number 1–10 covered by exactly one band, and each band's number
  range larger than the count of questions it serves per round (the
  no-repeat guard needs the headroom).

## Adding hexadecimal (iteration 2)

The seam is `CONVERSION_MODES` in `js/conversion.js` — add a `hex` entry
(base, digit count, range, place values). Then: define hex difficulty bands
(the pools in `quiz.js` are currently binary-shaped), add a hex working-out
renderer in `converter-ui.js` (sibling of the binary one, keyed off
`mode.id`), add hex variants of the mode-specific copy (including hint
strings), and re-add the start-screen hex button — a commented-out starting
point sits in `index.html`. The router, quiz engine, scoring and results
need no structural change; comments in each file mark the spots.

## Accessibility notes

Keyboard-only operation throughout, focus management between screens, a
focus-trapped help dialog (Esc closes), `aria-pressed` toggles, polite
live-region announcements (questions, feedback, converter results, and
hint text — hints are spoken as well as shown), a screen-reader narration
of the converter's working, and `prefers-reduced-motion` support covering
both CSS motion and the JS-driven start-button animation.

The ARIA behaviour was verified programmatically. Before release to
learners, a manual pass with a real screen reader (VoiceOver, NVDA or
TalkBack) is recommended as a final check.

## Do-not-break notes for maintainers

Full rationale lives in the v4 as-built specification (bundle it, plus the
seven mockup images, alongside this project). The short list:

- Call `showScreen("screen-quiz")` **before** `startRound()` — focus lands
  on a hidden element otherwise.
- Keep `announce()`'s clear-then-set timeout — it re-announces repeated
  messages.
- Keep `minmax(0, 1fr)` / `min-width: 0` on the converter grids and the
  clamped `.q-before` sizing — removing them breaks the 360px layout.
- Several path-fill/text colour pairs pass WCAG AA by thin margins —
  re-check contrast after any palette change.
- Connector lines are drawn from live geometry — anything new that reveals
  or resizes the Learn screen must call `redrawConverterConnectors()`.
- Question pools reset on page reload only — never on Go Home or Try Again.
