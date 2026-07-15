/**
 * Inventory PRO Enterprise v2.1.3 Recovery
 * Szybki zapis kolumnami zamiast setValue dla kazdej pozycji.
 */

function saveImportItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Brak pozycji do zapisania.');
  }

  const lock = LockService.getDocumentLock();
  const startedAt = Date.now();
  const importId = createUniqueId_('IMP');
  let inventorySheet = null;
  let originalColumnBuffers = null;
  let inventoryLastRow = 0;
  let inventoryWritten = false;

  try {
    lock.waitLock(30000);

    const sheet = getSheetByConfiguredName_(
      CONFIG.SHEETS.INVENTORY
    );
    inventorySheet = sheet;

    if (!sheet) {
      throw new Error(
        'Nie znaleziono arkusza: ' +
        CONFIG.SHEETS.INVENTORY
      );
    }

    // Nowy produkt dodany z okna importu zmienia indeks wierszy całego katalogu.
    // Cache musi zostać odświeżony bezpośrednio przed zapisem, inaczej zapis może
    // korzystać ze starego katalogu i pominąć wartość nowo utworzonego produktu.
    const containsNewProduct = items.some(item =>
      item && item.include && String(item.status || '').toUpperCase() === 'NEW_PRODUCT'
    );

    if (containsNewProduct) {
      SpreadsheetApp.flush();
      invalidateProductCatalogCache_();
    }

    const runtimeContext = buildRuntimeContext_();
    const productIndex = runtimeContext.productIndex;
    const qualitySettings = loadQualitySettings_();
    const lastRow = sheet.getLastRow();

    const usedColumns = collectUsedTargetColumns_(
      items,
      productIndex
    );

    const columnBuffers = loadColumnBuffers_(
      sheet,
      usedColumns,
      lastRow
    );
    originalColumnBuffers = cloneColumnBuffers_(columnBuffers);
    inventoryLastRow = lastRow;

    const results = [];
    let savedCount = 0;
    let skippedCount = 0;

    items.forEach(item => {
      const result = prepareSingleImportWrite_(
        item,
        productIndex,
        columnBuffers,
        qualitySettings
      );

      result.importId = importId;
      result.location = item.location || '';
      results.push(result);

      if (result.saved) {
        savedCount++;
      } else {
        skippedCount++;
      }
    });

    annotateSavedDuplicateResults_(results, qualitySettings);

    inventoryWritten = true;
    writeColumnBuffers_(
      sheet,
      columnBuffers,
      lastRow
    );

    SpreadsheetApp.flush();
    appendImportHistory_(importId, results);
    appendImportReport_(importId, results);

    let learnedAliasesCount = 0;

    try {
      learnedAliasesCount = saveAliasesBatch_(
        collectAliasSuggestions_(items)
      );
    } catch (aliasError) {
      logWarning(
        'InventoryWriter',
        'saveImportItems',
        'Import zapisano, ale nie udalo sie zapisac aliasow.',
        { message: normalizeError_(aliasError).message }
      );
    }

    const response = {
      success: true,
      importId: importId,
      savedCount: savedCount,
      skippedCount: skippedCount,
      learnedAliasesCount: learnedAliasesCount,
      duplicateGroupCount: countSavedDuplicateGroups_(results),
      warningCount: results.filter(result => result.qualityWarning).length,
      results: results,
      durationMs: Date.now() - startedAt
    };

    logInfo(
      'InventoryWriter',
      'saveImportItems',
      'Import zapisany',
      {
        importId: importId,
        savedCount: savedCount,
        skippedCount: skippedCount
      },
      response.durationMs
    );

    return response;

  } catch (error) {
    if (inventoryWritten && inventorySheet && originalColumnBuffers) {
      try {
        writeColumnBuffers_(inventorySheet, originalColumnBuffers, inventoryLastRow);
        SpreadsheetApp.flush();
      } catch (rollbackError) {
        logError(
          'InventoryWriter',
          'saveImportItems.rollback',
          rollbackError,
          { importId: importId },
          0
        );
      }
    }
    logError(
      'InventoryWriter',
      'saveImportItems',
      error,
      { importId: importId },
      Date.now() - startedAt
    );

    throw error;

  } finally {
    lock.releaseLock();
  }
}

