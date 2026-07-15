/**
 * Inventory PRO 3.0 RC4 — Parser Engine
 *
 * Jedna kompletna implementacja parsera. Nie jest to patch.
 *
 * Zasady:
 * - Enter jest twardą granicą bezpieczeństwa, ale nie jest wymagany.
 * - Najpierw rozpoznawany jest najdłuższy produkt/alias, dopiero potem wartość.
 * - Liczby należące do nazwy produktu nie są traktowane jako stan.
 * - Wartość może wystąpić przed lub po produkcie.
 * - Lokalizacje działają sekcyjnie: magazyn / darkroom / lodówki.
 * - Osierocone tokeny typu „years” nie tworzą osobnych pozycji.
 * - Indeksy są budowane raz na analizę.
 */

function parseInventoryText(inputText, runtimeContext) {
  const raw = String(inputText == null ? '' : inputText)
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!raw) return [];

  const context = prepareParserRuntime_(runtimeContext || buildRuntimeContext_());
  const lines = raw.split('\n');
  const results = [];
  let inheritedLocation = '';

  lines.forEach(line => {
    const text = String(line || '').trim();
    if (!text) return;
    const parsed = parseInventoryStream_(text, context, inheritedLocation);
    if (parsed.length) {
      const lastLocation = parsed[parsed.length - 1].location;
      if (lastLocation) inheritedLocation = lastLocation;
      Array.prototype.push.apply(results, parsed);
    } else {
      const onlyLocation = parseStandaloneLocation_(text);
      if (onlyLocation) inheritedLocation = onlyLocation;
    }
  });

  return results;
}

function parseInventoryStream_(text, context, initialLocation) {
  const tokens = tokenizeParserInput_(text);
  const results = [];
  let position = 0;
  let currentLocation = initialLocation || '';

  while (position < tokens.length) {
    const location = readParserLocationAt_(tokens, position);
    if (location) {
      currentLocation = location.location;
      position += location.consumed;
      continue;
    }

    if (isParserConnector_(tokens[position])) {
      position++;
      continue;
    }

    // 1) standard: produkt/alias od bieżącej pozycji (longest match)
    const productMatch = findLongestParserProductAt_(tokens, position, context);
    if (productMatch) {
      const after = readParserNumberAt_(tokens, productMatch.end);
      const nextProductAtEnd = findLongestParserProductAt_(tokens, productMatch.end, context);

      let valueInfo = null;
      let nextPosition = productMatch.end;
      if (after && !nextProductAtEnd) {
        valueInfo = after;
        nextPosition = after.end;
      }

      results.push(buildParserResult_(
        tokens,
        productMatch.start,
        nextPosition,
        productMatch,
        valueInfo,
        currentLocation
      ));
      position = Math.max(nextPosition, position + 1);
      continue;
    }

    // 2) wartość przed produktem
    const leadingNumber = readParserNumberAt_(tokens, position);
    if (leadingNumber) {
      const leadingProduct = findLongestParserProductAt_(tokens, leadingNumber.end, context);
      if (leadingProduct) {
        results.push(buildParserResult_(
          tokens,
          position,
          leadingProduct.end,
          leadingProduct,
          leadingNumber,
          currentLocation
        ));
        position = leadingProduct.end;
        continue;
      }
    }

    // 3) nieznany produkt: zbierz frazę do najbliższej wartości lub lokalizacji.
    const fallback = readUnknownParserEntryAt_(tokens, position, context, currentLocation);
    if (fallback) {
      results.push(fallback.result);
      position = fallback.nextPosition;
      continue;
    }

    position++;
  }

  return results;
}

