/* ============================================================
   main.js — editable copy, screen router, help popup and all
   event wiring. Static screen copy lives in index.html under
   the EDITABLE COPY comment; every dynamic string is below.
   ============================================================ */

/* =====================================================
   EDITABLE COPY — safe to change without touching logic.
   {placeholders} are filled in by format() at runtime.
   ===================================================== */
var COPY = {
  learn: {
    invalidMsg: "Enter a whole number between 0 and 255 to see the conversion.",
    srResult: "{value} in binary is {digitString}"
  },
  quiz: {
    subheading: "Question {n} / 10",
    submit: "Submit",
    next: "Next",
    seeResults: "See Results",
    on: "on",
    off: "off",
    pillCorrect: "Correct",
    pillIncorrect: "Incorrect",
    msgCorrect: "Well done!",
    msgIncorrect: "Not quite right",
    toggleLabel: "{placeValue}s place, currently {state}",
    hintBtn: "Hints: off",
    hintBtnOn: "Hints: on",
    hintBtnPrompt: "Select one of the bits above to see a hint for that column.",
    hintBtnPromptHasBeenActivated: "Hints have been recorded as used for this question.",
    hintFit: "Can {placeValue} fit into {remaining}?",
    srNewQuestion: "Question {n} of 10. Convert {target} to binary.",
    srCorrect: "Correct. Well done.",
    srIncorrect: "Incorrect. The right answer for {target} is {digitString}.",
    srHintOn: "Hints on. Toggling a place value shows a fit question for that column.",
    srHintOff: "Hints off."
  },
  results: {
    score: "You scored {n} / 10",
    hintsNone: "You completed the quiz without using hints.",
    hintsUsed: "Hints were used on question{s}: {list}. Keep going until you don't need to use hints at all.",
    bandLow:
      "Go back over the course content to refresh your " +
      "understanding of decimal to binary conversion.",
    bandMid:
      "Well done! You show a good understanding of the conversion process.",
    bandHigh:
      "Fantastic! You demonstrated great understanding of the " +
      "conversion process.",
    srSummary: "Quiz complete. You scored {n} out of 10."
  }
};
/* ============== end editable copy ============== */

/** Fill {placeholders} in a copy string. */
function format(template, values) {
  return template.replace(/\{(\w+)\}/g, function (m, key) {
    return key in values ? values[key] : m;
  });
}

/** Announce a message to screen readers via the polite live region. */
function announce(message) {
  var region = document.getElementById("sr-announce");
  region.textContent = "";          // re-announce identical messages
  window.setTimeout(function () { region.textContent = message; }, 30);
}

/* ---------- Router ---------- */

/** Show exactly one screen; move focus to its heading (a11y A2). */
function showScreen(screenId) {
  var screens = document.querySelectorAll(".screen");
  for (var i = 0; i < screens.length; i++) {
    screens[i].hidden = screens[i].id !== screenId;
  }
  var heading = document.querySelector("#" + screenId + " h1");
  if (heading) heading.focus();

  // Connectors were often first drawn while Learn was hidden (0×0).
  // Redraw once the screen is visible and laid out.
  if (screenId === "screen-learn") {
    window.requestAnimationFrame(function () {
      redrawConverterConnectors();
    });
  }
}

/* ---------- Help popup ---------- */

var helpSeenThisLoad = false;  // plain variable: nothing persists (C3)
var helpOpener = null;         // element to return focus to on close

function openHelp(openerEl) {
  helpOpener = openerEl || document.querySelector("#screen-learn h1");
  document.getElementById("help-overlay").hidden = false;
  document.getElementById("btn-help-close").focus();
}

function closeHelp() {
  document.getElementById("help-overlay").hidden = true;
  if (helpOpener) helpOpener.focus();
}

