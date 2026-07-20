/**
 * Inventory PRO Enterprise v2.10.2
 * Centralny, tylko-do-odczytu silnik raportowania.
 *
 * Źródło prawdy dla stanu końcowego:
 * - NORMAL   -> K
 * - KEG      -> J
 * - LOCATION -> E
 *
 * Moduł nie zapisuje niczego w arkuszu źródłowym.
 */

function generateInventoryReport(sourceSheetName) {
  return generateInventoryReport_(sourceSheetName);
}

function generateInventoryReport_(sourceSheetName) {
  const started = Date.now();
  const sheetName = resolveReportingSourceSheetName_(sourceSheetName);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Nie znaleziono arkusza raportowego: ' + sheetName + '.');

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), 11);
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const displayValues = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  const categoryByRow = buildStrictInventoryCategoryMapFromSheet_(sheet, displayValues);
  const catalog = buildProductCatalog();
  const settings = loadQualitySettings_();

  const items = [];
  const warnings = [];
  const validationIssues = [];

  catalog.forEach(product => {
    const row = Number(product.inventoryRow);
    if (!row || row > lastRow) {
      validationIssues.push(createReportIssue_('ERROR', product.name, 'Brak poprawnego wiersza INWENTURA.'));
      return;
    }

    const type = String(product.type || '').trim().toUpperCase();
    if (!getConfiguredInventoryLayout_(type)) {
      validationIssues.push(createReportIssue_('ERROR', product.name, 'Nieobsługiwany typ: ' + (type || 'BRAK') + '.'));
      return;
    }

    const physicalCategory = categoryByRow[row] || '';
    if (!physicalCategory) {
      validationIssues.push(createReportIssue_('ERROR', product.name, 'Nie znaleziono fizycznej kategorii w arkuszu źródłowym.'));
      return;
    }

    const item = readInventorySummaryItemFromMatrix_(values, product, physicalCategory);
    item.flags = [];
    applySummaryWarnings_(item, settings);
    if (!item.hasValue) item.flags.push('BRAK WARTOŚCI');
    item.flags = Array.from(new Set(item.flags));

    if (normalizeBusinessCategory_(product.category) !== physicalCategory) {
      validationIssues.push(createReportIssue_(
        'WARNING',
        product.name,
        'Kategoria w SŁOWNIKU „' + String(product.category || 'BRAK') + '” różni się od fizycznej kategorii „' + physicalCategory + '”. Raport użył kategorii z arkusza.'
      ));
    }

    if (item.flags.length) {
      warnings.push({
        key: item.key,
        product: item.product,
        category: item.category,
        type: item.type,
        finalTotal: item.finalTotal,
        unit: item.unit,
        flags: item.flags.slice(),
        values: buildLegacyReviewValues_(item)
      });
    }
    items.push(item);
  });

  const report = createInventoryReportModel_({
    sourceSheetName: sheetName,
    generatedAt: new Date(),
    items: items,
    warnings: warnings,
    validationIssues: validationIssues,
    durationMs: Date.now() - started
  });
  report.summary = buildReportingSummary_(items);
  report.statistics = buildInventoryStatistics_(items);
  return report;
}

