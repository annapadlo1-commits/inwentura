/**
 * Inventory PRO Enterprise v2.8.4
 * Read-only inventory summary service.
 *
 * IMPORTANT:
 * - This module NEVER writes to the inventory sheet.
 * - Formula cells and reference values remain untouched.
 * - Final values are read from: NORMAL K, KEG J, LOCATION E.
 */

const INVENTORY_SUMMARY_COLUMNS_ = Object.freeze({
  NORMAL: Object.freeze({
    grossWeight: 'C',
    emptyContainerWeight: 'D',
    openNet: 'E',
    prepNet: 'G',
    fullUnits: 'H',
    unitCapacity: 'I',
    fullUnitsVolume: 'J',
    finalTotal: 'K',
    unit: 'l'
  }),
  KEG: Object.freeze({
    grossWeight: 'C',
    emptyContainerWeight: 'D',
    openNet: 'E',
    fullUnits: 'G',
    unitCapacity: 'H',
    fullUnitsVolume: 'I',
    finalTotal: 'J',
    unit: 'l'
  }),
  LOCATION: Object.freeze({
    warehouse: 'B',
    darkroom: 'C',
    fridges: 'D',
    finalTotal: 'E',
    unit: 'szt.'
  })
});

function getInventorySummaryLayout_(productType) {
  const type = String(productType || '').trim().toUpperCase();
  const layout = INVENTORY_SUMMARY_COLUMNS_[type];
  if (!layout) throw new Error('Nieobsługiwany typ produktu: ' + type + '.');
  return layout;
}

function readInventorySummaryItem_(sheet, product) {
  if (!sheet || !product || !product.inventoryRow) return null;

  const type = String(product.type || '').trim().toUpperCase();
  const layout = getInventorySummaryLayout_(type);
  const row = Number(product.inventoryRow);
  const item = {
    key: product.normalizedName || normalizeText(product.name),
    product: product.name,
    category: normalizeBusinessCategory_(product.category) || String(product.category || '').trim(),
    type: type,
    inventoryRow: row,
    unit: layout.unit,
    finalTotal: readCellNumberOrBlank_(sheet, layout.finalTotal, row),
    details: {},
    cells: { finalTotal: layout.finalTotal + row }
  };

  if (type === CONFIG.PRODUCT_TYPES.NORMAL) {
    item.details = {
      grossWeight: readCellNumberOrBlank_(sheet, layout.grossWeight, row),
      emptyContainerWeight: readCellNumberOrBlank_(sheet, layout.emptyContainerWeight, row),
      openNet: readCellNumberOrBlank_(sheet, layout.openNet, row),
      prepNet: readCellNumberOrBlank_(sheet, layout.prepNet, row),
      fullUnits: readCellNumberOrBlank_(sheet, layout.fullUnits, row),
      unitCapacity: readCellNumberOrBlank_(sheet, layout.unitCapacity, row),
      fullUnitsVolume: readCellNumberOrBlank_(sheet, layout.fullUnitsVolume, row)
    };
    item.cells.grossWeight = layout.grossWeight + row;
    item.cells.fullUnits = layout.fullUnits + row;
  } else if (type === CONFIG.PRODUCT_TYPES.KEG) {
    item.details = {
      grossWeight: readCellNumberOrBlank_(sheet, layout.grossWeight, row),
      emptyContainerWeight: readCellNumberOrBlank_(sheet, layout.emptyContainerWeight, row),
      openNet: readCellNumberOrBlank_(sheet, layout.openNet, row),
      fullUnits: readCellNumberOrBlank_(sheet, layout.fullUnits, row),
      unitCapacity: readCellNumberOrBlank_(sheet, layout.unitCapacity, row),
      fullUnitsVolume: readCellNumberOrBlank_(sheet, layout.fullUnitsVolume, row)
    };
    item.cells.grossWeight = layout.grossWeight + row;
    item.cells.fullUnits = layout.fullUnits + row;
  } else {
    item.details = {
      warehouse: readCellNumberOrBlank_(sheet, layout.warehouse, row),
      darkroom: readCellNumberOrBlank_(sheet, layout.darkroom, row),
      fridges: readCellNumberOrBlank_(sheet, layout.fridges, row)
    };
    item.cells.warehouse = layout.warehouse + row;
    item.cells.darkroom = layout.darkroom + row;
    item.cells.fridges = layout.fridges + row;
  }

  item.hasValue = item.finalTotal !== '' || Object.keys(item.details).some(key => item.details[key] !== '');
  return item;
}

function readCellNumberOrBlank_(sheet, column, row) {
  if (!column) return '';
  const value = sheet.getRange(column + row).getValue();
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function verifyInventoryFormulaSafety_(sheet, product) {
  const type = String(product.type || '').trim().toUpperCase();
  const layout = getInventorySummaryLayout_(type);
  const row = Number(product.inventoryRow);
  const formulaColumns = type === 'NORMAL'
    ? ['E', 'J', 'K']
    : type === 'KEG'
      ? ['E', 'I', 'J']
      : ['E'];

  return formulaColumns.map(column => {
    const range = sheet.getRange(column + row);
    return {
      cell: column + row,
      formula: range.getFormula(),
      hasFormula: Boolean(range.getFormula())
    };
  });
}
