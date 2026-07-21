/* ============================================================
   converter-ui.js — renders the Learn screen working-out from
   conversion.js output. Binary-specific layout lives here; a
   future hex renderer would be a sibling of buildColumns/
   renderConverter keyed off mode.id (see conversion.js seam).
   ============================================================ */

/* Per-column element references, filled by initConverter and
   updated in place by renderConverter (no rebuild per keystroke). */
var converterCols = [];
var converterGridEl = null;
var lastRenderSteps = null; // kept so residual connectors redraw on resize

/**
 * Build the 8-column grid skeleton once. Cells are appended
 * row-major so CSS grid lays them out in the mockup's rows.
 * The visual grid is aria-hidden; screen-reader users get the
 * column-ordered narration instead (see renderNarration).
 */
function initConverter(mode, rootEl) {
  rootEl.innerHTML = "";
  rootEl.setAttribute("aria-hidden", "true");
  rootEl.style.setProperty("--cols", mode.digitCount);
  converterGridEl = rootEl;
  converterCols = [];
  ensureConnectorLayer();

  // Create one ref object per column, then append row by row.
  for (var i = 0; i < mode.digitCount; i++) {
    var exp = mode.digitCount - 1 - i;
    var pv = mode.placeValues[i];

    var pvCard = el("div", "pv-card");
    pvCard.innerHTML =
      '<span class="pv-exp">2<sup>' + exp + "</sup></span>" +
      '<span class="pv-val">' + pv + "</span>";

    var qCell = el("div", "q-cell");
    // Prompt + value on top; Yes/No answer lives in this same band.
    qCell.innerHTML =
      '<span class="q-prompt">Can <b>' + pv + "</b><br>fit into</span>" +
      '<span class="q-line2"><span class="q-before"></span> ?</span>' +
      '<span class="q-answer"></span>';

    var remCell = el("div", "rem-cell");
    var putCell = el("div", "put-cell");

    var chev = el("div", "chev");
    chev.innerHTML =
      '<svg viewBox="0 0 24 12" width="18" height="9">' +
      '<path d="M2 2l10 8 10-8" fill="none" stroke="currentColor" ' +
      'stroke-width="3" stroke-linecap="round"/></svg>';

    var bitCard = el("div", "bit-card");

    converterCols.push({
      pvCard: pvCard,
      qBefore: qCell.querySelector(".q-before"),
      qAnswer: qCell.querySelector(".q-answer"),
      remCell: remCell,
      putCell: putCell,
      bitCard: bitCard,
      // 6 rows: place → question(+Yes/No) → rem → put → chev → bit
      cells: [pvCard, qCell, remCell, putCell, chev, bitCard]
    });
  }

  // Row-major append: all row-1 cells, then all row-2 cells, etc.
  for (var row = 0; row < 6; row++) {
    for (var c = 0; c < converterCols.length; c++) {
      rootEl.appendChild(converterCols[c].cells[row]);
    }
  }

  // Mockup 1 connectors depend on layout geometry — redraw on resize
  // and when the Learn screen becomes visible (boot render is often
  // while #screen-learn is still hidden → 0×0 rects).
  if (!initConverter._resizeBound) {
    initConverter._resizeBound = true;
    window.addEventListener("resize", function () {
      redrawConverterConnectors();
    });
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () {
        redrawConverterConnectors();
      });
      ro.observe(document.getElementById("converter-area"));
    }
  }
}

/** Full re-render for a valid value: grid, sum line, narration. */
function renderConverter(mode, value) {
  var steps = getWorkingSteps(mode, value);
  lastRenderSteps = steps;

  // Colour path (docs/7-colour-option.jpg): generation 0 = input;
  // each Yes advances the colour for the new rem-box and later befores.
  var colourIndex = 0;
  setInputPath(0);

  steps.forEach(function (step, i) {
    var col = converterCols[i];

    col.pvCard.classList.toggle("is-on", step.digit === 1);
    col.qBefore.textContent = step.before;
    setPathAttr(col.qBefore, colourIndex);

    col.qAnswer.innerHTML = step.fits
      ? '<span class="mark-ok">&#10003;</span> Yes'
      : '<span class="mark-err">&#10007;</span> No';

    if (step.fits) {
      colourIndex = Math.min(colourIndex + 1, 8);
      // Why? only on Yes columns; then calc → label → rem-box.
      col.remCell.innerHTML =
        '<span class="rem-why">How?</span>' +
        '<span class="rem-cap">' +
        step.before + "&minus;" + step.placeValue +
        ' = <span class="rem-result" data-path="' + colourIndex + '">' +
        step.after + "</span></span>" +
        '<span class="rem-label">carry over<br>remaining:</span>' +
        '<span class="rem-box" data-path="' + colourIndex + '">' +
        step.after + "</span>";
    } else {
      col.remCell.innerHTML = '<span class="rem-dash">Try again<br>next column</span>';
    }

    col.putCell.textContent = "Set to " + step.digit;
    col.bitCard.textContent = step.digit;
    col.bitCard.classList.toggle("is-on", step.digit === 1);
  });

  renderSum(steps, value);
  renderNarration(mode, steps, value);
  // Geometry needs a laid-out rem-box — next frame after DOM update.
  window.requestAnimationFrame(function () {
    renderRemainderConnectors(steps);
  });
}

