/**
 * Inventory PRO Enterprise v2.1.3 Recovery
 * Testy regresyjne.
 */

function runAllEnterpriseTests() {
  const startedAt = Date.now();

  const tests = [
    testNormalizeText_,
    testNumberParser_,
    testCompoundNumberParser_,
    testHalfNumberParser_,
    testContinuousParser_,
    testNumericProductNamesParser_,
    testNoProductPrefixSkipping_,
    testAttachedNumberProductParser_,
    testParserPunctuation_,
    testParserLocations_,
    testParserLucanoZero_,
    testParserKolaZeroVariant_,
    testParserOrdinaryZeroValue_,
    testParserHalfLitreName_,
    testParserLongestAgeName_,
    testAliasLoader_,
    testProductCatalog_,
    testExactMatcher_,
    testBusinessHistorySheet_,
    testReportSheet_,
    testValidationReport_,
    testQualityWarning_,
    testQualityZeroWarning_,
    testDuplicateAnnotation_,
    testAliasSuggestionCollection_,
    testRecognitionNumericSafety_,
    testRecognitionAttachedVariant_,
    testRecognitionAmbiguousFamily_,
    testAliasConflictProtection_,
    testNewProductNameValidation_,
    testProductResolverData_,
    testBusinessCategoryNormalization_,
    testNewProductAuditKey_,
    testSummaryColumnMapping284_,
    testSummaryInputColumns284_,
    testClosedBusinessCategories284_
  ];

  const results = tests.map(runSingleTest_);
  const passed = results.filter(
    result => result.passed
  ).length;
  const failed = results.length - passed;

  const report = {
    total: results.length,
    passed: passed,
    failed: failed,
    durationMs: Date.now() - startedAt,
    results: results
  };

  logInfo(
    'Tests',
    'runAllEnterpriseTests',
    failed === 0
      ? 'Wszystkie testy PASS'
      : 'Wykryto testy FAIL',
    report,
    report.durationMs
  );

  SpreadsheetApp.getUi().alert(
    'Inventory PRO - Testy',
    formatTestReport_(report),
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return report;
}

function runSingleTest_(testFunction) {
  const startedAt = Date.now();

  try {
    testFunction();

    return {
      name: testFunction.name,
      passed: true,
      durationMs: Date.now() - startedAt,
      message: 'PASS'
    };

  } catch (error) {
    return {
      name: testFunction.name,
      passed: false,
      durationMs: Date.now() - startedAt,
      message: normalizeError_(error).message
    };
  }
}

function formatTestReport_(report) {
  let message =
    'Testy: ' + report.total + '\n' +
    'PASS: ' + report.passed + '\n' +
    'FAIL: ' + report.failed + '\n' +
    'Czas: ' + report.durationMs + ' ms';

  const failedTests = report.results.filter(
    result => !result.passed
  );

  if (failedTests.length) {
    message += '\n\nBLEDY:\n';

    failedTests.forEach(result => {
      message +=
        '- ' +
        result.name +
        ': ' +
        result.message +
        '\n';
    });
  }

  return message;
}

function testNormalizeText_() {
  assertCondition_(
    normalizeText('  Żółta, Kola  ') ===
      'zolta kola',
    'normalizeText nie dziala poprawnie.'
  );
}

function testNumberParser_() {
  assertCondition_(
    parseNumberText_('trzy') === 3,
    'trzy powinno dac 3'
  );

  assertCondition_(
    parseNumberText_('0,52') === 0.52,
    '0,52 powinno dac 0.52'
  );

  assertCondition_(
    parseNumberText_('1,212') === 1.212,
    '1,212 powinno dac 1.212'
  );
}

function testCompoundNumberParser_() {
  assertCondition_(
    parseNumberText_(
      'dwadziescia siedem'
    ) === 27,
    'dwadziescia siedem powinno dac 27'
  );
}

function testHalfNumberParser_() {
  assertCondition_(
    parseNumberText_('pol') === 0.5,
    'pol powinno dac 0.5'
  );

  assertCondition_(
    parseNumberText_('poltora') === 1.5,
    'poltora powinno dac 1.5'
  );
}

function testContinuousParser_() {
  const parsed = parseInventoryText(
    'Martini Bitter 1,212 Godet VSOP 1,046'
  );

  assertCondition_(
    parsed.length === 2,
    'Powinny byc 2 pozycje, sa: ' +
      parsed.length
  );

  assertCondition_(
    parsed[0].product === 'Martini Bitter' &&
    parsed[1].product === 'Godet VSOP',
    'Nazwy zostaly zle rozdzielone.'
  );
}

function testParserPunctuation_() {
  const parsed = parseInventoryText(
    'darkroom Litowel Ciemny Lager 24. magazyn Inne Beczki Jungle IPA 20'
  );

  assertCondition_(
    parsed.length === 2,
    'Powinny byc 2 pozycje.'
  );

  assertCondition_(
    parsed[0].value === 24 &&
    parsed[1].value === 20,
    'Interpunkcja zepsula liczby.'
  );
}

function testParserLocations_() {
  const parsed = parseInventoryText(
    'darkroom Litowel Pomelo 30 Litowel Pomelo 2 magazyn Jurajska Pomarancza 120'
  );

  assertCondition_(
    parsed.length === 3,
    'Powinny byc 3 pozycje.'
  );

  assertCondition_(
    parsed[0].location === 'darkroom' &&
    parsed[1].location === 'darkroom' &&
    parsed[2].location === 'magazyn',
    'Lokalizacje sekcyjne sa bledne.'
  );
}

function testParserLucanoZero_() {
  const context = createParserTestContext_([
    'Amaro Lucano 1L',
    'Amaro Lucano 0% 0,7L'
  ]);
  const parsed = parseInventoryText('amaro lucano zero 1,234', context);
  assertCondition_(parsed.length === 1, 'Lucano zero powinno byc jedna pozycja.');
  assertCondition_(normalizeText(parsed[0].product) === normalizeText('Amaro Lucano 0% 0,7L'), 'Lucano zero wybralo zly produkt.');
  assertCondition_(parsed[0].value === 1.234, 'Lucano zero ma zla wartosc.');
}

function testParserKolaZeroVariant_() {
  const context = createParserTestContext_([
    'Fritz 200ml KOLA',
    'Fritz 200ml KOLA BEZ CUKRU'
  ]);
  const parsed = parseInventoryText('kola 0 12', context);
  assertCondition_(parsed.length === 1, 'Kola 0 12 powinna byc jedna pozycja.');
  assertCondition_(normalizeText(parsed[0].product) === normalizeText('Fritz 200ml KOLA BEZ CUKRU'), 'Kola 0 nie wybrala wariantu bez cukru.');
  assertCondition_(parsed[0].value === 12, 'Kola 0 12 ma zla wartosc.');
}

function testParserOrdinaryZeroValue_() {
  const context = createParserTestContext_(['Fritz 200ml KOLA']);
  const product = context.catalog[0];
  product.aliases.push('fritz kola');
  context.parserPhraseIndex = null;
  const parsed = parseInventoryText('fritz kola 0', context);
  assertCondition_(parsed.length === 1, 'Fritz kola 0 powinna byc jedna pozycja.');
  assertCondition_(parsed[0].value === 0, 'Zwykle zero powinno pozostac wartoscia.');
}

function testParserHalfLitreName_() {
  const context = createParserTestContext_(['Żubrówka Bison Grass 0,5L']);
  const parsed = parseInventoryText('żubrówka bison grass pół litra 1,234', context);
  assertCondition_(parsed.length === 1, 'Pol litra powinno byc jedna pozycja.');
  assertCondition_(normalizeText(parsed[0].product) === normalizeText('Żubrówka Bison Grass 0,5L'), 'Pol litra wybralo zly produkt.');
  assertCondition_(parsed[0].value === 1.234, 'Pol litra ma zla wartosc.');
}

function testParserLongestAgeName_() {
  const context = createParserTestContext_(['Osco', 'Osco 2 years old']);
  const parsed = parseInventoryText('Osco 2 years old 22', context);
  assertCondition_(parsed.length === 1, 'Osco 2 years old powinno byc jedna pozycja.');
  assertCondition_(normalizeText(parsed[0].product) === normalizeText('Osco 2 years old'), 'Parser wybral krotsze Osco.');
  assertCondition_(parsed[0].value === 22, 'Osco 2 years old ma zla wartosc.');
}

function testAliasLoader_() {
  const aliases = loadAliases();

  assertCondition_(
    aliases &&
    typeof aliases === 'object',
    'loadAliases nie zwraca obiektu.'
  );
}

function testProductCatalog_() {
  const summary = getProductCatalogSummary();

  assertCondition_(
    summary.products > 0,
    'Katalog produktow jest pusty.'
  );
}

function testExactMatcher_() {
  const context = buildRuntimeContext_();

  if (!context.catalog.length) {
    throw new Error(
      'Brak produktow do testu matcher.'
    );
  }

  const sample = context.catalog[0];

  const result = matchProduct(
    sample.name,
    context
  );

  assertCondition_(
    result.matched &&
    result.status === 'EXACT',
    'Dokladna nazwa nie daje EXACT.'
  );
}

function testBusinessHistorySheet_() {
  const sheet =
    getOrCreateBusinessHistorySheet_();

  assertCondition_(
    normalizeText(sheet.getName()) ===
      normalizeText(CONFIG.SHEETS.HISTORY),
    'Nieprawidlowy arkusz historii.'
  );
}

function testReportSheet_() {
  const sheet = getOrCreateConfiguredSheet_(
    CONFIG.SHEETS.REPORT
  );

  ensureReportHeaders_(sheet);

  assertCondition_(
    normalizeText(
      sheet.getRange(1, 1).getDisplayValue()
    ) === 'import id',
    'Raport nie ma poprawnych naglowkow.'
  );
}

function testValidationReport_() {
  const result = buildValidationReport_();

  assertCondition_(
    result &&
    Array.isArray(result.errors),
    'Raport walidacji ma zla strukture.'
  );
}


function testQualityWarning_() {
  const product = {
    type: CONFIG.PRODUCT_TYPES.NORMAL
  };

  const result = evaluateImportQuality_(
    product,
    21,
    '',
    {
      warnZero: true,
      blockNegative: true,
      normalWholeWarning: 20,
      normalWeightWarning: 20,
      kegWholeWarning: 20,
      kegWeightWarning: 100,
      locationWarning: 500,
      duplicateWarningCount: 2
    }
  );

  assertCondition_(
    result.warning === true,
    'Wartosc 21 dla NORMAL powinna generowac ostrzezenie.'
  );
}


function testQualityZeroWarning_() {
  const result = evaluateImportQuality_(
    { type: CONFIG.PRODUCT_TYPES.NORMAL },
    0,
    '',
    {
      warnZero: true,
      blockNegative: true,
      normalWholeWarning: 20,
      normalWeightWarning: 20,
      kegWholeWarning: 20,
      kegWeightWarning: 100,
      locationWarning: 500,
      duplicateWarningCount: 2
    }
  );

  assertCondition_(
    result.warning === true &&
    result.flags.includes('WPROWADZONO_ZERO'),
    'Wartosc 0 powinna generowac flage WPROWADZONO_ZERO.'
  );
}

function testDuplicateAnnotation_() {
  const results = [
    {
      saved: true,
      product: 'Bacardi 8',
      row: 10,
      column: 'C',
      addedValue: 1.2,
      message: 'Zapisano'
    },
    {
      saved: true,
      product: 'Bacardi 8',
      row: 10,
      column: 'C',
      addedValue: 0.8,
      message: 'Zapisano'
    }
  ];

  annotateSavedDuplicateResults_(results, { duplicateWarningCount: 2 });

  assertCondition_(
    results[0].duplicateWarning === true &&
    results[0].duplicateCount === 2 &&
    Math.abs(results[0].duplicateTotal - 2) < 0.000001,
    'Dwa wpisy do tej samej komorki powinny zostac oznaczone jako duplikat z suma 2.'
  );
}

function testAliasSuggestionCollection_() {
  const result = collectAliasSuggestions_([
    {
      include: true,
      learnAlias: true,
      parsedProduct: 'Thomas Henry tonik',
      selectedProduct: 'Thomas Henry Tonic'
    },
    {
      include: true,
      learnAlias: false,
      parsedProduct: 'Fritz',
      selectedProduct: 'Fritz Kola'
    }
  ]);

  assertCondition_(
    result.length === 1 &&
    result[0].alias ===
      'Thomas Henry tonik',
    'Auto Learning nie zebral poprawnego aliasu.'
  );
}


function testNumericProductNamesParser_() {
  const context = createParserTestContext_([
    'Jameson 0,7L',
    'Auchentoshan 12yo',
    'Auchentoshan 18yo',
    'Auchentoshan Three Wood',
    'Bacardi 4',
    'Bacardi 8',
    'Bacardi 10',
    'Osco',
    'Osco 2 years old'
  ]);

  const parsed = parseInventoryText(
    'Jameson 12 Auchentoshan 12 1,234 Auchentoshan 18 1,234 Bacardi 4 0,890 Bacardi 8 0,987 Bacardi 10 1,123 Osco 2 years 22',
    context
  );

  assertCondition_(
    parsed.length === 7,
    'Nazwy z cyframi: powinno byc 7 pozycji, sa: ' + parsed.length
  );

  const expected = [
    ['Jameson', 12],
    ['Auchentoshan 12', 1.234],
    ['Auchentoshan 18', 1.234],
    ['Bacardi 4', 0.89],
    ['Bacardi 8', 0.987],
    ['Bacardi 10', 1.123],
    ['Osco 2 years', 22]
  ];

  expected.forEach((item, index) => {
    assertCondition_(
      normalizeText(parsed[index].product) === normalizeText(item[0]) &&
      parsed[index].value === item[1],
      'Nieprawidlowy podzial pozycji ' + (index + 1) +
      ': ' + JSON.stringify(parsed[index])
    );
  });
}

function testAttachedNumberProductParser_() {
  const context = createParserTestContext_([
    'Bacardi 8',
    'Bacardi 10'
  ]);

  const parsed = parseInventoryText(
    'bacardi8 0,987 bacardi10 1,123',
    context
  );

  assertCondition_(
    parsed.length === 2 &&
    normalizeText(parsed[0].product) === 'bacardi 8' &&
    parsed[0].value === 0.987 &&
    normalizeText(parsed[1].product) === 'bacardi 10' &&
    parsed[1].value === 1.123,
    'Nazwy sklejone z cyfra zostaly zle rozpoznane.'
  );
}

function createParserTestContext_(names) {
  const catalog = names.map(name => ({
    name: name,
    normalizedName: normalizeText(name),
    aliases: [],
    type: 'NORMAL',
    category: 'TEST',
    columns: {},
    active: true
  }));

  // RC3.3: parser 3.0 korzysta z tych samych indeksów co silnik
  // produkcyjny. Stary fixture testowy przekazywał tylko dwa indeksy,
  // przez co testy kończyły się TypeError przed sprawdzeniem parsera.
  const productIndex = {};
  catalog.forEach(product => {
    productIndex[product.normalizedName] = product;
  });

  return {
    catalog: catalog,
    productIndex: productIndex,
    aliasIndex: {},
    exactRecognitionIndex: buildExactRecognitionIndex_(catalog),
    technicalRecognitionIndex: buildTechnicalRecognitionIndex_(catalog),
    firstTokenIndex: buildFirstTokenRecognitionIndex_(catalog),
    recognitionMemo: {}
  };
}


function testNoProductPrefixSkipping_() {
  const context = createParserTestContext_([
    'Jameson 0,7L',
    'Auchentoshan 12yo',
    'Auchentoshan 18yo'
  ]);

  const parsed = parseInventoryText(
    'Jameson 12 Auchentoshan 12 1,234 Auchentoshan 18 1,234',
    context
  );

  assertCondition_(
    parsed.length === 3,
    'Parser polaczyl sasiednie produkty. Pozycji: ' + parsed.length
  );

  assertCondition_(
    normalizeText(parsed[0].product) === 'jameson' &&
    parsed[0].value === 12 &&
    normalizeText(parsed[1].product) === 'auchentoshan 12' &&
    parsed[1].value === 1.234 &&
    normalizeText(parsed[2].product) === 'auchentoshan 18' &&
    parsed[2].value === 1.234,
    'Parser pominal poczatek pozycji lub polaczyl produkty: ' +
      JSON.stringify(parsed)
  );
}


function testRecognitionNumericSafety_() {
  const context = createRecognitionTestContext_(['Bacardi 4', 'Bacardi 8', 'Bacardi 10']);
  const result = recognizeProduct_('bakardi 8', context);
  assertCondition_(result.matched, 'Bakardi 8 powinno zostac rozpoznane');
  assertCondition_(result.product && result.product.name === 'Bacardi 8', 'Nie wolno pomylic liczby wariantu');
}

function testRecognitionAttachedVariant_() {
  const context = createRecognitionTestContext_(['Bacardi 8']);
  const result = recognizeProduct_('Bacardi8', context);
  assertCondition_(result.matched, 'Bacardi8 powinno byc wariantem technicznym');
  assertCondition_(result.product && result.product.name === 'Bacardi 8', 'Nieprawidlowy wariant sklejony');
}

function testRecognitionAmbiguousFamily_() {
  const context = createRecognitionTestContext_(['Bacardi 4', 'Bacardi 8', 'Bacardi 10']);
  const result = recognizeProduct_('Bacardi', context);
  assertCondition_(result.status === 'AMBIGUOUS', 'Sama marka musi wymagac wyboru');
}

function testAliasConflictProtection_() {
  const context = createRecognitionTestContext_(['Bacardi 4', 'Bacardi 8']);
  const result = validateAliasSuggestion_({ alias: 'Bacardi', product: 'Bacardi 8' }, context, {});
  assertCondition_(!result.valid, 'Zbyt ogolny alias powinien byc zablokowany');
}

function createRecognitionTestContext_(names) {
  const catalog = names.map(name => ({
    name: name,
    normalizedName: normalizeText(name),
    aliases: [],
    type: 'NORMAL',
    category: 'TEST'
  }));
  const productIndex = {};
  catalog.forEach(product => productIndex[product.normalizedName] = product);
  return {
    catalog: catalog,
    productIndex: productIndex,
    aliasIndex: {},
    exactRecognitionIndex: buildExactRecognitionIndex_(catalog),
    technicalRecognitionIndex: buildTechnicalRecognitionIndex_(catalog),
    firstTokenIndex: buildFirstTokenRecognitionIndex_(catalog),
    recognitionMemo: {}
  };
}


function testNewProductNameValidation_() {
  validateNewProductName_('Nowy Produkt Testowy');
  let failed = false;
  try { validateNewProductName_('123'); } catch (error) { failed = true; }
  assertCondition_(failed, 'Nazwa skladajaca sie tylko z liczby powinna byc odrzucona.');
}

function testProductResolverData_() {
  const context = buildRuntimeContext_();
  if (!context.catalog.length) throw new Error('Brak produktow do testu resolvera.');
  const data = getProductResolverData(context.catalog[0].name);
  assertCondition_(data && Array.isArray(data.products) && data.products.length > 0, 'Resolver nie zwraca katalogu produktow.');
  assertCondition_(Array.isArray(data.suggestions) && data.suggestions.length > 0, 'Resolver nie zwraca sugestii.');
}

function testProductManagerPayloadValidation_() {
  const valid = validateProductManagerPayload_({
    originalName: 'Test Product',
    name: 'Test Product',
    type: 'NORMAL',
    category: 'TEST',
    active: true,
    columns: { quantity: 'H', weight: 'C' }
  });
  assertCondition_(valid.type === 'NORMAL' && valid.columns.quantity === 'H', 'Walidacja Product Manager zwrocila zle dane.');

  let failed = false;
  try {
    validateProductManagerPayload_({
      originalName: 'Test Product',
      name: 'Test Product',
      type: 'LOCATION',
      category: 'TEST',
      active: true,
      columns: {}
    });
  } catch (error) {
    failed = true;
  }
  assertCondition_(failed, 'LOCATION bez kolumn lokalizacji powinien byc odrzucony.');
}


function testBusinessCategoryNormalization_() {
  assertCondition_(normalizeBusinessCategory_('SOFTY na szt. MAGAZYN SZT DARKROOM SZT LODÓWKI SZT razem') === 'SOFTY',
    'Kategoria SOFTY nie zostala znormalizowana.');
  assertCondition_(normalizeBusinessCategory_('PIWO BUTELKI MAGAZYN SZT DARKROOM SZT LODÓWKI SZT RAZEM') === 'PIWO BUTELKI',
    'Kategoria PIWO BUTELKI nie zostala znormalizowana.');
}

function testNewProductAuditKey_() {
  const key = buildNewProductAuditKey_('Thomas Henry Arbuz', 273);
  assertCondition_(key === 'thomas henry arbuz|273', 'Nieprawidlowy klucz audytu nowego produktu.');
}


function testAliasManagerPayloadValidation_() {
  const products = loadAllProductConfigurationsForManager_();
  if (!products.length) throw new Error('Brak produktu do testu Alias Managera.');
  const result = validateAliasManagerPayload_({
    alias: 'alias testowy inventory pro',
    product: products[0].name
  }, false);
  assertCondition_(
    result.alias === 'alias testowy inventory pro' && result.product === products[0].name,
    'Walidacja Alias Managera zwrocila nieprawidlowy wynik.'
  );
}

function testAliasRowsForManager_() {
  const rows = loadAliasRowsForManager_();
  assertCondition_(Array.isArray(rows), 'Lista aliasow Alias Managera nie jest tablica.');
}

function testCategoryService282_() {
  assertCondition_(normalizeBusinessCategory_('SOFTY na szt. MAGAZYN SZT DARKROOM SZT LODÓWKI SZT razem') === 'SOFTY', 'Kategoria SOFTY powinna zostać oczyszczona.');
  assertCondition_(normalizeBusinessCategory_('WÓDKA') === 'WÓDKA', 'Kategoria WÓDKA powinna zachować polski zapis.');
}

function testFinalReviewSources282_() {
  const sources = getFinalReviewSources();
  assertCondition_(Array.isArray(sources), 'Lista arkuszy eksportu powinna być tablicą.');
  assertCondition_(sources.some(item => item.current), 'Lista powinna zawierać bieżącą inwentaryzację.');
}


function testSummaryColumnMapping284_() {
  assertCondition_(getInventorySummaryLayout_('NORMAL').finalTotal === 'K', 'NORMAL musi korzystać z kolumny K.');
  assertCondition_(getInventorySummaryLayout_('KEG').finalTotal === 'J', 'KEG musi korzystać z kolumny J.');
  assertCondition_(getInventorySummaryLayout_('LOCATION').finalTotal === 'E', 'LOCATION musi korzystać z kolumny E.');
}

function testSummaryInputColumns284_() {
  const normal = getInventorySummaryLayout_('NORMAL');
  const keg = getInventorySummaryLayout_('KEG');
  const location = getInventorySummaryLayout_('LOCATION');
  assertCondition_(normal.grossWeight === 'C' && normal.fullUnits === 'H', 'Nieprawidłowe kolumny wejściowe NORMAL.');
  assertCondition_(keg.grossWeight === 'C' && keg.fullUnits === 'G', 'Nieprawidłowe kolumny wejściowe KEG.');
  assertCondition_(location.warehouse === 'B' && location.darkroom === 'C' && location.fridges === 'D', 'Nieprawidłowe kolumny LOCATION.');
}

function testClosedBusinessCategories284_() {
  const allowed = getBusinessCategories();
  assertCondition_(allowed.indexOf('WINO') >= 0 && allowed.indexOf('SOFTY') >= 0, 'Brak podstawowych kategorii biznesowych.');
  assertCondition_(normalizeBusinessCategory_('weissburgunder 0 0,75 0 0') === '', 'Tekst produktu nie może zostać kategorią.');
}


function testZeroProtectedProductNames292_() {
  const context = buildRuntimeContext_();
  const lucano = parseInventoryText('amaro lucano zero 3', context);
  assertCondition_(lucano.length === 1 && Number(lucano[0].value) === 3, 'Lucano zero powinno zachować wartość 3.');
  assertCondition_(normalizeText(lucano[0].product).indexOf('zero') >= 0 || normalizeText(lucano[0].product).indexOf('0') >= 0, 'Zero powinno pozostać częścią nazwy Lucano.');

  const cola = parseInventoryText('lodowki fritz kola zero 4 lodowki fritz jablko 7', context);
  assertCondition_(cola.length === 2, 'Parser powinien zwrócić dwie pozycje bez przesunięcia wartości.');
  assertCondition_(Number(cola[0].value) === 4 && Number(cola[1].value) === 7, 'Wartości 4 i 7 nie mogą przeciekać między wpisami.');
}

function testNumericZeroStillWorks292_() {
  const context = buildRuntimeContext_();
  const parsed = parseInventoryText('fritz kola 0', context);
  assertCondition_(parsed.length === 1 && Number(parsed[0].value) === 0, 'Cyfrowe 0 musi nadal działać jako rzeczywista wartość.');
}


/** v2.10.1: regresje parsera nazw zawierajacych zero. */
function runZeroSafeParserRegressionTests2101() {
  const cases = [
    { input: 'kola zero 1', expectedValue: 1, expectedCount: 1 },
    { input: 'lucano zero 2', expectedValue: 2, expectedCount: 1 },
    { input: 'fritz kola 0', expectedValue: 0, expectedCount: 1 }
  ];
  const context = buildRuntimeContext_();
  const failures = [];

  cases.forEach(testCase => {
    const result = parseInventoryText(testCase.input, context);
    if (result.length !== testCase.expectedCount ||
        !result[0] || Number(result[0].value) !== testCase.expectedValue) {
      failures.push(testCase.input + ' -> ' + JSON.stringify(result));
    }
  });

  const message = failures.length
    ? 'FAIL (' + failures.length + ')\n' + failures.join('\n')
    : 'PASS: ' + cases.length + ' testy Zero-Safe Parser';
  SpreadsheetApp.getUi().alert('Inventory PRO 2.10.1 — Zero-Safe Tests', message, SpreadsheetApp.getUi().ButtonSet.OK);
  if (failures.length) throw new Error(message);
  return { passed: cases.length, failed: 0 };
}

/** v2.10.3 — czytelne testy ZERO: tokenizer + pełny pipeline. */
function runZeroImportRegressionTests2104() {
  const cases = [
    { input: 'kola zero 1', tokenName: 'kola zero', product: 'fritz 200ml kola bez cukru', value: 1 },
    { input: 'lucano zero 2', tokenName: 'lucano zero', product: 'amaro lucano 0% 0,7l', value: 2 },
    { input: 'fritz kola 0', tokenName: 'fritz kola', product: 'fritz 200ml kola', value: 0 }
  ];
  const context = buildRuntimeContext_();
  const results = cases.map(function(testCase) {
    const parsed = parseInventoryText(testCase.input, context);
    const first = parsed[0] || {};
    const tokenName = normalizeText(first.product || '');
    const tokenPassed = parsed.length === 1 &&
      tokenName.indexOf(normalizeText(testCase.tokenName)) !== -1 &&
      Number(first.value) === Number(testCase.value);

    const canonical = getCanonicalParserProductForTest_(first.product || '', context);
    const pipelinePassed = canonical.indexOf(normalizeText(testCase.product)) !== -1 &&
      Number(first.value) === Number(testCase.value);

    return {
      input: testCase.input,
      tokenPassed: tokenPassed,
      pipelinePassed: pipelinePassed,
      actualToken: (first.product || 'BRAK') + ' | ' + String(first.value),
      actualProduct: canonical || 'BRAK'
    };
  });

  const tokenPass = results.filter(function(r) { return r.tokenPassed; }).length;
  const pipelinePass = results.filter(function(r) { return r.pipelinePassed; }).length;
  const allPassed = tokenPass === results.length && pipelinePass === results.length;
  const lines = results.map(function(result) {
    return (result.tokenPassed ? '✓' : '✗') + ' tokenizer: ' + result.input +
      ' → ' + result.actualToken + '\n' +
      (result.pipelinePassed ? '✓' : '✗') + ' produkt: ' + result.actualProduct;
  }).join('\n\n');

  SpreadsheetApp.getUi().alert(
    'Parser ZERO — testy 2.10.5',
    'Tokenizer PASS: ' + tokenPass + '/' + results.length + '\n' +
      'Pełny pipeline PASS: ' + pipelinePass + '/' + results.length + '\n\n' + lines,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  if (!allPassed) throw new Error('Nie wszystkie testy ZERO 2.10.5 przeszły.');
  return results;
}

/** Zachowuje zgodność ze starszymi pozycjami menu. */
function runZeroImportRegressionTests2103() {
  return runZeroImportRegressionTests2104();
}

function runZeroImportRegressionTests2102() {
  return runZeroImportRegressionTests2104();
}

function getCanonicalParserProductForTest_(recognitionInput, context) {
  const parserMatch = matchProductForParser_(recognitionInput, context);
  const match = parserMatch && parserMatch.match;
  if (!match) return '';
  if (match.product && match.product.name) return normalizeText(match.product.name);
  if (match.candidates && match.candidates.length &&
      match.candidates[0].product && match.candidates[0].product.name) {
    return normalizeText(match.candidates[0].product.name);
  }
  return '';
}

/** v2.10.3 — nazwy numeryczne i słowne pojemności. */
function runNumericProductNameRegressionTests2104() {
  const cases = [
    { input: 'okentoshan 18 1.408', productContains: 'auchentoshan 18', value: 1.408 },
    { input: '1.407 ardbeg 10', productContains: 'ardbeg 10', value: 1.407 },
    { input: 'bacardi 8 0,987', productContains: 'bacardi 8', value: 0.987 },
    { input: 'singleton 15 0.588', productContains: 'singleton 15', value: 0.588 },
    { input: 'ron zacapa 23 0.335', productContains: 'ron zacapa 23', value: 0.335 },
    { input: 'bison grass pół litra 1,447', productContains: 'zubrowka bison grass 0,5', value: 1.447 }
  ];
  const context = buildRuntimeContext_();
  const results = cases.map(function(testCase) {
    const parsed = parseInventoryText(testCase.input, context);
    const first = parsed[0] || {};
    const canonical = getCanonicalParserProductForTest_(first.product || '', context);
    const passed = parsed.length === 1 &&
      canonical.indexOf(normalizeText(testCase.productContains)) !== -1 &&
      Math.abs(Number(first.value) - Number(testCase.value)) < 0.000001;
    return {
      input: testCase.input,
      passed: passed,
      actual: (canonical || first.product || 'BRAK') + ' | ' + String(first.value)
    };
  });

  const passed = results.filter(function(r) { return r.passed; }).length;
  SpreadsheetApp.getUi().alert(
    'Nazwy numeryczne i pojemności — testy 2.10.5',
    'PASS: ' + passed + '/' + results.length + '\n\n' +
      results.map(function(result) {
        return (result.passed ? '✓ ' : '✗ ') + result.input + ' → ' + result.actual;
      }).join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  if (passed !== results.length) throw new Error('Nie wszystkie testy nazw numerycznych 2.10.5 przeszły.');
  return results;
}


/** Zachowuje zgodność ze starszą pozycją menu 2.10.3. */
function runNumericProductNameRegressionTests2103() {
  return runNumericProductNameRegressionTests2104();
}
/** Inventory PRO RC3.4 — dodatkowe testy longest-match. */

function runLongestMatchParserTestsRC34_() {
  const tests = [
    testLongestMatchOscoRC34_,
    testLongestMatchDoorlysRC34_,
    testLongestMatchContinuousRC34_,
    testLongestMatchNewlineRC34_,
    testLongestMatchZeroRC34_
  ];
  const results = tests.map(function(test) {
    try { test(); return { name: test.name, passed: true, message: 'PASS' }; }
    catch (error) { return { name: test.name, passed: false, message: String(error && error.message || error) }; }
  });
  const passed = results.filter(function(r) { return r.passed; }).length;
  SpreadsheetApp.getUi().alert(
    'Parser Longest Match — RC3.4',
    'PASS: ' + passed + '/' + results.length + '\n\n' +
      results.map(function(r) { return (r.passed ? '✓ ' : '✗ ') + r.name + ': ' + r.message; }).join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return results;
}

function testLongestMatchOscoRC34_() {
  const context = createParserTestContext_(['Osco', 'Osco 2 years old']);
  const result = parseInventoryText('Osco 2 years old 22', context);
  ip34Assert_(result.length === 1, 'Oczekiwano 1 pozycji, są: ' + result.length);
  ip34Assert_(normalizeText(result[0].product) === normalizeText('Osco 2 years old'), 'Wybrano zły produkt: ' + result[0].product);
  ip34Assert_(Number(result[0].value) === 22, 'Zła wartość: ' + result[0].value);
}

function testLongestMatchDoorlysRC34_() {
  const context = createParserTestContext_(["Doorly's 12 YO", "Doorly's 3 YO"]);
  const result = parseInventoryText("Doorly's 12 YO 0,987", context);
  ip34Assert_(result.length === 1, 'Oczekiwano 1 pozycji');
  ip34Assert_(normalizeText(result[0].product) === normalizeText("Doorly's 12 YO"), 'Wybrano zły produkt');
  ip34Assert_(Number(result[0].value) === 0.987, 'Zła wartość');
}

function testLongestMatchContinuousRC34_() {
  const context = createParserTestContext_(['Bacardi 8', 'Bacardi 10', 'Osco 2 years old']);
  const result = parseInventoryText('Bacardi 8 0,987 Bacardi 10 1,123 Osco 2 years old 22', context);
  ip34Assert_(result.length === 3, 'Oczekiwano 3 pozycji, są: ' + result.length);
  ip34Assert_(Number(result[0].value) === 0.987, 'Bacardi 8: zła wartość');
  ip34Assert_(Number(result[1].value) === 1.123, 'Bacardi 10: zła wartość');
  ip34Assert_(Number(result[2].value) === 22, 'Osco: zła wartość');
}

function testLongestMatchNewlineRC34_() {
  const context = createParserTestContext_(['Bacardi 8', 'Osco 2 years old']);
  const result = parseInventoryText('Bacardi 8 0,987\nOsco 2 years old 22', context);
  ip34Assert_(result.length === 2, 'Enter powinien dać 2 pozycje');
}

function testLongestMatchZeroRC34_() {
  const context = createParserTestContext_(['Amaro Lucano 1L', 'Amaro Lucano 0% 0,7L']);
  context.catalog[1].aliases = ['amaro lucano zero', 'lucano zero'];
  delete context.__ip34Prepared;
  const result = parseInventoryText('lucano zero 1,234', context);
  ip34Assert_(result.length === 1, 'Oczekiwano 1 pozycji');
  ip34Assert_(normalizeText(result[0].product) === normalizeText('Amaro Lucano 0% 0,7L'), 'Wariant zero rozpoznany błędnie');
  ip34Assert_(Number(result[0].value) === 1.234, 'Zła wartość wariantu zero');
}

function ip34Assert_(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}
