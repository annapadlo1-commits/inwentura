/**
 * Inventory PRO Enterprise
 * Walidacja konfiguracji i arkuszy.
 */

function validateEnterpriseConfiguration() {
  const result = buildValidationReport_();

  logInfo(
    'Core_Validation',
    'validateEnterpriseConfiguration',
    result.valid ? 'Konfiguracja poprawna' : 'Wykryto problemy',
    result
  );

  const message = formatValidationReport_(result);

  SpreadsheetApp.getUi().alert(
    'Inventory PRO - Walidacja',
    message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return result;
}

function buildValidationReport_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const errors = [];
  const warnings = [];

  const requiredSheets = [
    CONFIG.SHEETS.INVENTORY,
    CONFIG.SHEETS.DICTIONARY,
    CONFIG.SHEETS.REPORT,
    CONFIG.SHEETS.SETTINGS,
    CONFIG.SHEETS.HISTORY,
    CONFIG.SHEETS.TECH_LOG,
    CONFIG.SHEETS.IMPORT_AUDIT
  ];

  requiredSheets.forEach(sheetName => {
    if (!getSheetByConfiguredName_(sheetName)) {
      errors.push('Brak arkusza: ' + sheetName);
    }
  });

  const dictionarySheet = getSheetByConfiguredName_(CONFIG.SHEETS.DICTIONARY);

  if (dictionarySheet) {
    const aliasHeader = String(
      dictionarySheet.getRange(1, 1).getDisplayValue() || ''
    ).trim();

    const productHeader = String(
      dictionarySheet.getRange(1, 4).getDisplayValue() || ''
    ).trim();

    if (!aliasHeader) {
      warnings.push('Brak naglowka aliasow w A1 arkusza Slownik.');
    }

    if (normalizeText(productHeader) !== 'produkt') {
      errors.push(
        'Kolumna D arkusza Slownik powinna miec naglowek Produkt.'
      );
    }
  }

  let catalogSummary = null;

  try {
    catalogSummary = getProductCatalogSummary();

    if (catalogSummary.products === 0) {
      errors.push('Katalog produktow jest pusty.');
    }

    if (catalogSummary.missingInventoryRow > 0) {
      warnings.push(
        'Produkty bez wiersza w Inwentura: ' +
        catalogSummary.missingInventoryRow
      );
    }
  } catch (error) {
    errors.push(
      'Nie udalo sie zbudowac katalogu: ' +
      normalizeError_(error).message
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    catalogSummary
  };
}

function formatValidationReport_(result) {
  let message = result.valid
    ? 'Konfiguracja jest poprawna.'
    : 'Konfiguracja wymaga poprawy.';

  if (result.errors.length) {
    message += '\n\nBLEDY:\n- ' + result.errors.join('\n- ');
  }

  if (result.warnings.length) {
    message += '\n\nOSTRZEZENIA:\n- ' + result.warnings.join('\n- ');
  }

  if (result.catalogSummary) {
    message +=
      '\n\nKATALOG:\n' +
      'Produkty: ' + result.catalogSummary.products + '\n' +
      'Aliasy: ' + result.catalogSummary.aliases + '\n' +
      'NORMAL: ' + result.catalogSummary.normal + '\n' +
      'KEG: ' + result.catalogSummary.keg + '\n' +
      'LOCATION: ' + result.catalogSummary.location;
  }

  return message;
}

function showEnterpriseDiagnostics() {
  const validation = buildValidationReport_();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const catalog = validation.catalogSummary || {};

  const lines = [
    'Wersja: ' + CONFIG.VERSION,
    'Plik: ' + spreadsheet.getName(),
    'Strefa czasowa: ' + spreadsheet.getSpreadsheetTimeZone(),
    'Ustawienia regionalne: ' + spreadsheet.getSpreadsheetLocale(),
    '',
    'STATUS: ' + (validation.valid ? 'POPRAWNY' : 'WYMAGA UWAGI'),
    'Błędy: ' + validation.errors.length,
    'Ostrzeżenia: ' + validation.warnings.length,
    '',
    'KATALOG',
    'Produkty: ' + Number(catalog.products || 0),
    'Aliasy: ' + Number(catalog.aliases || 0),
    'NORMAL: ' + Number(catalog.normal || 0),
    'KEG: ' + Number(catalog.keg || 0),
    'LOCATION: ' + Number(catalog.location || 0),
    'Brak wiersza INWENTURA: ' + Number(catalog.missingInventoryRow || 0)
  ];

  if (validation.errors.length) {
    lines.push('', 'BŁĘDY', '- ' + validation.errors.join('\n- '));
  }
  if (validation.warnings.length) {
    lines.push('', 'OSTRZEŻENIA', '- ' + validation.warnings.join('\n- '));
  }

  const diagnostics = {
    version: CONFIG.VERSION,
    spreadsheetName: spreadsheet.getName(),
    spreadsheetId: spreadsheet.getId(),
    timezone: spreadsheet.getSpreadsheetTimeZone(),
    locale: spreadsheet.getSpreadsheetLocale(),
    validation: validation
  };

  logInfo(
    'Core_Validation',
    'showEnterpriseDiagnostics',
    'Wygenerowano diagnostykę',
    diagnostics
  );

  SpreadsheetApp.getUi().alert(
    'Inventory PRO - Diagnostyka',
    lines.join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
