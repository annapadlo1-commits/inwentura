/**
 * Inventory PRO 2.7 - Product Manager
 * Bezpieczne zarzadzanie katalogiem produktow i aliasami.
 */

function showProductManager() {
  const html = renderInventoryTemplate_('UI_ProductManager')
    .setWidth(1180)
    .setHeight(760);

  SpreadsheetApp.getUi().showModalDialog(html, '🍕 Product Manager');
}

function getProductManagerData() {
  return runSafely_(
    'ProductManager',
    'getProductManagerData',
    function() {
      const startedAt = Date.now();
      const catalog = buildProductCatalog();
      const allConfigurations = loadAllProductConfigurationsForManager_();
      const inventoryRows = loadInventoryRowMapForManager_();
      const aliasesByProduct = loadAliasesByProductForManager_();
      const catalogByName = {};

      catalog.forEach(item => {
        catalogByName[item.normalizedName] = item;
      });

      const products = allConfigurations.map(config => {
        const activeProduct = catalogByName[config.normalizedName] || null;
        return {
          name: config.name,
          normalizedName: config.normalizedName,
          type: config.type,
          category: config.category,
          columns: config.columns,
          active: config.active,
          dictionaryRow: config.dictionaryRow,
          inventoryRow: activeProduct && activeProduct.inventoryRow
            ? activeProduct.inventoryRow
            : (inventoryRows[config.normalizedName] || null),
          aliases: aliasesByProduct[config.normalizedName] || []
        };
      });

      products.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
      const response = {
        version: CONFIG.VERSION,
        products: products,
        summary: {
          products: products.length,
          active: products.filter(item => item.active).length,
          archived: products.filter(item => !item.active).length,
          aliases: products.reduce((sum, item) => sum + item.aliases.length, 0)
        },
        productTypes: Object.keys(CONFIG.PRODUCT_TYPES).map(key => CONFIG.PRODUCT_TYPES[key]),
        performance: {
          loadMs: Date.now() - startedAt,
          source: 'BATCHED'
        }
      };

      logInfo('ProductManager', 'getProductManagerData', 'Product Manager zaladowany', {
        products: response.summary.products,
        aliases: response.summary.aliases,
        durationMs: response.performance.loadMs,
        mode: 'BATCHED'
      });
      return response;
    },
    'Nie udalo sie wczytac katalogu produktow.'
  );
}

function loadInventoryRowMapForManager_() {
  const sheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  const map = {};
  if (!sheet || sheet.getLastRow() < 1) return map;

  const names = sheet.getRange(1, 1, sheet.getLastRow(), 1).getDisplayValues();
  names.forEach((row, index) => {
    const key = normalizeText(row[0]);
    if (key && !map[key]) map[key] = index + 1;
  });
  return map;
}

function loadAliasesByProductForManager_() {
  const sheet = getDictionarySheet_();
  const map = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;

  sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues().forEach(row => {
    const alias = String(row[0] || '').trim();
    const productKey = normalizeText(row[1]);
    if (!alias || !productKey) return;
    if (!map[productKey]) map[productKey] = [];
    map[productKey].push(alias);
  });

  Object.keys(map).forEach(key => {
    map[key].sort((a, b) => a.localeCompare(b, 'pl'));
  });
  return map;
}

function loadAllProductConfigurationsForManager_() {
  const sheet = getDictionarySheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DICTIONARY.FIRST_DATA_ROW) return [];

  return sheet
    .getRange(
      CONFIG.DICTIONARY.FIRST_DATA_ROW,
      CONFIG.DICTIONARY.CONFIG_START_COLUMN,
      lastRow - CONFIG.DICTIONARY.FIRST_DATA_ROW + 1,
      CONFIG.DICTIONARY.CONFIG_COLUMN_COUNT
    )
    .getValues()
    .map((row, index) => ({
      dictionaryRow: index + CONFIG.DICTIONARY.FIRST_DATA_ROW,
      name: String(row[0] || '').trim(),
      normalizedName: normalizeText(row[0]),
      type: String(row[1] || 'NORMAL').trim().toUpperCase(),
      category: String(row[2] || '').trim(),
      columns: {
        quantity: normalizeColumnLetter_(row[3]),
        weight: normalizeColumnLetter_(row[4]),
        warehouse: normalizeColumnLetter_(row[5]),
        darkroom: normalizeColumnLetter_(row[6]),
        fridges: normalizeColumnLetter_(row[7])
      },
      active: ['tak', 'true', '1'].includes(normalizeText(row[8]))
    }))
    .filter(item => item.name);
}

