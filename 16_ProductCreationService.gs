/**
 * Inventory PRO Enterprise v2.5
 * Bezpieczny workflow tworzenia nowych produktow z poziomu importu.
 */

function getProductResolverData(inputName) {
  const context = buildRuntimeContext_();
  const normalized = normalizeText(inputName);
  const suggestions = context.catalog
    .map(product => scoreRecognitionCandidate_(inputName, product))
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, 12)
    .map(item => ({
      name: item.product.name,
      type: item.product.type,
      category: item.product.category,
      score: Math.round(item.score),
      inventoryRow: item.product.inventoryRow || null
    }));

  return {
    inputName: String(inputName || '').trim(),
    normalizedInput: normalized,
    suggestions: suggestions,
    products: context.catalog.map(product => ({
      name: product.name,
      type: product.type,
      category: product.category,
      inventoryRow: product.inventoryRow || null
    })).sort((a, b) => a.name.localeCompare(b.name)),
    categories: Array.from(new Set(context.catalog.map(product => product.category).filter(Boolean))).sort(),
    productTypes: Object.keys(CONFIG.PRODUCT_TYPES).map(key => CONFIG.PRODUCT_TYPES[key])
  };
}

function createNewProductFromImport(request) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const data = request || {};
    const name = String(data.name || '').trim();
    const referenceName = String(data.referenceProduct || '').trim();
    const requestedType = String(data.productType || '').trim().toUpperCase();
    const requestedCategory = String(data.category || '').trim();

    validateNewProductName_(name);

    const context = buildRuntimeContext_();
    if (context.productIndex[normalizeText(name)]) {
      throw new Error('Produkt o tej nazwie juz istnieje: ' + name);
    }
    if (context.aliasIndex[normalizeText(name)]) {
      throw new Error('Ta nazwa jest juz aliasem istniejacego produktu. Wybierz produkt zamiast tworzyc nowy.');
    }

    const reference = referenceName
      ? context.productIndex[normalizeText(referenceName)]
      : null;

    if (referenceName && !reference) {
      throw new Error('Nie znaleziono produktu referencyjnego: ' + referenceName);
    }

    const productType = reference ? reference.type : requestedType;
    const category = normalizeBusinessCategory_(reference ? reference.category : requestedCategory);

    if (!Object.values(CONFIG.PRODUCT_TYPES).includes(productType)) {
      throw new Error('Wybierz prawidlowy typ produktu.');
    }
    if (!category) {
      throw new Error('Wybierz kategorie produktu.');
    }

    const inventorySheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
    if (!inventorySheet) throw new Error('Nie znaleziono arkusza inwentury.');

    const insertion = insertProductInventoryRow_(inventorySheet, name, reference, productType);
    const columns = reference && reference.columns
      ? reference.columns
      : defaultColumnsForProductType_(productType);

    const dictionaryResult = ensureNewProductInDictionary_({
      name: name,
      productType: productType,
      category: category,
      columns: columns,
      sourceAlias: data.sourceAlias || ''
    });

    const auditAdded = appendNewProductAudit_(name, reference ? reference.name : '', productType, category, insertion.row, data.sourceInput || '');

    // Najpierw zatwierdzamy zmiany w arkuszu, a dopiero potem usuwamy cache.
    // Dzięki temu odbudowany katalog widzi nowy wiersz i jego aktualny numer.
    SpreadsheetApp.flush();
    invalidateProductCatalogCache_();

    const refreshed = buildRuntimeContext_();
    const product = refreshed.productIndex[normalizeText(name)];
    if (!product || !product.inventoryRow) {
      throw new Error('Produkt zostal dodany, ale nie udalo sie odswiezyc katalogu. Uruchom synchronizacje slownika.');
    }

    return {
      success: true,
      product: {
        name: product.name,
        type: product.type,
        category: product.category,
        inventoryRow: product.inventoryRow
      },
      dictionaryUpdated: true,
      dictionaryConfigurationRow: dictionaryResult.configurationRow,
      dictionaryAliasesAdded: dictionaryResult.addedAliases,
      newProductAuditAdded: auditAdded,
      message: 'Dodano nowy produkt: ' + product.name + ' i zaktualizowano slownik.'
    };
  } finally {
    lock.releaseLock();
  }
}

