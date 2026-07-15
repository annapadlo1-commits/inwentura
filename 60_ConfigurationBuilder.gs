/**
 * Inventory PRO Enterprise v2.2
 * Automatyczna konfiguracja produktow.
 */

function rebuildProductConfiguration() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    'Odbuduj konfiguracje',
    'Skrypt wyczysci konfiguracje w kolumnach D:L arkusza Slownik i zbuduje ja ponownie z arkusza Inwentura. Aliasy w A:B pozostana bez zmian. Kontynuowac?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const products = scanInventoryProducts_();

    if (!products.length) {
      throw new Error(
        'Nie znaleziono produktow w arkuszu Inwentura.'
      );
    }

    writeFullProductConfiguration_(products);
    invalidateProductCatalogCache_();

    ui.alert(
      'Configuration Builder',
      'Zbudowano konfiguracje dla ' +
        products.length +
        ' produktow.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      'Blad Configuration Builder',
      error.message || String(error),
      ui.ButtonSet.OK
    );
  }
}

function syncProductConfiguration() {
  const ui = SpreadsheetApp.getUi();

  try {
    const scannedProducts = scanInventoryProducts_();
    const existingIndex = getExistingConfigurationIndex_();

    const newProducts = scannedProducts.filter(
      product => !existingIndex[product.normalizedName]
    );

    if (!newProducts.length) {
      ui.alert(
        'Synchronizacja zakonczona',
        'Nie znaleziono nowych produktow.',
        ui.ButtonSet.OK
      );
      return;
    }

    appendProductConfigurations_(newProducts);
    invalidateProductCatalogCache_();

    ui.alert(
      'Synchronizacja zakonczona',
      'Dodano nowych produktow: ' +
        newProducts.length,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      'Blad synchronizacji',
      error.message || String(error),
      ui.ButtonSet.OK
    );
  }
}

function scanInventoryProducts_() {
  const sheet = getSheetByConfiguredName_(
    CONFIG.SHEETS.INVENTORY
  );

  if (!sheet) {
    throw new Error(
      'Nie znaleziono arkusza: ' +
        CONFIG.SHEETS.INVENTORY
    );
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(
    sheet.getLastColumn(),
    12
  );

  if (lastRow < 1) return [];

  const dataRange = sheet.getRange(
    1,
    1,
    lastRow,
    lastColumn
  );

  const values = dataRange.getDisplayValues();
  const mergedHeaderRows =
    buildMergedHeaderRowMap_(dataRange);

  const products = [];
  const usedNames = {};

  let currentCategory = '';
  let currentType =
    CONFIG.PRODUCT_TYPES.NORMAL;

  for (
    let rowIndex = 0;
    rowIndex < values.length;
    rowIndex++
  ) {
    const sheetRow = rowIndex + 1;
    const rowValues = values[rowIndex];

    const productName = String(
      rowValues[0] || ''
    ).trim();

    const rowText = rowValues
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!rowText) continue;

    const detectedHeader =
      detectSectionHeader_(
        rowText,
        sheetRow,
        mergedHeaderRows
      );

    if (detectedHeader.isHeader) {
      currentCategory =
        detectedHeader.category;
      currentType =
        detectedHeader.type;
      continue;
    }

    if (
      !productName ||
      isIgnoredInventoryText_(productName)
    ) {
      continue;
    }

    const normalizedName =
      normalizeText(productName);

    if (
      !normalizedName ||
      usedNames[normalizedName]
    ) {
      continue;
    }

    usedNames[normalizedName] = true;

    if (!currentCategory) {
      logWarning('ConfigurationBuilder', 'scanInventoryProducts_', 'Pominięto produkt bez fizycznej kategorii.', { product: productName, row: sheetRow });
      continue;
    }

    products.push(
      createConfigurationProduct_(
        productName,
        normalizedName,
        currentCategory,
        currentType,
        sheetRow
      )
    );
  }

  return products;
}

function buildMergedHeaderRowMap_(dataRange) {
  const map = {};

  dataRange
    .getMergedRanges()
    .forEach(range => {
      if (range.getNumColumns() <= 1) {
        return;
      }

      for (
        let row = range.getRow();
        row <= range.getLastRow();
        row++
      ) {
        map[row] = true;
      }
    });

  return map;
}

function detectSectionHeader_(
  rowText,
  sheetRow,
  mergedHeaderRows
) {
  const normalized = normalizeText(rowText);
  const isMergedHeader =
    Boolean(mergedHeaderRows[sheetRow]);

  const isKeg =
    normalized.includes('piwo keg') ||
    normalized.includes('piwa keg') ||
    normalized === 'keg';

  const isBottleBeer =
    normalized.includes('piwo butel') ||
    normalized.includes('piwa butel');

  const isSoft =
    normalized === 'softy' ||
    normalized.includes('softy na szt') ||
    normalized.includes('soft');

  if (isKeg) {
    return {
      isHeader: true,
      category: normalizeBusinessCategory_(rowText),
      type: CONFIG.PRODUCT_TYPES.KEG
    };
  }

  if (isBottleBeer || isSoft) {
    return {
      isHeader: true,
      category: normalizeBusinessCategory_(rowText),
      type: CONFIG.PRODUCT_TYPES.LOCATION
    };
  }

  const strictCategory = normalizeBusinessCategory_(rowText);
  if (isMergedHeader && strictCategory && strictCategory !== 'PIWO KEG' && strictCategory !== 'PIWO BUTELKI' && strictCategory !== 'SOFTY') {
    return {
      isHeader: true,
      category: strictCategory,
      type: CONFIG.PRODUCT_TYPES.NORMAL
    };
  }

  return {
    isHeader: false,
    category: '',
    type: ''
  };
}

