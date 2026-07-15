/**
 * Inventory PRO Enterprise v2.1.2 LTS
 * Archiwizacja i czyszczenie inwentury.
 */

function startNewInventory() {
  const sheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  if (!sheet) throw new Error('Nie znaleziono arkusza Inwentura.');
  if (hasCurrentInventoryData_(sheet)) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Najpierw zakończ bieżącą inwentaryzację. Otwieram końcowy przegląd.','Inventory PRO',8);
    showFinalReview();
    return;
  }
  startInventorySession_();
  appendApplicationEvent_('INVENTORY_STARTED','Rozpoczęto nową inwentaryzację',{});
  SpreadsheetApp.getActiveSpreadsheet().toast('Nowa inwentaryzacja jest aktywna.','Inventory PRO',6);
}

function hasCurrentInventoryData_(sheet) {
  const products = buildProductCatalog();
  return products.some(product => {
    if (!product.inventoryRow) return false;
    const c=product.columns||{};
    const cols=product.type===CONFIG.PRODUCT_TYPES.LOCATION?[c.warehouse,c.darkroom,c.fridges]:[c.weight,c.quantity];
    return cols.filter(Boolean).some(col=>sheet.getRange(col+product.inventoryRow).getValue() !== '');
  });
}

function clearCurrentInventory() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Wyczysc biezaca inwenture',
    'Dane zostana wyczyszczone bez tworzenia archiwum. Kontynuowac?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const sheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);

  if (!sheet) {
    throw new Error('Nie znaleziono arkusza Inwentura.');
  }

  const result = clearCurrentInventoryData_(sheet);

  logInfo(
    'InventoryLifecycle',
    'clearCurrentInventory',
    'Wyczyszczono biezaca inwenture',
    result
  );

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Wyczyszczono ' + result.clearedCells + ' pol.',
    'Inventory PRO',
    8
  );
}

function clearCurrentInventoryData_(sheet) {
  const products = buildProductCatalog();
  const a1Set = {};

  products.forEach(product => {
    if (!product.inventoryRow) return;

    const columns = product.columns || {};

    if (product.type === CONFIG.PRODUCT_TYPES.LOCATION) {
      [columns.warehouse, columns.darkroom, columns.fridges]
        .filter(Boolean)
        .forEach(column => {
          a1Set[column + product.inventoryRow] = true;
        });
    } else {
      [columns.weight, columns.quantity]
        .filter(Boolean)
        .forEach(column => {
          a1Set[column + product.inventoryRow] = true;
        });
    }
  });

  const a1List = Object.keys(a1Set);

  if (a1List.length) {
    sheet.getRangeList(a1List).clearContent();
  }

  SpreadsheetApp.flush();

  return {
    clearedCells: a1List.length
  };
}

function createUniqueArchiveName_(spreadsheet, baseName) {
  let name = baseName;
  let counter = 2;

  while (spreadsheet.getSheetByName(name)) {
    name = baseName + ' (' + counter + ')';
    counter++;
  }

  return name;
}