function cloneColumnBuffers_(buffers) {
  const clone = {};
  Object.keys(buffers || {}).forEach(column => {
    clone[column] = (buffers[column] || []).map(row => [row[0]]);
  });
  return clone;
}

function collectUsedTargetColumns_(
  items,
  productIndex
) {
  const columns = {};

  items.forEach(item => {
    if (!item.include || !item.selectedProduct) {
      return;
    }

    const product = productIndex[
      normalizeText(item.selectedProduct)
    ];

    if (!product) {
      return;
    }

    const value = Number(item.value);

    if (!Number.isFinite(value)) {
      return;
    }

    const column = resolveTargetColumn_(
      product,
      value,
      item.location
    );

    if (column) {
      columns[column] = true;
    }
  });

  return Object.keys(columns);
}

function loadColumnBuffers_(
  sheet,
  columns,
  lastRow
) {
  const buffers = {};

  columns.forEach(column => {
    buffers[column] = sheet
      .getRange(column + '1:' + column + lastRow)
      .getValues();
  });

  return buffers;
}

function writeColumnBuffers_(
  sheet,
  buffers,
  lastRow
) {
  Object.keys(buffers).forEach(column => {
    sheet
      .getRange(column + '1:' + column + lastRow)
      .setValues(buffers[column]);
  });
}

function prepareSingleImportWrite_(
  item,
  productIndex,
  columnBuffers,
  qualitySettings
) {
  const originalInput = String(
    item.originalInput || ''
  ).trim();

  if (!item.include) {
    return createWriteResult_(
      originalInput,
      false,
      'Pominieto przez uzytkownika'
    );
  }

  const productName = String(
    item.selectedProduct || ''
  ).trim();

  if (!productName) {
    return createWriteResult_(
      originalInput,
      false,
      'Nie wybrano produktu'
    );
  }

  const product = productIndex[
    normalizeText(productName)
  ];

  if (!product) {
    return createWriteResult_(
      originalInput,
      false,
      'Produktu nie ma w aktywnym katalogu'
    );
  }

  if (!product.inventoryRow) {
    return createWriteResult_(
      originalInput,
      false,
      'Nie znaleziono wiersza produktu'
    );
  }

  const value = Number(item.value);

  if (!Number.isFinite(value)) {
    return createWriteResult_(
      originalInput,
      false,
      'Nieprawidlowa wartosc'
    );
  }

  const quality = evaluateImportQuality_(
    product,
    value,
    item.location || '',
    qualitySettings
  );

  if (quality.blocking) {
    const blocked = createWriteResult_(
      originalInput,
      false,
      quality.message || 'Wartosc zablokowana przez ustawienia'
    );
    blocked.product = product.name;
    blocked.addedValue = value;
    blocked.qualityWarning = true;
    blocked.qualityLevel = quality.level;
    blocked.qualityFlags = quality.flags || [];
    return blocked;
  }

  const targetColumn = resolveTargetColumn_(
    product,
    value,
    item.location
  );

  if (
    !targetColumn ||
    !columnBuffers[targetColumn]
  ) {
    return createWriteResult_(
      originalInput,
      false,
      'Nie ustalono kolumny docelowej'
    );
  }

  const bufferIndex = product.inventoryRow - 1;
  const previousRaw =
    columnBuffers[targetColumn][bufferIndex][0];

  const previousValue =
    typeof previousRaw === 'number' &&
    Number.isFinite(previousRaw)
      ? previousRaw
      : 0;

  const newValue = previousValue + value;

  columnBuffers[targetColumn][bufferIndex][0] =
    newValue;

  return {
    originalInput: originalInput,
    product: product.name,
    saved: true,
    row: product.inventoryRow,
    column: targetColumn,
    previousValue: previousValue,
    addedValue: value,
    newValue: newValue,
    qualityWarning: quality.warning,
    qualityLevel: quality.level,
    qualityFlags: quality.flags || [],
    duplicateCount: 1,
    duplicateValues: [value],
    duplicateTotal: value,
    duplicateWarning: false,
    message:
      'Zapisano do ' +
      targetColumn +
      product.inventoryRow +
      (quality.warning ? ' | ' + quality.message : '')
  };
}

