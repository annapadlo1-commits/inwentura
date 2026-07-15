/**
 * Inventory PRO Enterprise v2.3.0
 * Bezpieczne zapamietywanie wyborow uzytkownika.
 */
function collectAliasSuggestions_(items) {
  const suggestions = [];
  (items || []).forEach(item => {
    if (!item.include || !item.learnAlias || !item.parsedProduct || !item.selectedProduct) return;
    const alias = String(item.parsedProduct).trim();
    const product = String(item.selectedProduct).trim();
    if (alias && product && normalizeText(alias) !== normalizeText(product)) {
      suggestions.push({ alias: alias, product: product });
    }
  });
  return suggestions;
}

function validateAliasSuggestion_(suggestion, runtimeContext, existingAliases) {
  const alias = String(suggestion.alias || '').trim();
  const productName = String(suggestion.product || '').trim();
  const normalizedAlias = normalizeText(alias);
  const normalizedProduct = normalizeText(productName);
  const context = runtimeContext || buildRuntimeContext_();
  const aliases = existingAliases || loadAliases();

  if (!normalizedAlias || !normalizedProduct) return { valid: false, reason: 'Pusty alias lub produkt' };
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

  return { valid: true, alias: alias, product: productName };
}
