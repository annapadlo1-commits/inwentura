/**
 * Inventory PRO Enterprise v2.3.0
 * Bezpieczne zapamietywanie wyborow uzytkownika.
 */
function collectAliasSuggestions_(items) {
  const suggestions = [];
  (items || []).forEach(item => {
    if (!item.include || !item.learnAlias || !item.parsedProduct || !item.selectedProduct) return;
    const alias = normalizeAliasCandidate_(item.aliasSource || item.parsedProduct || item.originalInput);
    const product = String(item.selectedProduct).trim();
    if (alias && product && normalizeText(alias) !== normalizeText(product)) {
      suggestions.push({ alias: alias, product: product });
    }
  });
  return suggestions;
}

function normalizeAliasCandidate_(value) {
  const prepared = prepareParserText_(value || '');
  const tokens = prepared.split(/\s+/).filter(Boolean);
  const location = readLocationAt_(tokens, 0);
  const withoutLocation = location ? tokens.slice(location.consumed) : tokens;

  return withoutLocation.join(' ')
    .replace(/\s+(?:i|oraz|potem|dalej|nast[eę]pnie)\s*$/i, '')
    .replace(/\s+[-+]?\d+(?:[.,]\d+)?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateAliasSuggestion_(suggestion, runtimeContext, existingAliases) {
  const alias = String(suggestion.alias || '').trim();
  const productName = String(suggestion.product || '').trim();
  const normalizedAlias = normalizeText(alias);
  const normalizedProduct = normalizeText(productName);
  const context = runtimeContext || buildRuntimeContext_();
  const aliases = existingAliases || loadAliases();

  if (!normalizedAlias || !normalizedProduct) return { valid: false, reason: 'Pusty alias lub produkt' };
  if (normalizedAlias.length < 3 || /^\d+(?:\s+\d+)*$/.test(normalizedAlias)) {
    return { valid: false, reason: 'Alias jest zbyt krotki lub sklada sie tylko z liczb' };
  }
  if (normalizedAlias === normalizedProduct) return { valid: false, reason: 'Alias jest identyczny z nazwa produktu' };
  if (!context.productIndex[normalizedProduct]) return { valid: false, reason: 'Produkt docelowy nie istnieje w katalogu' };

  if (context.productIndex[normalizedAlias] && normalizedAlias !== normalizedProduct) {
    return { valid: false, reason: 'Alias jest pelna nazwa innego produktu' };
  }

  if (aliases[normalizedAlias]) {
    return normalizeText(aliases[normalizedAlias]) === normalizedProduct
      ? { valid: false, reason: 'Alias juz istnieje' }
      : { valid: false, reason: 'Konflikt: alias wskazuje inny produkt' };
  }

  const familyMatches = context.catalog.filter(product =>
    product.normalizedName === normalizedAlias ||
    product.normalizedName.startsWith(normalizedAlias + ' ')
  );
  if (familyMatches.length > 1) {
    return { valid: false, reason: 'Alias jest zbyt ogolny i pasuje do kilku produktow' };
  }

  const targetNumbers = (normalizedProduct.match(/\d+/g) || []);
  const aliasNumbers = (normalizedAlias.match(/\d+/g) || []);
  const numericFamily = context.catalog.filter(product => {
    const name = normalizeText(product.name);
    const base = name.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    const targetBase = normalizedProduct.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    return base === targetBase;
  });
  if (targetNumbers.length && numericFamily.length > 1 &&
      !targetNumbers.every(number => aliasNumbers.includes(number))) {
    return { valid: false, reason: 'Alias pomija liczbe odrozniajaca wariant produktu' };
  }

  return { valid: true, alias: alias, product: productName };
}