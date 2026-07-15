/**
 * Inventory PRO Enterprise v2.1.3 Recovery
 */

function runEnterpriseHealthCheck() {
  const startedAt = Date.now();
  const validation = buildValidationReport_();
  const testReport = runEnterpriseTestsSilently_();

  let catalogSummary = null;
  let score = 100;
  const issues = [];

  try {
    catalogSummary = getProductCatalogSummary();
  } catch (error) {
    score -= 25;
    issues.push(
      'Nie udalo sie zbudowac katalogu.'
    );
  }

  score -= validation.errors.length * 15;
  score -= validation.warnings.length * 5;
  score -= testReport.failed * 10;
  score = Math.max(0, Math.min(100, score));

  const status =
    score >= 90
      ? 'HEALTHY'
      : score >= 70
        ? 'WARNING'
        : 'CRITICAL';

  const result = {
    version: CONFIG.VERSION,
    status: status,
    score: score,
    tests: {
      total: testReport.total,
      passed: testReport.passed,
      failed: testReport.failed
    },
    validation: {
      errors: validation.errors.length,
      warnings: validation.warnings.length
    },
    catalog: catalogSummary,
    issues: issues,
    durationMs: Date.now() - startedAt
  };

  logInfo(
    'HealthCheck',
    'runEnterpriseHealthCheck',
    'Health Check: ' + status,
    result,
    result.durationMs
  );

  SpreadsheetApp.getUi().alert(
    'Inventory PRO - Health Check',
    formatHealthCheck_(result),
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return result;
}

function runEnterpriseTestsSilently_() {
  const tests = [
    testNormalizeText_,
    testNumberParser_,
    testCompoundNumberParser_,
    testHalfNumberParser_,
    testContinuousParser_,
    testParserPunctuation_,
    testParserLocations_,
    testAliasLoader_,
    testProductCatalog_,
    testExactMatcher_,
    testBusinessHistorySheet_,
    testReportSheet_,
    testValidationReport_,
    testQualityWarning_,
    testAliasSuggestionCollection_
  ];

  const results = tests.map(runSingleTest_);

  return {
    total: results.length,
    passed: results.filter(
      result => result.passed
    ).length,
    failed: results.filter(
      result => !result.passed
    ).length,
    results: results
  };
}

function formatHealthCheck_(result) {
  let message =
    'Status: ' + result.status + '\n' +
    'Application Health: ' +
      result.score + '%\n\n' +
    'Testy PASS: ' +
      result.tests.passed +
      '/' +
      result.tests.total +
      '\n' +
    'Bledy konfiguracji: ' +
      result.validation.errors +
      '\n' +
    'Ostrzezenia: ' +
      result.validation.warnings +
      '\n';

  if (result.catalog) {
    message +=
      '\nProdukty: ' +
      result.catalog.products +
      '\n' +
      'Aliasy: ' +
      result.catalog.aliases +
      '\n' +
      'NORMAL: ' +
      result.catalog.normal +
      '\n' +
      'KEG: ' +
      result.catalog.keg +
      '\n' +
      'LOCATION: ' +
      result.catalog.location +
      '\n' +
      'Brak wiersza: ' +
      result.catalog.missingInventoryRow;
  }

  return message;
}
