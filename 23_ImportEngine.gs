/**
 * Inventory PRO Enterprise v2.1.3 Recovery
 * Jedno wczytanie katalogu na cala analize.
 */

function analyzeImportText(inputText) {
  const startedAt = Date.now();
  const text = String(inputText || '').trim();

  if (!text) {
    throw new Error('Wklej tekst inwentaryzacji.');
  }

  const runtimeContext = buildRuntimeContext_();
  const qualitySettings = loadQualitySettings_();
  const parsedItems = parseInventoryText(text, runtimeContext);

  const items = parsedItems.map((parsedItem, index) => {
    if (
      parsedItem.status !== 'OK' ||
      !parsedItem.product ||
      parsedItem.value === null
    ) {
      return {
        id: index + 1,
        originalInput: parsedItem.originalInput || '',
        parsedProduct: parsedItem.product || '',
        value: parsedItem.value,
        status: 'PARSE_ERROR',
        message: parsedItem.message || 'Nie rozpoznano wpisu',
        selectedProduct: '',
        productType: '',
        category: '',
        location: parsedItem.location || '',
        requiresLocation: false,
        candidates: [],
        include: false,
        qualityWarning: false,
        qualityLevel: 'ERROR',
        learnAlias: false
      };
    }

    const parserMatch = matchProductForParser_(parsedItem.product, runtimeContext);
    const match = parserMatch.match;

    if (match.matched && match.product) {
      return createReadyImportItem_(
        index,
        parsedItem,
        match,
        qualitySettings
      );
    }

    if (
      match.status === 'AMBIGUOUS' &&
      Array.isArray(match.candidates)
    ) {
      return {
        id: index + 1,
        originalInput: parsedItem.originalInput,
        parsedProduct: parsedItem.product,
        value: parsedItem.value,
        status: 'AMBIGUOUS',
        message: 'Wybierz produkt z listy',
        selectedProduct: '',
        productType: '',
        category: '',
        location: parsedItem.location || '',
        requiresLocation: false,
        qualityWarning: false,
        qualityLevel: 'OK',
        learnAlias: false,
        candidates: match.candidates.map(candidate => ({
          name: candidate.product.name,
          type: candidate.product.type,
          category: candidate.product.category,
          score: candidate.score
        })),
        include: true
      };
    }

    return {
      id: index + 1,
      originalInput: parsedItem.originalInput,
      parsedProduct: parsedItem.product,
      value: parsedItem.value,
      status: 'NOT_FOUND',
      message: match.message || 'Nie znaleziono produktu',
      selectedProduct: '',
      productType: '',
      category: '',
      location: parsedItem.location || '',
      requiresLocation: false,
      candidates: [],
      include: false,
      qualityWarning: false,
      qualityLevel: 'ERROR',
      learnAlias: false
    };
  });

  annotatePreviewDuplicates_(items, qualitySettings);

  return {
    success: true,
    itemCount: items.length,
    readyCount: items.filter(item =>
      ['EXACT', 'ALIAS', 'VARIANT', 'SMART', 'AUTO'].includes(item.status)
    ).length,
    ambiguousCount: items.filter(
      item => item.status === 'AMBIGUOUS'
    ).length,
    errorCount: items.filter(item =>
      ['PARSE_ERROR', 'NOT_FOUND'].includes(item.status)
    ).length,
    locationCount: items.filter(
      item => item.requiresLocation
    ).length,
    durationMs: Date.now() - startedAt,
    duplicateGroupCount: countDuplicateGroups_(items),
    qualitySettings: qualitySettings,
    items: items
  };
}

function createReadyImportItem_(
  index,
  parsedItem,
  match,
  qualitySettings
) {
  const product = match.product;
  const quality = evaluateImportQuality_(
    product,
    Number(parsedItem.value),
    parsedItem.location || '',
    qualitySettings
  );

  return {
    id: index + 1,
    originalInput: parsedItem.originalInput,
    parsedProduct: parsedItem.product,
    value: parsedItem.value,
    status: match.status,
    message: quality.warning
      ? quality.message
      : match.message,
    selectedProduct: product.name,
    productType: product.type,
    category: product.category,
    location: parsedItem.location || '',
    requiresLocation:
      product.type === CONFIG.PRODUCT_TYPES.LOCATION,
    candidates: [],
    include: true,
    qualityWarning: quality.warning,
    qualityLevel: quality.level,
    qualityFlags: quality.flags || [],
    duplicateCount: 1,
    duplicateValues: [parsedItem.value],
    duplicateTotal: parsedItem.value,
    duplicateWarning: false,
    learnAlias: false
  };
}


function annotatePreviewDuplicates_(items, qualitySettings) {
  const groups = {};
  const threshold = qualitySettings && qualitySettings.duplicateWarningCount
    ? qualitySettings.duplicateWarningCount
    : 2;

  items.forEach((item, index) => {
    if (!item.include || !item.selectedProduct || !Number.isFinite(Number(item.value))) return;
    const key = buildPreviewDuplicateKey_(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(index);
  });

  Object.keys(groups).forEach(key => {
    const indexes = groups[key];
    const values = indexes.map(index => Number(items[index].value));
    const total = values.reduce((sum, value) => sum + value, 0);
    const isDuplicate = indexes.length >= threshold;

    indexes.forEach(index => {
      const item = items[index];
      item.duplicateCount = indexes.length;
      item.duplicateValues = values;
      item.duplicateInputs = indexes.map(i => items[i].originalInput || items[i].parsedProduct || '');
      item.duplicateTotal = total;
      item.duplicateWarning = isDuplicate;
      if (isDuplicate) {
        const duplicateMessage = 'Duplikat: ' + indexes.length + ' wpisy, suma ' + total;
        item.message = item.message ? item.message + ' | ' + duplicateMessage : duplicateMessage;
      }
    });
  });
}

function buildPreviewDuplicateKey_(item) {
  const value = Number(item.value);
  const valueMode = Number.isInteger(value) ? 'WHOLE' : 'WEIGHT';
  return [
    normalizeText(item.selectedProduct),
    String(item.productType || ''),
    normalizeText(item.location || ''),
    valueMode
  ].join('|');
}

function countDuplicateGroups_(items) {
  const seen = {};
  items.forEach(item => {
    if (!item.duplicateWarning) return;
    seen[buildPreviewDuplicateKey_(item)] = true;
  });
  return Object.keys(seen).length;
}


/** v2.9.2: ponowna analiza pojedynczego wiersza Smart Review. */
function reanalyzeSingleImportItem(inputText) {
  const result = analyzeImportText(inputText);
  if (!result.items || result.items.length !== 1) {
    throw new Error('Wpis powinien zawierać dokładnie jedną pozycję. Rozpoznano: ' + (result.items ? result.items.length : 0));
  }
  return result.items[0];
}
