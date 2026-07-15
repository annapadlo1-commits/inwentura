/**
 * Inventory PRO Enterprise v2.1
 * Cofanie ostatniego importu.
 */

function undoLastImport() {
  const ui = SpreadsheetApp.getUi();
  const importId = getLastActiveImportId_();

  if (!importId) {
    ui.alert('Nie znaleziono importu do cofniecia.');
    return;
  }

  const response = ui.alert(
    'Cofnij ostatni import',
    'Czy na pewno cofnac import:\n' + importId + '?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const result = undoImportById_(importId);

  ui.alert(
    'Cofanie importu',
    'Przywrocono pozycji: ' + result.restoredCount +
      '\nPominieto: ' + result.skippedCount,
    ui.ButtonSet.OK
  );
}

function undoImportById_(importId) {
  const lock = LockService.getDocumentLock();

  try {
    lock.waitLock(30000);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const inventorySheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INVENTORY);
    const historySheet = getOrCreateTechnicalHistorySheet_();

    if (!inventorySheet) {
      throw new Error('Nie znaleziono arkusza Inwentura.');
    }

    const lastRow = historySheet.getLastRow();
    if (lastRow < 2) {
      return { importId, restoredCount: 0, skippedCount: 0 };
    }
    const values = historySheet.getRange(2, 1, lastRow - 1, 16).getValues();

    let restoredCount = 0;
    let skippedCount = 0;
    const undoneAt = new Date();
    const undoneBy = getCurrentUserEmail_();

    values.forEach((row, index) => {
      const rowImportId = String(row[0] || '').trim();
      const status = String(row[12] || '').trim();
      const alreadyUndone = row[13];

      if (rowImportId !== importId || status !== 'SAVED' || alreadyUndone) {
        return;
      }

      const targetRow = Number(row[8]);
      const targetColumn = String(row[9] || '').trim();
      const previousValue = row[10];

      if (!targetRow || !targetColumn) {
        skippedCount++;
        return;
      }

      inventorySheet.getRange(targetColumn + targetRow).setValue(previousValue);

      const historyRow = index + 2;
      historySheet.getRange(historyRow, 14).setValue(undoneAt);
      historySheet.getRange(historyRow, 15).setValue(undoneBy);
      historySheet.getRange(historyRow, 13).setValue('UNDONE');

      restoredCount++;
    });

    SpreadsheetApp.flush();

    logInfo(
      'UndoService',
      'undoImportById_',
      'Cofnieto import',
      { importId, restoredCount, skippedCount }
    );

    return { importId, restoredCount, skippedCount };
  } finally {
    lock.releaseLock();
  }
}
