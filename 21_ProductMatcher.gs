/**
 * Inventory PRO Enterprise v2.3.0
 * Publiczny interfejs dopasowania. Logika znajduje sie w RecognitionEngine.gs.
 */
function matchProduct(inputName, runtimeContext) {
  return recognizeProduct_(inputName, runtimeContext);
}

function calculateStringSimilarity_(textA, textB) {
  const a = String(textA || '');
  const b = String(textB || '');
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  return 1 - (levenshteinDistance_(a, b) / Math.max(a.length, b.length));
}

function levenshteinDistance_(textA, textB) {
  const a = String(textA || '');
  const b = String(textB || '');
  const previous = new Array(a.length + 1);
  const current = new Array(a.length + 1);
  for (let column = 0; column <= a.length; column++) previous[column] = column;
  for (let row = 1; row <= b.length; row++) {
    current[0] = row;
    for (let column = 1; column <= a.length; column++) {
      const cost = b.charAt(row - 1) === a.charAt(column - 1) ? 0 : 1;
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + cost);
    }
    for (let column = 0; column <= a.length; column++) previous[column] = current[column];
  }
  return previous[a.length];
}
