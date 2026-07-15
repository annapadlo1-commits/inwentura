/**
 * Inventory PRO Enterprise v2.1.2 LTS
 * Odporne wyszukiwanie arkuszy po nazwie.
 */

function getSheetByConfiguredName_(configuredName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const wanted = normalizeText(configuredName);

  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (normalizeText(sheets[i].getName()) === wanted) {
      return sheets[i];
    }
  }

  return null;
}

function getOrCreateConfiguredSheet_(configuredName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getSheetByConfiguredName_(configuredName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(configuredName);
  }

  return sheet;
}
