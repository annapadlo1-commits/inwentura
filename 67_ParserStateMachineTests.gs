/**
 * Foundation tests for Parser 3.1 state machine (Commit 003).
 * They verify invariants only. Business-result parity is intentionally deferred
 * until resolver stages are migrated.
 */
function runParser31FoundationTests() {
  const startedAt = Date.now();
  const tests = [
    parser31StateRegistryTest_,
    parser31HardBoundaryTest_,
    parser31LosslessTokenizationTest_,
    parser31NumericNameSafetyTest_,
    parser31ShadowModeTest_
  ];

  const results = tests.map(function(testFunction) {
    const testStartedAt = Date.now();
    try {
      testFunction();
      return { name: testFunction.name, passed: true, durationMs: Date.now() - testStartedAt, message: 'PASS' };
    } catch (error) {
      return { name: testFunction.name, passed: false, durationMs: Date.now() - testStartedAt, message: normalizeError_(error).message };
    }
  });

  const passed = results.filter(function(result) { return result.passed; }).length;
  const report = {
    total: results.length,
    passed: passed,
    failed: results.length - passed,
    durationMs: Date.now() - startedAt,
    results: results
  };

  logInfo('Parser31Tests', 'runParser31FoundationTests', report.failed === 0 ? 'Parser 3.1 foundation PASS' : 'Parser 3.1 foundation FAIL', report, report.durationMs);
  SpreadsheetApp.getUi().alert('Inventory PRO — Parser 3.1', formatTestReport_(report), SpreadsheetApp.getUi().ButtonSet.OK);
  return report;
}

function parser31StateRegistryTest_() {
  const expected = ['WAIT_PRODUCT', 'READ_PRODUCT', 'WAIT_VALUE', 'READ_VALUE', 'WAIT_LOCATION', 'END_ENTRY'];
  expected.forEach(function(stateName) {
    assertCondition_(PARSER31_STATE_[stateName] === stateName, 'Brak stanu: ' + stateName);
  });
}

function parser31HardBoundaryTest_() {
  const execution = executeParser31StateMachine_('Bacardi 8 0,987\nAuchentoshan 12 1,234', createParserContext_(createParserTestContext_(['Bacardi 8', 'Auchentoshan 12'])));
  assertCondition_(execution.lineCount === 2, 'Enter nie zostal zachowany jako twarda granica.');
  const boundaries = execution.diagnostics.filter(function(item) { return item.reason === 'hard-line-boundary'; });
  assertCondition_(boundaries.length === 2, 'Nie zamknieto obu wierszy.');
}

function parser31LosslessTokenizationTest_() {
  const lines = tokenizeParser31Input_('amaro lucano zero 1,234');
  assertCondition_(lines.length === 1, 'Nieprawidlowa liczba wierszy.');
  assertCondition_(lines[0].tokens.map(function(token) { return token.original; }).join(' ') === 'amaro lucano zero 1,234', 'Tokenizacja utracila tekst wejsciowy.');
}

function parser31NumericNameSafetyTest_() {
  const execution = executeParser31StateMachine_('Bacardi 8 0,987 Bacardi 10 1,123', createParserContext_(createParserTestContext_(['Bacardi 8', 'Bacardi 10'])));
  const unresolved = execution.diagnostics.filter(function(item) { return item.type === 'UNRESOLVED_ENTRY'; });
  assertCondition_(unresolved.length === 1, 'Foundation nie powinna jeszcze segmentowac wyniku.');
  assertCondition_(unresolved[0].productCandidate.indexOf('Bacardi 8') >= 0, 'Cyfra z nazwy zostala odrzucona.');
  assertCondition_(unresolved[0].productCandidate.indexOf('Bacardi 10') >= 0, 'Druga nazwa z cyfra zostala odrzucona.');
}

function parser31ShadowModeTest_() {
  const runtime = createParserTestContext_(['Campari 0,7 l']);
  const comparison = compareParser31WithLegacy_('Campari 1,239', runtime);
  assertCondition_(Array.isArray(comparison.legacy), 'Brak wyniku legacy.');
  assertCondition_(comparison.parser31 && Array.isArray(comparison.parser31.diagnostics), 'Brak wyniku shadow engine.');
  assertCondition_(comparison.productionEngine === 'parseInventoryTextLegacy_', 'Nowy rdzen zostal wlaczony produkcyjnie za wczesnie.');
}