function getAliasesForProduct_(productName) {
  const target = normalizeText(productName);
  const sheet = getDictionarySheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues()
    .filter(row => normalizeText(row[1]) === target && String(row[0] || '').trim())
    .map(row => String(row[0]).trim())
    .sort((a, b) => a.localeCompare(b, 'pl'));
}

function saveProductManagerChanges(payload) {
  return runSafely_(
    'ProductManager',
    'saveProductManagerChanges',
    function() {
      const data = validateProductManagerPayload_(payload);
      const sheet = getDictionarySheet_();
      const configurations = loadAllProductConfigurationsForManager_();
      const currentKey = normalizeText(data.originalName);
      const newKey = normalizeText(data.name);
      const current = configurations.find(item => item.normalizedName === currentKey);

      if (!current) throw new Error('Nie znaleziono produktu: ' + data.originalName);

      const duplicate = configurations.find(item =>
        item.normalizedName === newKey && item.dictionaryRow !== current.dictionaryRow
      );
      if (duplicate) throw new Error('Produkt o tej nazwie juz istnieje: ' + duplicate.name);

      const oldName = current.name;
      const configRow = [
        data.name,
        data.type,
        data.category,
        data.columns.quantity,
        data.columns.weight,
        data.columns.warehouse,
        data.columns.darkroom,
        data.columns.fridges,
        data.active ? 'TAK' : 'NIE'
      ];

      sheet.getRange(
        current.dictionaryRow,
        CONFIG.DICTIONARY.CONFIG_START_COLUMN,
        1,
        CONFIG.DICTIONARY.CONFIG_COLUMN_COUNT
      ).setValues([configRow]);

      if (normalizeText(oldName) !== newKey) {
        renameProductReferences_(oldName, data.name);
      }

      SpreadsheetApp.flush();
      invalidateProductCatalogCache_();

      logInfo('ProductManager', 'saveProductManagerChanges', 'Zaktualizowano produkt', {
        oldName: oldName,
        newName: data.name,
        type: data.type,
        category: data.category,
        active: data.active
      });

      return {
        success: true,
        message: 'Produkt zostal zaktualizowany.',
        productName: data.name
      };
    },
    'Nie udalo sie zapisac zmian produktu.'
  );
}

function validateProductManagerPayload_(payload) {
  const data = payload || {};
  const originalName = String(data.originalName || '').trim();
  const name = String(data.name || '').trim();
  const type = String(data.type || '').trim().toUpperCase();
  const category = String(data.category || '').trim();
  const validTypes = Object.keys(CONFIG.PRODUCT_TYPES).map(key => CONFIG.PRODUCT_TYPES[key]);

  if (!originalName) throw new Error('Brak oryginalnej nazwy produktu.');
  validateNewProductName_(name);
  if (!validTypes.includes(type)) throw new Error('Nieprawidlowy typ produktu: ' + type);

  const sourceColumns = data.columns || {};
  const columns = {
    quantity: normalizeColumnLetter_(sourceColumns.quantity),
    weight: normalizeColumnLetter_(sourceColumns.weight),
    warehouse: normalizeColumnLetter_(sourceColumns.warehouse),
    darkroom: normalizeColumnLetter_(sourceColumns.darkroom),
    fridges: normalizeColumnLetter_(sourceColumns.fridges)
  };

  if (type === CONFIG.PRODUCT_TYPES.NORMAL && !columns.quantity && !columns.weight) {
    throw new Error('Produkt NORMAL musi miec kolumne sztuk lub wagi.');
  }
  if (type === CONFIG.PRODUCT_TYPES.KEG && !columns.quantity && !columns.weight) {
    throw new Error('Produkt KEG musi miec kolumne pelnych kegow lub wagi.');
  }
  if (type === CONFIG.PRODUCT_TYPES.LOCATION &&
      !columns.warehouse && !columns.darkroom && !columns.fridges) {
    throw new Error('Produkt LOCATION musi miec co najmniej jedna kolumne lokalizacji.');
  }

  return {
    originalName: originalName,
    name: name,
    type: type,
    category: category,
    columns: columns,
    active: Boolean(data.active)
  };
}

