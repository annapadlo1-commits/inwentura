/**
 * Inventory PRO Enterprise v2.8.2
 * Zarządzanie prostym widokiem użytkownika i widokiem managera.
 */

function showUserWorkspace() {
  setWorkspaceMode_('USER');
  applyWorkspaceVisibility_('USER');
  activateSheetByName_(CONFIG.SHEETS.INVENTORY);
  SpreadsheetApp.getActive().toast('Widok użytkownika: INWENTURA. Raporty znajdziesz w menu INVENTORY PRO.', 'Inventory PRO', 5);
}

function showManagerWorkspace() {
  setWorkspaceMode_('MANAGER');
  applyWorkspaceVisibility_('MANAGER');
  SpreadsheetApp.getActive().toast('Pokazano arkusze administracyjne.', 'Inventory PRO', 5);
}

function applySavedWorkspaceMode() {
  const mode = getWorkspaceMode_();
  applyWorkspaceVisibility_(mode);
  return mode;
}

function getWorkspaceMode_() {
  return PropertiesService.getUserProperties().getProperty('INVENTORY_PRO_WORKSPACE_MODE') || 'USER';
}

function setWorkspaceMode_(mode) {
  PropertiesService.getUserProperties().setProperty('INVENTORY_PRO_WORKSPACE_MODE', mode);
}

function applyWorkspaceVisibility_(mode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const technical = [
    CONFIG.SHEETS.DICTIONARY,
    CONFIG.SHEETS.REPORT,
    CONFIG.SHEETS.SETTINGS,
    CONFIG.SHEETS.HISTORY,
    CONFIG.SHEETS.TECH_LOG,
    CONFIG.SHEETS.IMPORT_AUDIT,
    CONFIG.SHEETS.NEW_PRODUCTS,
    CONFIG.SHEETS.DATA_AUDIT,
    CONFIG.SHEETS.EXPORT_HISTORY,
    CONFIG.SHEETS.HISTORY_LEGACY
  ];

  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    const isArchive = /^ARCHIWUM\b/i.test(name) || /^BACKUP STYLE\b/i.test(name);
    const shouldHide = mode === 'USER' && (technical.indexOf(name) >= 0 || isArchive);
    if (shouldHide) {
      if (!sheet.isSheetHidden()) sheet.hideSheet();
    } else if (mode === 'MANAGER') {
      if (sheet.isSheetHidden()) sheet.showSheet();
    }
  });

  const inventory = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  if (inventory && inventory.isSheetHidden()) inventory.showSheet();
}