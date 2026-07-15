function getDictionarySheet_() {
  const sheet = getSheetByConfiguredName_(
    CONFIG.SHEETS.DICTIONARY
  );

  if (!sheet) {
    throw new Error(
      'Nie znaleziono arkusza: ' +
      CONFIG.SHEETS.DICTIONARY
    );
  }

  return sheet;
}

function loadAliases() {
  const sheet = getDictionarySheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {};
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 2)
    .getValues();

  const result = {};

  values.forEach(row => {
    const alias = normalizeText(row[0]);
    const product = String(row[1] || '').trim();

    if (alias && product) {
      result[alias] = product;
    }
  });

  return result;
}

function loadProductConfigurations() {
  const sheet = getDictionarySheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 4, lastRow - 1, 9)
    .getValues()
    .map((row, index) => ({
      dictionaryRow: index + 2,
      name: String(row[0] || '').trim(),
      normalizedName: normalizeText(row[0]),
      type: String(row[1] || 'NORMAL')
        .trim()
        .toUpperCase(),
      category: String(row[2] || '').trim(),
      columns: {
        quantity: String(row[3] || '')
          .trim()
          .toUpperCase(),
        weight: String(row[4] || '')
          .trim()
          .toUpperCase(),
        warehouse: String(row[5] || '')
          .trim()
          .toUpperCase(),
        darkroom: String(row[6] || '')
          .trim()
          .toUpperCase(),
        fridges: String(row[7] || '')
          .trim()
          .toUpperCase()
      },
      active: ['tak', 'true', '1'].includes(
        normalizeText(row[8])
      )
    }))
    .filter(product => product.name && product.active);
}

function saveAliasesBatch_(aliasSuggestions) {
  if (!Array.isArray(aliasSuggestions) || !aliasSuggestions.length) return 0;

  const sheet = getDictionarySheet_();
  const existing = loadAliases();
  const context = buildRuntimeContext_();
  const rows = [];
  const pending = {};

  aliasSuggestions.forEach(suggestion => {
    const validation = validateAliasSuggestion_(suggestion, context, existing);
    if (!validation.valid) {
      logWarning('Dictionary', 'saveAliasesBatch_', 'Alias pominiety: ' + validation.reason, suggestion);
      return;
    }

    const key = normalizeText(validation.alias);
    if (pending[key]) return;
    rows.push([validation.alias, validation.product]);
    pending[key] = true;
    existing[key] = validation.product;
  });

  if (!rows.length) return 0;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
  invalidateProductCatalogCache_();
  return rows.length;
}

/**
 * Dodaje lub aktualizuje pelny rekord nowego produktu w arkuszu SLOWNIK.
 * Tabele aliasow (A:B) i konfiguracji (D:L) sa niezalezne, dlatego
 * wyszukujemy pierwszy pusty wiersz osobno dla kazdej z nich.
 */
function ensureNewProductInDictionary_(productData) {
  const data = productData || {};
  const name = String(data.name || '').trim();
  const productType = String(data.productType || '').trim().toUpperCase();
  const category = String(data.category || '').trim();
  const columns = data.columns || {};
  const sourceAlias = String(data.sourceAlias || '').trim();

  if (!name) throw new Error('Brak nazwy produktu do zapisu w slowniku.');

  const sheet = getDictionarySheet_();
  const normalizedName = normalizeText(name);
  const configurations = loadProductConfigurations();
  let configuration = configurations.find(item => item.normalizedName === normalizedName);

  if (!configuration) {
    const configRow = findFirstEmptyDictionaryRow_(
      sheet,
      CONFIG.DICTIONARY.CONFIG_START_COLUMN,
      CONFIG.DICTIONARY.FIRST_DATA_ROW
    );

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

    sheet.getRange(
      configRow,
      CONFIG.DICTIONARY.CONFIG_START_COLUMN,
      1,
      CONFIG.DICTIONARY.CONFIG_COLUMN_COUNT
    ).setValues([row]);

    configuration = { dictionaryRow: configRow, name: name };
  }

  const aliasesToEnsure = [name, sourceAlias]
    .map(value => String(value || '').trim())
    .filter(Boolean);

  const existingAliases = loadAliases();
  const addedAliases = [];

  aliasesToEnsure.forEach(alias => {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) return;

    const existingTarget = existingAliases[normalizedAlias];
    if (existingTarget) {
      if (normalizeText(existingTarget) !== normalizedName) {
        logWarning(
          'Dictionary',
          'ensureNewProductInDictionary_',
          'Nie nadpisano konfliktowego aliasu nowego produktu.',
          { alias: alias, existingProduct: existingTarget, newProduct: name }
        );
      }
      return;
    }

    const aliasRow = findFirstEmptyDictionaryRow_(
      sheet,
      CONFIG.DICTIONARY.ALIAS_COLUMN,
      CONFIG.DICTIONARY.FIRST_DATA_ROW
    );
    sheet.getRange(aliasRow, CONFIG.DICTIONARY.ALIAS_COLUMN, 1, 2)
      .setValues([[alias, name]]);
    existingAliases[normalizedAlias] = name;
    addedAliases.push(alias);
  });

  SpreadsheetApp.flush();
  invalidateProductCatalogCache_();

  return {
    configurationRow: configuration.dictionaryRow || null,
    addedAliases: addedAliases
  };
}

function findFirstEmptyDictionaryRow_(sheet, column, firstDataRow) {
  const startRow = Math.max(Number(firstDataRow) || 2, 2);
  const lastRow = Math.max(sheet.getLastRow(), startRow);
  const values = sheet.getRange(startRow, column, lastRow - startRow + 1, 1).getDisplayValues();

  for (let index = 0; index < values.length; index++) {
    if (!String(values[index][0] || '').trim()) return startRow + index;
  }
  return lastRow + 1;
}