function readInventorySummaryItemFromMatrix_(values, product, category) {
  const type = String(product.type || '').trim().toUpperCase();
  const row = Number(product.inventoryRow);
  const rowValues = values[row - 1] || [];
  if (isDirectFinalInventoryProduct_(product)) {
    const directValue = matrixValueOrBlank_(rowValues, 'B');
    const directItem = {
      key: product.normalizedName || normalizeText(product.name),
      product: product.name,
      category: category,
      type: type,
      inventoryRow: row,
      unit: 'kg',
      finalTotal: directValue,
      total: directValue,
      details: { directFinal: directValue },
      cells: { finalTotal: 'B' + row, directFinal: 'B' + row }
    };
    directItem.values = { 'Stan końcowy': directValue };
    directItem.hasValue = directValue !== '';
    return directItem;
  }
  const layout = getInventorySummaryLayout_(type);

  const item = {
    key: product.normalizedName || normalizeText(product.name),
    product: product.name,
    category: category,
    type: type,
    inventoryRow: row,
    unit: layout.unit,
    finalTotal: matrixValueOrBlank_(rowValues, layout.finalTotal),
    total: matrixValueOrBlank_(rowValues, layout.finalTotal),
    details: {},
    cells: {}
  };
  addSummaryCellAddress_(item.cells, 'finalTotal', layout.finalTotal, row);

  if (type === CONFIG.PRODUCT_TYPES.LOCATION) {
    item.details = {
      warehouse: matrixValueOrBlank_(rowValues, layout.warehouse),
      darkroom: matrixValueOrBlank_(rowValues, layout.darkroom),
      fridges: matrixValueOrBlank_(rowValues, layout.fridges)
    };
    addSummaryCellAddress_(item.cells, 'warehouse', layout.warehouse, row);
    addSummaryCellAddress_(item.cells, 'darkroom', layout.darkroom, row);
    addSummaryCellAddress_(item.cells, 'fridges', layout.fridges, row);
  } else {
    item.details = {
      grossWeight: matrixValueOrBlank_(rowValues, layout.grossWeight),
      emptyContainerWeight: matrixValueOrBlank_(rowValues, layout.emptyContainerWeight),
      openNet: matrixValueOrBlank_(rowValues, layout.openNet),
      prepNet: matrixValueOrBlank_(rowValues, layout.prepNet),
      fullUnits: matrixValueOrBlank_(rowValues, layout.fullUnits),
      unitCapacity: matrixValueOrBlank_(rowValues, layout.unitCapacity),
      fullUnitsVolume: matrixValueOrBlank_(rowValues, layout.fullUnitsVolume)
    };
    addSummaryCellAddress_(item.cells, 'grossWeight', layout.grossWeight, row);
    addSummaryCellAddress_(item.cells, 'fullUnits', layout.fullUnits, row);
  }

  item.values = buildLegacyReviewValues_(item);
  item.hasValue = isReportingItemCompleted_(item);
  return item;
}

function matrixValueOrBlank_(rowValues, columnLetter) {
  const column = normalizeColumnLetter_(columnLetter);
  if (!column) return '';
  const index = columnLetterToNumber290_(column) - 1;
  const value = rowValues[index];
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function columnLetterToNumber290_(letters) {
  return String(letters || '').toUpperCase().split('').reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
}

function isReportingItemCompleted_(item) {
  const details = item.details || {};
  if (item.type === CONFIG.PRODUCT_TYPES.LOCATION) {
    return getLocationAreaDefinitions_().some(area => details[area.columnKey] !== '');
  }
  return details.grossWeight !== '' || details.fullUnits !== '';
}

function buildReportingSummary_(items) {
  const categories = {};
  items.forEach(item => {
    const category = item.category;
    if (!categories[category]) categories[category] = { products: 0, completed: 0, missing: 0 };
    categories[category].products++;
    if (item.hasValue) categories[category].completed++;
    else categories[category].missing++;
  });
  return {
    products: items.length,
    completed: items.filter(item => item.hasValue).length,
    missing: items.filter(item => !item.hasValue).length,
    warningProducts: items.filter(item => item.flags && item.flags.some(flag => flag !== 'BRAK WARTOŚCI')).length,
    categories: categories
  };
}

function resolveReportingSourceSheetName_(sourceSheetName) {
  const requested = String(sourceSheetName || '').trim();
  if (requested) {
    const requestedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheets().find(sheet => normalizeText(sheet.getName()) === normalizeText(requested));
    if (requestedSheet) return requestedSheet.getName();
  }
  const inventory = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  if (!inventory) throw new Error('Nie znaleziono bieżącego arkusza INWENTURA.');
  return inventory.getName();
}