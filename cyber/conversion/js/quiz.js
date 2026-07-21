/* ============================================================
   quiz.js — question pool, quiz round state, grading, feedback
   and results population. Reads all mode facts (digit count,
   place values, range) from the mode object — nothing binary-
   specific is hard-coded, so hex plugs in via CONVERSION_MODES.
   Strings come from the COPY object in main.js (loaded after
   this file, but only referenced at runtime).
   ============================================================ */

var QUESTIONS_PER_ROUND = 10;

/* ---------- Question pools (banded by question number) ----------
   Progressive difficulty: each question draws from a fixed
   inclusive range. Each band keeps its own shuffled pool across
   rounds for the life of the page load. A band refills and
   reshuffles only when it is exhausted. Never persisted.
   Quiz targets never exceed 128 (Learn converter still 0–255). */
var QUESTION_BANDS = [
  { minQ: 1, maxQ: 4, min: 0, max: 16 },
  { minQ: 5, maxQ: 6, min: 17, max: 32 },
  { minQ: 7, maxQ: 8, min: 33, max: 64 },
  { minQ: 9, maxQ: 9, min: 65, max: 96 },
  { minQ: 10, maxQ: 10, min: 97, max: 128 }
];

/** Per-band state: { values: number[], index: number } */
var bandPools = [];

function bandForQuestion(questionNumber) {
  for (var i = 0; i < QUESTION_BANDS.length; i++) {
    var b = QUESTION_BANDS[i];
    if (questionNumber >= b.minQ && questionNumber <= b.maxQ) return i;
  }
  return 0;
}

