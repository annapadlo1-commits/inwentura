/**
 * Inventory PRO Enterprise v2.4
 * Raport importow z informacja o duplikatach i flagach jakosci.
 */

function appendImportReport_(importId, results) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.REPORT);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEETS.REPORT);
  }

  ensureReportHeaders_(sheet);

  const timestamp = new Date();
  const user = getCurrentUserEmail_();

  const rows = results.map(result => [
    importId,
    timestamp,
    user,
    result.originalInput || '',
    result.product || '',
    result.addedValue === null || result.addedValue === undefined
      ? ''
      : result.addedValue,
    result.location || '',
    result.saved ? 'ZAPISANO' : 'POMINIETO',
    result.message || '',
    result.column || '',
    result.row || '',
    result.duplicateCount || 1,
    Array.isArray(result.duplicateValues)
      ? result.duplicateValues.join(' + ')
      : '',
    result.duplicateTotal === null || result.duplicateTotal === undefined
      ? ''
      : result.duplicateTotal,
    result.duplicateWarning ? 'DUPLIKAT' : '',
    Array.isArray(result.qualityFlags)
      ? result.qualityFlags.join(', ')
      : '',
    result.qualityLevel || '',
    result.previousValue === null || result.previousValue === undefined
      ? ''
      : result.previousValue,
    result.newValue === null || result.newValue === undefined
      ? ''
      : result.newValue
  ]);

  if (!rows.length) return;

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
    .setValues(rows);
}

function ensureReportHeaders_(sheet) {
  const headers = [[
    'Import ID',
    'Data',
    'Uzytkownik',
    'Wpis uzytkownika',
    'Produkt',
    'Wartosc wpisu',
    'Lokalizacja',
    'Status',
    'Informacja',
    'Kolumna',
    'Wiersz',
    'Liczba wystapien',
    'Wartosci zrodlowe',
    'Suma duplikatow',
    'Flaga duplikatu',
    'Flagi jakosci',
    'Poziom jakosci',
    'Wartosc przed importem',
    'Wartosc po imporcie'
  ]];

  sheet.getRange(1, 1, 1, headers[0].length)
    .setValues(headers)
    .setFontWeight('bold')
    .setBackground('#ead1dc');

  sheet.setFrozenRows(1);
}