function validateNewProductName_(name) {
  if (!name) throw new Error('Nazwa produktu nie moze byc pusta.');
  if (name.length < 2) throw new Error('Nazwa produktu jest za krotka.');
  if (/^\d+(?:[.,]\d+)?$/.test(name)) throw new Error('Nazwa produktu nie moze skladac sie tylko z liczby.');
}

function insertProductInventoryRow_(sheet, name, reference, productType) {
  const lastColumn = Math.max(sheet.getLastColumn(), 9);
  let insertAfter = reference && reference.inventoryRow
    ? reference.inventoryRow
    : sheet.getLastRow();

  if (insertAfter < 1) insertAfter = 1;
  sheet.insertRowAfter(insertAfter);
  const targetRow = insertAfter + 1;

  if (reference && reference.inventoryRow) {
    const sourceRange = sheet.getRange(reference.inventoryRow, 1, 1, lastColumn);
    const targetRange = sheet.getRange(targetRow, 1, 1, lastColumn);
    sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
  }

  sheet.getRange(targetRow, 1).setValue(name);
  clearNewProductInputCells_(sheet, targetRow, reference, productType);

  return { row: targetRow };
}

function clearNewProductInputCells_(sheet, row, reference, productType) {
  const columns = reference && reference.columns
    ? reference.columns
    : defaultColumnsForProductType_(productType);

  const candidates = [
    columns.quantity,
    columns.weight,
    columns.warehouse,
    columns.darkroom,
    columns.fridges
  ].filter(Boolean);

  Array.from(new Set(candidates)).forEach(column => {
    const cell = sheet.getRange(column + row);
    if (!cell.getFormula()) cell.clearContent();
  });
}

function defaultColumnsForProductType_(productType) {
  if (productType === CONFIG.PRODUCT_TYPES.LOCATION) {
    return { quantity: '', weight: '', warehouse: 'B', darkroom: 'C', fridges: 'D' };
  }
  if (productType === CONFIG.PRODUCT_TYPES.KEG) {
    return { quantity: 'G', weight: 'C', warehouse: '', darkroom: '', fridges: '' };
  }
  return { quantity: 'H', weight: 'C', warehouse: '', darkroom: '', fridges: '' };
}

function appendProductConfiguration_(name, productType, category, reference) {
  const sheet = getDictionarySheet_();
  const columns = reference && reference.columns
    ? reference.columns
    : defaultColumnsForProductType_(productType);

  const row = [
    name,
    productType,
    category,
    columns.quantity || '',
    columns.weight || '',
    columns.warehouse || '',
    columns.darkroom || '',
    columns.fridges || '',
    'TAK'
  ];

  sheet.getRange(sheet.getLastRow() + 1, CONFIG.DICTIONARY.CONFIG_START_COLUMN, 1, CONFIG.DICTIONARY.CONFIG_COLUMN_COUNT).setValues([row]);
}

function getOrCreateNewProductsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.NEW_PRODUCTS);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.SHEETS.NEW_PRODUCTS);

  const headers = ['Timestamp', 'User', 'Produkt', 'Produkt referencyjny', 'Typ', 'Kategoria', 'Wiersz inwentury', 'Wpis z importu'];
  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (current.join('|') !== headers.join('|')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function appendNewProductAudit_(name, referenceName, productType, category, inventoryRow, sourceInput) {
  const sheet = getOrCreateNewProductsSheet_();
  const normalizedName = normalizeText(name);
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const existing = sheet.getRange(2, 3, lastRow - 1, 5).getValues();
    const duplicate = existing.some(row =>
      normalizeText(row[0]) === normalizedName &&
      Number(row[4] || 0) === Number(inventoryRow || 0)
    );

    if (duplicate) {
      logInfo('ProductCreationService', 'appendNewProductAudit_',
        'Pominieto duplikat wpisu w historii nowych produktow.',
        { name: name, inventoryRow: inventoryRow });
      return false;
    }
  }

  sheet.appendRow([
    new Date(),
    Session.getActiveUser().getEmail() || '',
    name,
    referenceName,
    productType,
    normalizeBusinessCategory_(category),
    inventoryRow,
    sourceInput
  ]);
  return true;
}