function renameProductReferences_(oldName, newName) {
  const dictionary = getDictionarySheet_();
  const lastRow = dictionary.getLastRow();
  const oldKey = normalizeText(oldName);

  if (lastRow >= 2) {
    const aliasRange = dictionary.getRange(2, 1, lastRow - 1, 2);
    const aliases = aliasRange.getValues();
    let changed = false;

    aliases.forEach(row => {
      if (normalizeText(row[1]) === oldKey) {
        row[1] = newName;
        changed = true;
      }
    });
    if (changed) aliasRange.setValues(aliases);
  }

  const inventory = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  if (inventory) {
    const row = findInventoryRowByName_(oldName);
    if (row) inventory.getRange(row, 1).setValue(newName);
  }
}

function findInventoryRowByName_(productName) {
  const sheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  if (!sheet || sheet.getLastRow() < 1) return null;
  const target = normalizeText(productName);
  const names = sheet.getRange(1, 1, sheet.getLastRow(), 1).getDisplayValues();
  for (let index = 0; index < names.length; index++) {
    if (normalizeText(names[index][0]) === target) return index + 1;
  }
  return null;
}

function addProductAliasFromManager(alias, productName) {
  return runSafely_(
    'ProductManager',
    'addProductAliasFromManager',
    function() {
      const cleanAlias = String(alias || '').trim();
      const cleanProduct = String(productName || '').trim();
      if (!cleanAlias || !cleanProduct) throw new Error('Alias i produkt sa wymagane.');

      const context = buildRuntimeContext_();
      const existing = loadAliases();
      const validation = validateAliasSuggestion_(
        { alias: cleanAlias, product: cleanProduct },
        context,
        existing
      );
      if (!validation.valid) throw new Error(validation.reason || 'Alias zostal odrzucony.');

      const normalizedAlias = normalizeText(cleanAlias);
      if (existing[normalizedAlias]) {
        if (normalizeText(existing[normalizedAlias]) === normalizeText(cleanProduct)) {
          return { success: true, message: 'Ten alias juz istnieje.', alias: cleanAlias };
        }
        throw new Error('Alias wskazuje juz inny produkt: ' + existing[normalizedAlias]);
      }

      const sheet = getDictionarySheet_();
      const row = findFirstEmptyDictionaryRow_(sheet, CONFIG.DICTIONARY.ALIAS_COLUMN, 2);
      sheet.getRange(row, 1, 1, 2).setValues([[cleanAlias, cleanProduct]]);
      invalidateProductCatalogCache_();

      return { success: true, message: 'Alias zostal dodany.', alias: cleanAlias };
    },
    'Nie udalo sie dodac aliasu.'
  );
}

function deleteProductAliasFromManager(alias, productName) {
  return runSafely_(
    'ProductManager',
    'deleteProductAliasFromManager',
    function() {
      const aliasKey = normalizeText(alias);
      const productKey = normalizeText(productName);
      const sheet = getDictionarySheet_();
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) throw new Error('Brak aliasow do usuniecia.');

      const range = sheet.getRange(2, 1, lastRow - 1, 2);
      const values = range.getValues();
      let found = false;

      values.forEach(row => {
        if (normalizeText(row[0]) === aliasKey && normalizeText(row[1]) === productKey) {
          row[0] = '';
          row[1] = '';
          found = true;
        }
      });

      if (!found) throw new Error('Nie znaleziono wskazanego aliasu.');
      range.setValues(values);
      invalidateProductCatalogCache_();

      return { success: true, message: 'Alias zostal usuniety.' };
    },
    'Nie udalo sie usunac aliasu.'
  );
}