/** Keep Tab cycling inside the dialog while it is open. */
function trapHelpFocus(event) {
  if (event.key !== "Tab") return;
  var dialog = document.getElementById("help-dialog");
  var focusables = dialog.querySelectorAll(
    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
  );
  var first = focusables[0];
  var last = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ---------- Learn screen input (decision table, spec §5.3) ---------- */

function handleLearnInput() {
  var mode = CONVERSION_MODES.binary;
  var raw = document.getElementById("learn-input").value.trim();
  var msg = document.getElementById("learn-msg");

  // Valid: 1–3 ASCII digits parsing into range (leading zeros OK).
  if (/^[0-9]{1,3}$/.test(raw)) {
    var value = parseInt(raw, 10);
    if (isValidInput(mode, value)) {
      renderConverter(mode, value);
      setConverterStale(false);
      msg.textContent = "";
      announce(format(COPY.learn.srResult, {
        value: value,
        digitString: toDigits(mode, value).join("")
      }));
      return;
    }
  }

  // Empty or invalid: message + dim, keep last valid render,
  // never auto-correct what they typed.
  msg.textContent = COPY.learn.invalidMsg;
  setConverterStale(true);
}

/* ---------- Start screen bit flicker ---------- */

/** Set one decorative start-button bit and its colour class. */
function setGoBit(el, bit) {
  el.textContent = bit;
  el.className = bit === "1" ? "bit-one" : "bit-zero";
}

/** Each bit flips randomly every 2s after its own random start delay.
 *  JS timers aren't covered by the CSS reduced-motion blanket, so the
 *  whole effect is skipped for users who prefer reduced motion. */
function startGoButtonBitFlicker() {
  if (window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return; // static 00101010 (42) is shown instead
  }
  var bits = document.querySelectorAll("#btn-go-binary .btn-go-bits span");
  for (var i = 0; i < bits.length; i++) {
    (function (el) {
      var delay = Math.floor(Math.random() * 2000); // 0–1999 ms
      window.setTimeout(function () {
        setGoBit(el, Math.random() < 0.5 ? "0" : "1");
        window.setInterval(function () {
          setGoBit(el, Math.random() < 0.5 ? "0" : "1");
        }, 2000);
      }, delay);
    })(bits[i]);
  }
}

/* ---------- Boot & wiring ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var mode = CONVERSION_MODES.binary;

  resetPoolForPageLoad();
  initConverter(mode, document.getElementById("converter-root"));
  renderConverter(mode, 42); // prefill so the screen is never blank
  startGoButtonBitFlicker();

  // Start screen
  document.getElementById("btn-go-binary").addEventListener("click", function () {
    showScreen("screen-learn");
    if (!helpSeenThisLoad) {
      helpSeenThisLoad = true;
      openHelp(null); // focus returns to the Learn heading on close
    }
  });

  // Learn screen
  document.getElementById("learn-input").addEventListener("input", handleLearnInput);
  document.getElementById("btn-help-open").addEventListener("click", function () {
    openHelp(this);
  });
  document.getElementById("btn-begin-quiz").addEventListener("click", function () {
    // Screen first, then round: startRound focuses the first toggle,
    // which only works once the quiz screen is visible.
    showScreen("screen-quiz");
    startRound(mode);
  });

  // Quiz screen: one button, behaviour gated by round state
  document.getElementById("btn-quiz-submit").addEventListener("click", function () {
    if (quiz.answered) nextQuestion();
    else submitAnswer();
  });
  document.getElementById("btn-quiz-hint").addEventListener("click", function () {
    setHintsEnabled(!quiz.hintsEnabled);
  });

  // Results screen
  document.getElementById("btn-try-again").addEventListener("click", function () {
    showScreen("screen-quiz"); // screen first, then round (see Begin Quiz note)
    startRound(mode);
  });

  // Go Home from every screen (mid-quiz: round abandoned, pool kept)
  ["btn-home-learn", "btn-home-quiz", "btn-home-results"].forEach(function (id) {
    document.getElementById(id).addEventListener("click", function () {
      showScreen("screen-start");
    });
  });

  // Help popup: close button, backdrop click, Esc, focus trap
  document.getElementById("btn-help-close").addEventListener("click", closeHelp);
  document.getElementById("help-overlay").addEventListener("click", function (e) {
    if (e.target === this) closeHelp(); // backdrop only, not the panel
  });
  document.addEventListener("keydown", function (e) {
    var helpOpen = !document.getElementById("help-overlay").hidden;
    if (!helpOpen) return;
    if (e.key === "Escape") closeHelp();
    else trapHelpFocus(e);
  });

  showScreen("screen-start");
});