/** SVG overlay used by mockup 1's remainder → next-column flow lines. */
function ensureConnectorLayer() {
  var area = document.getElementById("converter-area");
  var svg = document.getElementById("rem-connectors");
  if (svg) return svg;

  svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "rem-connectors";
  svg.setAttribute("class", "rem-connectors");
  svg.setAttribute("aria-hidden", "true");
  area.insertBefore(svg, document.getElementById("converter-sum"));
  return svg;
}

/**
 * Draw zig-zag grey lines from each Yes rem-box into the next
 * column's "fit into" value (mockup 1). Decorative only.
 * No-ops while the Learn screen is hidden (0×0 layout) — callers
 * redraw once the area has real geometry (ResizeObserver / showScreen).
 */
function renderRemainderConnectors(steps) {
  var area = document.getElementById("converter-area");
  var svg = ensureConnectorLayer();
  var w = area.clientWidth;
  var h = area.clientHeight;

  // Boot path: renderConverter(42) runs before Learn is shown.
  if (w < 1 || h < 1) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    return;
  }

  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  var areaRect = area.getBoundingClientRect();

  steps.forEach(function (step, i) {
    if (!step.fits || i >= steps.length - 1) return;

    var remBox = converterCols[i].remCell.querySelector(".rem-box");
    var nextBefore = converterCols[i + 1].qBefore;
    if (!remBox || !nextBefore) return;

    var a = remBox.getBoundingClientRect();
    var b = nextBefore.getBoundingClientRect();
    // Still collapsed / not laid out
    if (a.width < 1 || b.width < 1) return;

    var x1 = a.right - areaRect.left;
    var y1 = a.top + a.height / 2 - areaRect.top;
    var x2 = b.left - areaRect.left;
    var y2 = b.top + b.height / 2 - areaRect.top;
    // Elbow in the column gap: right from rem, then up into next question.
    var midX = x1 + Math.max(6, (x2 - x1) * 0.5);

    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // Match stroke to the rem / next "fit into" generation colour.
    path.setAttribute("data-path", remBox.getAttribute("data-path") || "0");
    path.setAttribute(
      "d",
      "M " + x1 + " " + y1 +
      " L " + midX + " " + y1 +
      " L " + midX + " " + y2 +
      " L " + x2 + " " + y2
    );
    svg.appendChild(path);
  });
}

/** Public: redraw connectors using the last valid steps (Learn shown). */
function redrawConverterConnectors() {
  if (!lastRenderSteps) return;
  renderRemainderConnectors(lastRenderSteps);
}

/** Verification line: addends under bit columns; = and total to the right. */
function renderSum(steps, value) {
  var sumEl = document.getElementById("converter-sum");
  sumEl.style.setProperty("--cols", steps.length);

  var terms = steps.map(function (step) {
    var addend = step.digit === 1 ? step.placeValue : 0;
    return '<span class="sum-term"><span class="sum-num">' + addend +
      "</span></span>";
  }).join("");

  sumEl.innerHTML =
    '<div class="sum-addends">' + terms + "</div>" +
    '<div class="sum-tail">' +
    '<span class="sum-op sum-eq">=</span>' +
    '<span class="sum-total" data-path="0">' + value + "</span>" +
    "</div>";
}

/**
 * Visually-hidden, column-ordered narration for screen readers
 * (the visual grid reads row-major, which is incomprehensible
 * aloud). Not a live region — it's read on demand.
 */
function renderNarration(mode, steps, value) {
  var narr = document.getElementById("converter-narration");
  var digitString = steps.map(function (s) { return s.digit; }).join("");
  var sumExpr = steps
    .map(function (s) { return s.digit === 1 ? s.placeValue : 0; })
    .join(" + ");

  var lines = [
    "Converting " + value +
    " to binary, working from the largest place value:"
  ];
  steps.forEach(function (s, i) {
    var line =
      "Step " + (i + 1) + ": can " + s.placeValue + " fit into " +
      s.before + "? " + (s.fits ? "Yes" : "No") + " \u2014 put " + s.digit + ".";
    if (s.fits) line += " Remaining: " + s.after + ".";
    lines.push(line);
  });
  lines.push(
    "Result: " + value + " in binary is " + digitString +
    ". Check: " + sumExpr + " = " + value + "."
  );

  narr.textContent = lines.join(" ");
}

/** Dim/undim the working area while input is empty or invalid.
 *  Input path tint is valid-only; grid keeps last coloured render. */
function setConverterStale(isStale) {
  var area = document.getElementById("converter-area");
  area.classList.toggle("is-stale", isStale);
  if (isStale) clearInputPath();
}

/** data-path="n" → CSS --path-n fill (colour visual path). */
function setPathAttr(el, index) {
  el.setAttribute("data-path", String(index));
}

function setInputPath(index) {
  setPathAttr(document.getElementById("learn-input"), index);
}

function clearInputPath() {
  document.getElementById("learn-input").removeAttribute("data-path");
}

/** Tiny element helper. */
function el(tag, className) {
  var node = document.createElement(tag);
  node.className = className;
  return node;
}