function resolveTargetColumn_(
  product,
  value,
  location
) {
  const type = String(
    product.type || ''
  ).toUpperCase();

  const isWholeNumber = Number.isInteger(value);

  if (type === CONFIG.PRODUCT_TYPES.LOCATION) {
    const normalizedLocation = normalizeText(location);

    const locationColumns = {
      magazyn: product.columns.warehouse,
      warehouse: product.columns.warehouse,
      darkroom: product.columns.darkroom,
      'dark room': product.columns.darkroom,
      lodowki: product.columns.fridges,
      lodowka: product.columns.fridges,
      fridge: product.columns.fridges,
      fridges: product.columns.fridges
    };

    return String(
      locationColumns[normalizedLocation] || ''
    ).toUpperCase();
  }

  const quantityColumn = String(product.columns.quantity || '').toUpperCase();
  const weightColumn = String(product.columns.weight || '').toUpperCase();
  const category = normalizeText(product.category || '');

  // Produkty z jedną dozwoloną kolumną zawsze trafiają właśnie do niej.
  // KAWA jest liczona wagowo również wtedy, gdy wpis ma postać liczby całkowitej.
  if (category === 'kawa' && weightColumn) return weightColumn;
  if (weightColumn && !quantityColumn) return weightColumn;
  if (quantityColumn && !weightColumn) return quantityColumn;

  return isWholeNumber ? quantityColumn : weightColumn;
}

function createWriteResult_(
  originalInput,
  saved,
  message
) {
  return {
    originalInput: originalInput,
    product: '',
    saved: saved,
    row: null,
    column: '',
    previousValue: null,
    addedValue: null,
    newValue: null,
    qualityWarning: false,
    qualityLevel: saved ? 'OK' : 'ERROR',
    qualityFlags: [],
    duplicateCount: 1,
    duplicateValues: [],
    duplicateTotal: null,
    duplicateWarning: false,
    message: message
  };
}


function annotateSavedDuplicateResults_(results, qualitySettings) {
  const groups = {};
  const threshold = qualitySettings && qualitySettings.duplicateWarningCount
    ? qualitySettings.duplicateWarningCount
    : 2;

  results.forEach((result, index) => {
    if (!result.saved || !result.product || !result.row || !result.column) return;
    const key = [normalizeText(result.product), result.row, result.column].join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(index);
  });

  Object.keys(groups).forEach(key => {
    const indexes = groups[key];
    const values = indexes.map(index => Number(results[index].addedValue));
    const total = values.reduce((sum, value) => sum + value, 0);
    const isDuplicate = indexes.length >= threshold;

    indexes.forEach(index => {
      const result = results[index];
      result.duplicateCount = indexes.length;
      result.duplicateValues = values;
      result.duplicateTotal = total;
      result.duplicateWarning = isDuplicate;

      if (isDuplicate) {
        const duplicateMessage = 'DUPLIKAT: zsumowano ' + indexes.length +
          ' wpisy (' + values.join(' + ') + ' = ' + total + ')';
        result.message = result.message
          ? result.message + ' | ' + duplicateMessage
          : duplicateMessage;
      }
    });
  });
}

function countSavedDuplicateGroups_(results) {
  const groups = {};
  results.forEach(result => {
    if (!result.duplicateWarning || !result.product) return;
    groups[[normalizeText(result.product), result.row, result.column].join('|')] = true;
  });
  return Object.keys(groups).length;
}
