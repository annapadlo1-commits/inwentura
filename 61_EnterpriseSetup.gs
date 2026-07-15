/**
 * Inventory PRO Enterprise v2.1
 * Konfiguracja arkuszy Enterprise.
 */
function enterpriseSetup() {
  const startedAt = Date.now();

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    invalidateProductCatalogCache_();

    getOrCreateBusinessHistorySheet_();
    ensureTechnicalLogHeaders_(getOrCreateTechnicalLogSheet_());
    getOrCreateTechnicalHistorySheet_();
    ensureQualitySettingsSheet_();
    getOrCreateNewProductsSheet_();
    ensureActiveInventorySession_();
    repairDictionaryCategoriesFromInventory();
    cleanupLegacyInventoryProSheets_();
    applyInventoryTheme();
    applySavedWorkspaceMode();

    let reportSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.REPORT);
    if (!reportSheet) {
      reportSheet = spreadsheet.insertSheet(CONFIG.SHEETS.REPORT);
    }
    ensureReportHeaders_(reportSheet);

    logInfo(
      'EnterpriseSetup',
      'enterpriseSetup',
      'Inventory PRO 3.0 RC4 zostal zainicjalizowany',
      {
        spreadsheetName: spreadsheet.getName(),
        spreadsheetId: spreadsheet.getId()
      },
      Date.now() - startedAt
    );

    spreadsheet.toast(
      'Enterprise v' + CONFIG.VERSION + ' gotowy.',
      'Inventory PRO',
      8
    );

    return {
      success: true,
      version: CONFIG.VERSION,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    try {
      logError(
        'EnterpriseSetup',
        'enterpriseSetup',
        error,
        null,
        Date.now() - startedAt
      );
    } catch (loggingError) {
      console.error(loggingError);
    }

    throw error;
  }
}


/** Ukrywa stare, zduplikowane zakładki. Nie usuwa danych automatycznie. */
function cleanupLegacyInventoryProSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Historia eksportow'].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && !sheet.isSheetHidden()) sheet.hideSheet();
  });
  ss.getSheets().forEach(sheet => {
    if (/^FINAL\b/i.test(sheet.getName()) && !sheet.isSheetHidden()) sheet.hideSheet();
  });
}