function shuffleInPlace(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function refillBand(bandIndex) {
  var spec = QUESTION_BANDS[bandIndex];
  var values = [];
  for (var v = spec.min; v <= spec.max; v++) values.push(v);
  shuffleInPlace(values);
  bandPools[bandIndex] = { values: values, index: 0 };
}

function resetPoolForPageLoad() {
  bandPools = [];
  for (var i = 0; i < QUESTION_BANDS.length; i++) refillBand(i);
}

/** Next target for this question number; skips values already
    used this round (only possible when a band refill lands
    mid-round). */
function drawNumber(questionNumber, usedThisRound) {
  var bandIndex = bandForQuestion(questionNumber);
  var candidate;
  do {
    var band = bandPools[bandIndex];
    if (band.index >= band.values.length) {
      refillBand(bandIndex);
      band = bandPools[bandIndex];
    }
    candidate = band.values[band.index++];
  } while (usedThisRound.indexOf(candidate) !== -1);
  return candidate;
}

/* ---------- Round state ---------- */
var quiz = {
  mode: null,
  questionNumber: 0,   // 1-based
  score: 0,
  target: 0,
  usedThisRound: [],
  answered: false,     // gates Submit vs Next behaviour
  toggles: [],         // button elements, left to right
  hintsEnabled: false,
  hintShownThisQuestion: false, // true only after a column hint is displayed
  hintedQuestions: []  // committed on Submit when hintShownThisQuestion
};

/** Start a fresh round of 10 (Begin Quiz and Try Again). */
function startRound(mode) {
  quiz.mode = mode;
  quiz.questionNumber = 0;
  quiz.score = 0;
  quiz.usedThisRound = [];
  quiz.hintedQuestions = [];
  setHintsEnabled(false, true);
  nextQuestion();
}

/** Advance to the next question, or to Results after Q10. */
function nextQuestion() {
  if (quiz.questionNumber >= QUESTIONS_PER_ROUND) {
    showResults();
    return;
  }

  quiz.questionNumber += 1;
  quiz.answered = false;
  quiz.hintShownThisQuestion = false;
  setHintsEnabled(false, true); // hints last for one question only
  quiz.target = drawNumber(quiz.questionNumber, quiz.usedThisRound);
  quiz.usedThisRound.push(quiz.target);

  document.getElementById("quiz-subheading").textContent =
    format(COPY.quiz.subheading, { n: quiz.questionNumber });
  document.getElementById("quiz-target").textContent = quiz.target;
  document.getElementById("quiz-feedback").innerHTML = "";

  buildToggles();

  var submitBtn = document.getElementById("btn-quiz-submit");
  submitBtn.textContent = COPY.quiz.submit;

  announce(format(COPY.quiz.srNewQuestion, {
    n: quiz.questionNumber,
    target: quiz.target
  }));

  quiz.toggles[0].focus(); // spec §5.4.1: focus first toggle
}

/** Build the 8 toggle columns fresh, all off. */
function buildToggles() {
  var wrap = document.getElementById("quiz-toggles");
  wrap.innerHTML = "";
  wrap.style.setProperty("--cols", quiz.mode.digitCount);
  quiz.toggles = [];

  quiz.mode.placeValues.forEach(function (pv, i) {
    var exp = quiz.mode.digitCount - 1 - i;
    var col = document.createElement("div");
    col.className = "tg-col";

    var expLabel = document.createElement("div");
    expLabel.className = "tg-exp";
    expLabel.setAttribute("aria-hidden", "true");
    expLabel.innerHTML = "2<sup>" + exp + "</sup>";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bit-toggle";
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", toggleLabel(pv, false));
    btn.innerHTML =
      '<span class="t-val">' + pv + "</span>" +
      '<span class="t-digit">0</span>' +
      '<span class="t-state">' + COPY.quiz.off + "</span>";

    var hintEl = document.createElement("div");
    hintEl.className = "tg-hint";
    hintEl.hidden = true;
    hintEl.setAttribute("aria-hidden", "true");

    btn.addEventListener("click", function () {
      if (quiz.answered) return; // locked after submit (also disabled)
      var on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", toggleLabel(pv, on));
      btn.classList.toggle("is-on", on);
      btn.querySelector(".t-digit").textContent = on ? "1" : "0";
      btn.querySelector(".t-state").textContent =
        on ? COPY.quiz.on : COPY.quiz.off;
      if (quiz.hintsEnabled) showColumnHint(i);
      else clearColumnHints();
    });

    col.appendChild(expLabel);
    col.appendChild(btn);
    col.appendChild(hintEl);
    wrap.appendChild(col);
    quiz.toggles.push(btn);
  });
}

function toggleLabel(placeValue, on) {
  return format(COPY.quiz.toggleLabel, {
    placeValue: placeValue,
    state: on ? COPY.quiz.on : COPY.quiz.off
  });
}

/** Remaining before deciding column i: target minus ON place values to the left. */
function remainingBeforeColumn(columnIndex) {
  var remaining = quiz.target;
  for (var j = 0; j < columnIndex; j++) {
    if (quiz.toggles[j].getAttribute("aria-pressed") === "true") {
      remaining -= quiz.mode.placeValues[j];
    }
  }
  return remaining;
}

function clearColumnHints() {
  var hints = document.querySelectorAll("#quiz-toggles .tg-hint");
  for (var i = 0; i < hints.length; i++) {
    hints[i].hidden = true;
    hints[i].textContent = "";
  }
}

/** Show the fit-question tip on one column (marks hint as used for this question). */
function showColumnHint(columnIndex) {
  clearColumnHints();
  var cols = document.querySelectorAll("#quiz-toggles .tg-col");
  var hintEl = cols[columnIndex] && cols[columnIndex].querySelector(".tg-hint");
  if (!hintEl) return;

  var placeValue = quiz.mode.placeValues[columnIndex];
  var remaining = remainingBeforeColumn(columnIndex);
  var hintText = format(COPY.quiz.hintFit, {
    placeValue: placeValue,
    remaining: remaining
  });
  hintEl.textContent = hintText;
  hintEl.hidden = false;
  // Visual tip is aria-hidden; speak the same hint via the live
  // region so screen-reader users get equal access to hints.
  announce(hintText);
  quiz.hintShownThisQuestion = true;
}

/** Record hint use for results only when a hint was actually shown. */
function commitHintUseForQuestion() {
  if (!quiz.hintShownThisQuestion) return;
  if (quiz.hintedQuestions.indexOf(quiz.questionNumber) === -1) {
    quiz.hintedQuestions.push(quiz.questionNumber);
  }
}

/** Footer Hints toggle: on = fit tips appear when a place value is flipped.
 *  @param {boolean} [silent] — skip live-region announce (e.g. round reset). */
function setHintsEnabled(on, silent) {
  quiz.hintsEnabled = !!on;
  var btn = document.getElementById("btn-quiz-hint");
  var prompt = document.getElementById("quiz-hint-prompt");
  btn.setAttribute("aria-pressed", String(quiz.hintsEnabled));
  btn.textContent = quiz.hintsEnabled ? COPY.quiz.hintBtnOn : COPY.quiz.hintBtn;
  if (quiz.hintsEnabled) {
    prompt.textContent = COPY.quiz.hintBtnPrompt;
    prompt.hidden = false;
  } else {
    clearColumnHints();
    if (quiz.hintShownThisQuestion) {
      prompt.textContent = COPY.quiz.hintBtnPromptHasBeenActivated;
      prompt.hidden = false;
    } else {
      prompt.textContent = "";
      prompt.hidden = true;
    }
  }
  if (!silent) {
    announce(quiz.hintsEnabled ? COPY.quiz.srHintOn : COPY.quiz.srHintOff);
  }
}

/** Grade the answer, lock toggles, render per-column feedback,
    pill and message; flip the button to Next / See Results. */
function submitAnswer() {
  if (quiz.answered) return;
  quiz.answered = true;
  commitHintUseForQuestion();
  clearColumnHints();

  var correct = toDigits(quiz.mode, quiz.target);
  var given = quiz.toggles.map(function (btn) {
    return btn.getAttribute("aria-pressed") === "true" ? 1 : 0;
  });
  var allRight = correct.every(function (d, i) { return d === given[i]; });
  if (allRight) quiz.score += 1;

  // Lock: disabled (not aria-disabled) — the feedback row below
  // restates each column's outcome, so dead toggles staying
  // focusable would add noise, not information (spec §5.4.1).
  quiz.toggles.forEach(function (btn) { btn.disabled = true; });

  // Per-column marks + correct digits, aligned under the columns,
  // then the Correct/Incorrect pill and message.
  var fb = document.getElementById("quiz-feedback");
  var grid = document.createElement("div");
  grid.className = "fb-grid";
  grid.style.setProperty("--cols", quiz.mode.digitCount);
  grid.setAttribute("aria-hidden", "true"); // announced via live region

  correct.forEach(function (d, i) {
    var cell = document.createElement("div");
    cell.className = "fb-cell";
    var ok = d === given[i];
    cell.innerHTML =
      '<span class="' + (ok ? "mark-ok" : "mark-err") + '">' +
      (ok ? "&#10003;" : "&#10007;") + "</span>" +
      '<span class="fb-digit">' + d + "</span>";
    grid.appendChild(cell);
  });

  var pillRow = document.createElement("div");
  pillRow.className = "fb-pill-row " + (allRight ? "fb-pill-row-ok" : "fb-pill-row-err");
  pillRow.innerHTML =
    '<span class="fb-label ' + (allRight ? "fb-label-ok" : "fb-label-err") + '">' +
    '<span class="fb-label-icon" aria-hidden="true">' +
    (allRight ? "&#10003;" : "&#10007;") +
    "</span>" +
    (allRight ? COPY.quiz.pillCorrect : COPY.quiz.pillIncorrect) +
    "</span><em>" +
    (allRight ? COPY.quiz.msgCorrect : COPY.quiz.msgIncorrect) + "</em>";

  fb.appendChild(grid);
  fb.appendChild(pillRow);

  document.getElementById("quiz-subheading").textContent =
    format(COPY.quiz.subheading, { n: quiz.questionNumber }) +
    " \u2014 " + (allRight ? COPY.quiz.pillCorrect : COPY.quiz.pillIncorrect);

  announce(allRight
    ? COPY.quiz.srCorrect
    : format(COPY.quiz.srIncorrect, {
        target: quiz.target,
        digitString: correct.join("")
      }));

  var submitBtn = document.getElementById("btn-quiz-submit");
  submitBtn.textContent =
    quiz.questionNumber === QUESTIONS_PER_ROUND
      ? COPY.quiz.seeResults
      : COPY.quiz.next;
  submitBtn.focus(); // spec §5.4.1
}

function getRoundResult() {
  return {
    score: quiz.score,
    total: QUESTIONS_PER_ROUND,
    hintedQuestions: quiz.hintedQuestions.slice()
  };
}

/** "1, 2 and 3" style list for results copy. */
function formatQuestionList(nums) {
  if (nums.length === 1) return String(nums[0]);
  if (nums.length === 2) return nums[0] + " and " + nums[1];
  return nums.slice(0, -1).join(", ") + " and " + nums[nums.length - 1];
}

/** Populate and show the Results screen (spec §5.5). */
function showResults() {
  var result = getRoundResult();

  document.getElementById("results-score").innerHTML =
    format(COPY.results.score, { n: "<b>" + result.score + "</b>" });

  var hintsEl = document.getElementById("results-hints");
  if (result.hintedQuestions.length === 0) {
    hintsEl.textContent = COPY.results.hintsNone;
  } else {
    hintsEl.textContent = format(COPY.results.hintsUsed, {
      s: result.hintedQuestions.length === 1 ? "" : "s",
      list: formatQuestionList(result.hintedQuestions)
    });
  }

  var band;
  if (result.score <= 6) band = COPY.results.bandLow;
  else if (result.score <= 8) band = COPY.results.bandMid;
  else band = COPY.results.bandHigh;
  document.getElementById("results-band").textContent = band;

  showScreen("screen-results");
  announce(format(COPY.results.srSummary, { n: result.score }));
}