function prepareParserRuntime_(context) {
  if (context && context.__parserRC4Prepared) return context;
  context = context || {};
  const catalog = Array.isArray(context.catalog) ? context.catalog : [];
  const phraseMap = Object.create(null);
  const firstTokenIndex = Object.create(null);

  function addPhrase(phrase, product, alias, priority) {
    const normalized = normalizeParserPhrase_(phrase);
    if (!normalized || !product) return;
    const phraseTokens = normalized.split(' ').filter(Boolean);
    if (!phraseTokens.length) return;

    const candidate = {
      phrase: normalized,
      tokens: phraseTokens,
      product: product,
      alias: alias || '',
      priority: Number(priority) || 0,
      sourceName: String(product.name || product.product || phrase).trim()
    };

    const current = phraseMap[normalized];
    if (!current || compareParserCandidate_(candidate, current) < 0) {
      phraseMap[normalized] = candidate;
    }
  }

  catalog.forEach(product => {
    if (!product || product.active === false) return;
    const name = product.name || product.product || '';
    buildParserNameVariants_(name).forEach((variant, index) => {
      addPhrase(variant, product, '', 100 - index);
    });
    (product.aliases || []).forEach(alias => {
      buildParserNameVariants_(alias).forEach((variant, index) => {
        addPhrase(variant, product, alias, 80 - index);
      });
    });
  });

  // Alias index może zawierać produkt albo nazwę docelową.
  const aliasIndex = context.aliasIndex || context.aliasesIndex || {};
  Object.keys(aliasIndex).forEach(alias => {
    let product = aliasIndex[alias];
    if (product && product.entry) product = product.entry;
    if (typeof product === 'string') {
      const key = normalizeText(product);
      product = (context.productIndex || {})[key] || catalog.find(item => normalizeText(item.name) === key);
    }
    if (!product) return;
    buildParserNameVariants_(alias).forEach((variant, index) => {
      addPhrase(variant, product, alias, 90 - index);
    });
  });

  Object.keys(phraseMap).forEach(key => {
    const candidate = phraseMap[key];
    const first = candidate.tokens[0];
    if (!firstTokenIndex[first]) firstTokenIndex[first] = [];
    firstTokenIndex[first].push(candidate);
  });

  Object.keys(firstTokenIndex).forEach(first => {
    firstTokenIndex[first].sort(compareParserCandidate_);
  });

  context.__parserRC4Prepared = true;
  context.__parserPhraseMap = phraseMap;
  context.__parserFirstTokenIndex = firstTokenIndex;
  return context;
}

/** Sortowanie: najwięcej tokenów, potem dłuższa fraza, potem priorytet. */
function compareParserCandidate_(a, b) {
  return (b.tokens.length - a.tokens.length) ||
    (b.phrase.length - a.phrase.length) ||
    (b.priority - a.priority) ||
    String(a.sourceName).localeCompare(String(b.sourceName), 'pl');
}

function buildParserNameVariants_(value) {
  const base = normalizeParserPhrase_(value);
  if (!base) return [];
  const variants = [];
  addParserVariant_(variants, base);

  // Kanonizacja wieku: 12yo / 12 years old / 12 years / 12.
  const ageCanonical = base
    .replace(/\b(years old|year old|years|year|yrs|yr|y o)\b/g, 'yo')
    .replace(/\s+/g, ' ')
    .trim();
  addParserVariant_(variants, ageCanonical);
  addParserVariant_(variants, ageCanonical.replace(/\s+yo\b/g, ''));

  // Warianty ZERO są częścią nazwy produktu, a nie wartością inwentaryzacji.
  // Dotyczy m.in. Amaro Lucano 0% oraz produktów typu KOLA BEZ CUKRU.
  // Dzięki temu:
  //   amaro lucano zero 1,234 -> produkt 0%, wartość 1,234
  //   kola 0 12 -> produkt KOLA BEZ CUKRU, wartość 12
  if (/\b0%\b/.test(base) || /\b0\s*%/.test(base)) {
    addParserVariant_(variants, base.replace(/\b0\s*%/g, 'zero'));
    addParserVariant_(variants, base.replace(/\b0\s*%/g, '0'));
  }
  if (/\bzero\b/.test(base)) {
    addParserVariant_(variants, base.replace(/\bzero\b/g, '0'));
    addParserVariant_(variants, base.replace(/\bzero\b/g, '0%'));
  }
  if (/\bbez cukru\b/.test(base)) {
    addParserVariant_(variants, base.replace(/\bbez cukru\b/g, 'zero'));
    addParserVariant_(variants, base.replace(/\bbez cukru\b/g, '0'));
  }

  // Wariant bez technicznej pojemności na końcu. Dzięki temu Jameson 0,7L
  // może być rozpoznany jako "Jameson", a następujące 12 pozostaje wartością.
  // UWAGA: 0% nie jest pojemnością i nie może być usuwane z nazwy wariantu.
  const withoutVolume = removeTrailingParserVolume_(base);
  addParserVariant_(variants, withoutVolume);

  // Alias ze słowem „old” toleruje dyktowanie bez ostatniego słowa.
  addParserVariant_(variants, base.replace(/\s+old\b/g, '').trim());

  return variants.filter(Boolean);
}

function addParserVariant_(list, value) {
  const normalized = normalizeParserPhrase_(value);
  if (normalized && !list.includes(normalized)) list.push(normalized);
}

