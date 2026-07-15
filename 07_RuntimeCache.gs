/**
 * Inventory PRO Enterprise v2.2
 * Jeden kontekst na cala operacje.
 */

function buildRuntimeContext_() {
  const catalog = buildProductCatalog();

  return {
    catalog: catalog,
    productIndex: buildProductCatalogIndex(catalog),
    aliasIndex: buildAliasProductIndex(catalog),
    exactRecognitionIndex: buildExactRecognitionIndex_(catalog),
    technicalRecognitionIndex: buildTechnicalRecognitionIndex_(catalog),
    firstTokenIndex: buildFirstTokenRecognitionIndex_(catalog),
    recognitionMemo: {}
  };
}


function buildExactRecognitionIndex_(catalog) {
  const index = {};
  (catalog || []).forEach(product => {
    [product.name].concat(product.aliases || []).forEach(name => {
      const key = normalizeRecognitionInput_(name);
      if (key && !index[key]) index[key] = product;
    });
  });
  return index;
}


function buildTechnicalRecognitionIndex_(catalog) {
  const index = {};
  (catalog || []).forEach(product => {
    [product.name].concat(product.aliases || []).forEach(value => {
      buildTechnicalRecognitionKeys_(value).forEach(key => {
        if (!key) return;
        if (!index[key]) index[key] = [];
        if (!index[key].some(item => normalizeText(item.name) === normalizeText(product.name))) {
          index[key].push(product);
        }
      });
    });
  });
  return index;
}

function buildFirstTokenRecognitionIndex_(catalog) {
  const index = {};
  (catalog || []).forEach(product => {
    [product.name].concat(product.aliases || []).forEach(value => {
      const normalized = normalizeRecognitionForScore_(value);
      const first = normalized.split(' ').filter(Boolean)[0] || '';
      if (!first) return;
      if (!index[first]) index[first] = [];
      if (!index[first].some(item => normalizeText(item.name) === normalizeText(product.name))) {
        index[first].push(product);
      }
    });
  });
  return index;
}