function isLikelyCategoryHeader_(rowText) {
  const normalized = normalizeText(rowText);

  if (!normalized) return false;

  const ignoredHeaders = [
    'produkt',
    'waga',
    'razem',
    'magazyn',
    'darkroom',
    'lodowki',
    'ilosc',
    'szt',
    'w butelce',
    'waga bez butelki'
  ];

  if (
    ignoredHeaders.some(header =>
      normalized.includes(header)
    )
  ) {
    return false;
  }

  return normalized.split(' ').length <= 8;
}

function isIgnoredInventoryText_(text) {
  return [
    'produkt',
    'produkty',
    'nazwa produktu',
    'wpis uzytkownika',
    'razem',
    'suma'
  ].includes(normalizeText(text));
}

function createConfigurationProduct_(
  name,
  normalizedName,
  category,
  type,
  inventoryRow
) {
  const columns = {
    quantity: '',
    weight: '',
    warehouse: '',
    darkroom: '',
    fridges: ''
  };

  if (
    type === CONFIG.PRODUCT_TYPES.LOCATION
  ) {
    columns.warehouse = 'B';
    columns.darkroom = 'C';
    columns.fridges = 'D';
  } else if (
    type === CONFIG.PRODUCT_TYPES.KEG
  ) {
    columns.quantity = 'G';
    columns.weight = 'C';
  } else {
    columns.quantity = 'H';
    columns.weight = 'C';
  }

  return {
    name: name,
    normalizedName: normalizedName,
    type: type,
    category: requireBusinessCategory_(category, name, inventoryRow),
    inventoryRow: inventoryRow,
    columns: columns,
    active: true
  };
}

function writeFullProductConfiguration_(
  products
) {
  const sheet = getDictionarySheet_();

  ensureConfigurationHeaders_(sheet);

  const rowsToClear = Math.max(
    sheet.getMaxRows() - 1,
    1
  );

  sheet
    .getRange(2, 4, rowsToClear, 9)
    .clearContent();

  const output = products.map(
    configurationToRow_
  );

  if (output.length) {
    sheet
      .getRange(
        2,
        4,
        output.length,
        9
      )
      .setValues(output);
  }

  formatConfigurationTable_(
    sheet,
    output.length
  );
}

function appendProductConfigurations_(
  products
) {
  const sheet = getDictionarySheet_();

  ensureConfigurationHeaders_(sheet);

  const output = products.map(
    configurationToRow_
  );

  if (!output.length) return;

  const startRow =
    findNextConfigurationRow_(sheet);

  sheet
    .getRange(
      startRow,
      4,
      output.length,
      9
    )
    .setValues(output);

  formatConfigurationTable_(
    sheet,
    startRow + output.length - 2
  );
}

function configurationToRow_(product) {
  return [
    product.name,
    product.type,
    product.category,
    product.columns.quantity,
    product.columns.weight,
    product.columns.warehouse,
    product.columns.darkroom,
    product.columns.fridges,
    product.active ? 'TAK' : 'NIE'
  ];
}

function getExistingConfigurationIndex_() {
  const index = {};

  loadProductConfigurations()
    .forEach(product => {
      index[product.normalizedName] = true;
    });

  return index;
}

function findNextConfigurationRow_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return 2;

  const values = sheet
    .getRange(
      2,
      4,
      lastRow - 1,
      1
    )
    .getDisplayValues();

  for (
    let index = 0;
    index < values.length;
    index++
  ) {
    if (
      !String(values[index][0] || '')
        .trim()
    ) {
      return index + 2;
    }
  }

  return lastRow + 1;
}

function ensureConfigurationHeaders_(sheet) {
  sheet
    .getRange(1, 4, 1, 9)
    .setValues([[
      'Produkt',
      'Typ',
      'Kategoria',
      'Kolumna sztuk',
      'Kolumna wagi',
      'Magazyn',
      'Darkroom',
      'Lodowki',
      'Aktywny'
    ]])
    .setFontWeight('bold')
    .setBackground('#d9ead3');
}

function formatConfigurationTable_(
  sheet,
  productCount
) {
  sheet.autoResizeColumns(4, 9);

  if (productCount > 0) {
    sheet
      .getRange(
        2,
        4,
        productCount,
        9
      )
      .setVerticalAlignment('middle');
  }
}

function cleanCategoryName_(rowText) {
  return String(rowText || '')
    .replace(/\s+/g, ' ')
    .trim();
}