function removeTrailingParserVolume_(value) {
  return String(value || '')
    .replace(/\s+\d+(?:\.\d+)?\s*(?:ml|cl|l|litre|liter|litra|litry|kg)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findLongestParserProductAt_(tokens, start, context) {
  if (start < 0 || start >= tokens.length) return null;
  const first = tokens[start].norm;
  const candidates = (context.__parserFirstTokenIndex && context.__parserFirstTokenIndex[first]) || [];
  if (!candidates.length) return null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (start + candidate.tokens.length > tokens.length) continue;
    let matches = true;
    for (let offset = 0; offset < candidate.tokens.length; offset++) {
      if (tokens[start + offset].norm !== candidate.tokens[offset]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    return {
      start: start,
      end: start + candidate.tokens.length,
      phrase: candidate.phrase,
      product: candidate.product,
      alias: candidate.alias,
      recognitionInput: candidate.phrase
    };
  }
  return null;
}

/** Kompatybilność z istniejącymi testami/narzędziami. */
function findBestInventoryEntryAt_(tokens, startIndex, context) {
  const normalizedTokens = (tokens || []).map(token => {
    if (typeof token === 'string') return { raw: token, norm: normalizeParserToken_(token) };
    return { raw: token.raw || token.text || '', norm: token.norm || normalizeParserToken_(token.text || token.raw || '') };
  }).filter(token => token.norm);
  const runtime = prepareParserRuntime_(context || buildRuntimeContext_());
  const match = findLongestParserProductAt_(normalizedTokens, Number(startIndex) || 0, runtime);
  if (!match) return null;
  const number = readParserNumberAt_(normalizedTokens, match.end);
  return {
    originalProduct: match.recognitionInput,
    product: match.recognitionInput,
    number: number ? { value: number.value, originalText: number.originalText, consumed: number.consumed } : null,
    nextPosition: number ? number.end : match.end,
    originalInput: normalizedTokens.slice(match.start, number ? number.end : match.end).map(item => item.raw).join(' '),
    entry: match.product,
    matchedAlias: match.alias || ''
  };
}

function buildParserResult_(tokens, sourceStart, sourceEnd, productMatch, numberInfo, location) {
  const productText = productMatch.recognitionInput || productMatch.phrase;
  return {
    originalInput: tokens.slice(sourceStart, sourceEnd).map(token => token.raw).join(' ').trim(),
    product: productText,
    value: numberInfo ? numberInfo.value : null,
    location: location || '',
    status: numberInfo ? 'OK' : 'ERROR',
    message: numberInfo ? 'Rozpoznano dictionary-first longest-match' : 'Nie znaleziono ilosci',
    matchedProduct: productMatch.product && productMatch.product.name ? productMatch.product.name : '',
    matchedAlias: productMatch.alias || ''
  };
}

function readUnknownParserEntryAt_(tokens, start, context, location) {
  // Nie zaczynaj rekordu od osieroconych znaczników wieku.
  if (isAgeMarkerToken_(tokens[start] && tokens[start].norm)) return null;

  let number = null;
  let numberPosition = -1;
  for (let i = start + 1; i < tokens.length; i++) {
    if (readParserLocationAt_(tokens, i) || findLongestParserProductAt_(tokens, i, context)) break;
    const candidate = readParserNumberAt_(tokens, i);
    if (candidate) {
      number = candidate;
      numberPosition = i;
      break;
    }
  }

  if (!number) {
    // Ostatni nierozpoznany fragment bez wartości: jeden błąd, nigdy kilka tokenów.
    let end = start + 1;
    while (end < tokens.length && !readParserLocationAt_(tokens, end) && !findLongestParserProductAt_(tokens, end, context)) end++;
    const phrase = tokens.slice(start, end).map(token => token.raw).join(' ').trim();
    if (!phrase) return null;
    return {
      result: {
        originalInput: phrase,
        product: normalizeRecognitionInput_(phrase),
        value: null,
        location: location || '',
        status: 'ERROR',
        message: 'Nie znaleziono ilosci'
      },
      nextPosition: end
    };
  }

  const phrase = tokens.slice(start, numberPosition).map(token => token.raw).join(' ').trim();
  if (!phrase || isOnlyAgeMarkerPhrase_(phrase)) return null;
  return {
    result: {
      originalInput: tokens.slice(start, number.end).map(token => token.raw).join(' ').trim(),
      product: normalizeRecognitionInput_(phrase),
      value: number.value,
      location: location || '',
      status: 'OK',
      message: 'Rozpoznano bez dopasowania katalogowego'
    },
    nextPosition: number.end
  };
}

function tokenizeParserInput_(text) {
  const prepared = String(text || '')
    .replace(/([A-Za-zÀ-ž])(?=\d)/g, '$1 ')
    .replace(/(\d)(?=[A-Za-zÀ-ž])/g, '$1 ')
    .replace(/[;|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!prepared) return [];
  return prepared.split(' ').map(raw => ({ raw: raw, norm: normalizeParserToken_(raw) })).filter(token => token.norm);
}

function normalizeParserPhrase_(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z])(?=\d)/g, '$1 ')
    .replace(/(\d)(?=[a-z])/g, '$1 ')
    .replace(/(\d)[,.](\d)/g, '$1.$2')
    .replace(/[^a-z0-9.%+\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeParserToken_(value) {
  return normalizeParserPhrase_(String(value || '').replace(/[.,:!?]+$/g, ''));
}

function normalizeRecognitionInput_(value) {
  return normalizeParserPhrase_(value)
    .replace(/\b(years old|year old|yrs|yr)\b/g, 'years')
    .replace(/\b(y o)\b/g, 'yo')
    .replace(/\s+/g, ' ')
    .trim();
}

function readParserNumberAt_(tokens, start) {
  if (start < 0 || start >= tokens.length) return null;
  const maxWords = Math.min(4, tokens.length - start);
  for (let length = maxWords; length >= 1; length--) {
    const raw = tokens.slice(start, start + length).map(token => token.raw).join(' ');
    const value = parseNumberText_(raw);
    if (value !== null && Number.isFinite(value)) {
      return {
        value: value,
        start: start,
        end: start + length,
        consumed: length,
        originalText: raw
      };
    }
  }
  return null;
}

function parseNumberText_(valueText) {
  let text = normalizeParserPhrase_(valueText);
  if (!text) return null;
  text = text.replace(/[.,:!?]+$/g, '').trim();

  // Liczby dziesiętne: przecinek i kropka zawsze są separatorami dziesiętnymi.
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const direct = {
    zero: 0,
    pol: 0.5,
    polowa: 0.5,
    poltora: 1.5,
    jeden: 1, jedna: 1, jedno: 1,
    dwa: 2, dwie: 2,
    trzy: 3,
    cztery: 4,
    piec: 5,
    szesc: 6,
    siedem: 7,
    osiem: 8,
    dziewiec: 9,
    dziesiec: 10,
    jedenascie: 11,
    dwanascie: 12,
    trzynascie: 13,
    czternascie: 14,
    pietnascie: 15,
    szesnascie: 16,
    siedemnascie: 17,
    osiemnascie: 18,
    dziewietnascie: 19,
    dwadziescia: 20,
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20
  };
  if (Object.prototype.hasOwnProperty.call(direct, text)) return direct[text];

  const parts = text.split(' ').filter(Boolean);
  if (parts.length === 2 && Object.prototype.hasOwnProperty.call(direct, parts[0]) && Object.prototype.hasOwnProperty.call(direct, parts[1])) {
    const first = direct[parts[0]];
    const second = direct[parts[1]];
    if (first >= 20 && second >= 0 && second < 10) return first + second;
  }
  return null;
}

function readParserLocationAt_(tokens, start) {
  const one = tokens[start] ? tokens[start].norm : '';
  const two = tokens[start + 1] ? one + ' ' + tokens[start + 1].norm : one;
  const map = {
    magazyn: 'magazyn', warehouse: 'magazyn',
    darkroom: 'darkroom', 'dark room': 'darkroom',
    lodowki: 'lodowki', lodowka: 'lodowki', fridge: 'lodowki', fridges: 'lodowki'
  };
  if (map[two]) return { location: map[two], consumed: 2 };
  if (map[one]) return { location: map[one], consumed: 1 };
  return null;
}

function parseStandaloneLocation_(text) {
  const tokens = tokenizeParserInput_(text);
  const location = readParserLocationAt_(tokens, 0);
  return location && location.consumed === tokens.length ? location.location : '';
}

function isParserConnector_(token) {
  const value = token && token.norm;
  return ['i', 'oraz', 'plus', 'potem', 'nastepnie'].includes(value);
}

function isAgeMarkerToken_(value) {
  return ['years', 'year', 'old', 'yrs', 'yr', 'yo'].includes(String(value || ''));
}

function isOnlyAgeMarkerPhrase_(value) {
  const tokens = normalizeParserPhrase_(value).split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every(isAgeMarkerToken_);
}

/**
 * Matcher używany przez ImportEngine. Parser przekazuje frazę rozpoznaną
 * dictionary-first, a RecognitionEngine wybiera produkt docelowy.
 */
function matchProductForParser_(recognitionInput, context) {
  const runtime = context || buildRuntimeContext_();
  const input = normalizeRecognitionInput_(recognitionInput);
  const match = recognizeProduct_(input, runtime);
  return { recognitionInput: input, match: match, score: Number(match && match.score) || 0 };
}
