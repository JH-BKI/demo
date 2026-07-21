/* ============================================================
   conversion.js — pure conversion maths. No DOM code in here.

   HEX SEAM (iteration 2): to add hexadecimal, add a "hex" entry
   to CONVERSION_MODES below (base 16, its own digitCount, range
   and place values), then add a hex working-out renderer in
   converter-ui.js. The router, quiz engine and results logic
   read everything from the mode object, so they need no change.
   ============================================================ */

var CONVERSION_MODES = {
  binary: {
    id: "binary",
    label: "Binary",
    base: 2,
    digitCount: 8,                              // 8-bit activity
    min: 0,
    max: 255,
    placeValues: [128, 64, 32, 16, 8, 4, 2, 1]  // largest first
  }
  // hex: { ... }  <-- iteration 2 slots in here
};

/**
 * Walk the value through each place value (largest first),
 * recording the question asked and outcome at every column.
 * Mirrors the manual method taught on the Learn screen.
 *
 * Returns one Step per digit column:
 *   { exponent, placeValue, before, fits, after, digit }
 *   before = remaining value asked about at this column
 *   after  = remainder carried into the next column
 */
function getWorkingSteps(mode, value) {
  var steps = [];
  var remaining = value;

  for (var i = 0; i < mode.placeValues.length; i++) {
    var placeValue = mode.placeValues[i];
    var fits = remaining >= placeValue;

    steps.push({
      exponent: mode.digitCount - 1 - i,
      placeValue: placeValue,
      before: remaining,
      fits: fits,
      after: fits ? remaining - placeValue : remaining,
      digit: fits ? 1 : 0
    });

    if (fits) remaining -= placeValue;
  }
  return steps;
}

/** Digit array for a value, e.g. (binary, 42) -> [0,0,1,0,1,0,1,0]. */
function toDigits(mode, value) {
  return getWorkingSteps(mode, value).map(function (step) {
    return step.digit;
  });
}

/** True when value is a whole number inside the mode's range. */
function isValidInput(mode, value) {
  return Number.isInteger(value) && value >= mode.min && value <= mode.max;
}
