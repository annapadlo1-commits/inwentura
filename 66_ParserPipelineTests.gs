/**
 * Architectural tests for Parser Pipeline Commit 002.
 * These tests verify that introducing the pipeline seam does not change the
 * result produced by the existing parser engine.
 */
function runParserPipelineArchitectureTests() {
  const startedAt = Date.now();
  const tests = [
    parserPipelinePublicApiTest_,
    parserPipelineContextIdentityTest_,
    parserPipelineBehaviorParityTest_,
    parserPipelineStageRegistryTest_
  ];

  const results = tests.map(function(testFunction) {
    const testStartedAt = Date.now();
    try {
      testFunction();
      return {
        name: testFunction.name,
        passed: true,
        durationMs: Date.now() - testStartedAt,
        message: 'PASS'
      };
    } catch (error) {
      return {
        name: testFunction.name,
        passed: false,
        durationMs: Date.now() - testStartedAt,
        message: normalizeError_(error).message
      };
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

  logInfo(
    'ParserPipelineTests',
    'runParserPipelineArchitectureTests',
    report.failed === 0 ? 'Parser Pipeline architecture PASS' : 'Parser Pipeline architecture FAIL',
    report,
    report.durationMs
  );

  SpreadsheetApp.getUi().alert(
    'Inventory PRO — Parser Pipeline',
    formatTestReport_(report),
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return report;
}

function parserPipelinePublicApiTest_() {
  assertCondition_(typeof parseInventoryText === 'function', 'Brak publicznego parseInventoryText.');
  assertCondition_(typeof parseInventoryTextLegacy_ === 'function', 'Brak silnika delegowanego.');
  assertCondition_(typeof executeParserPipeline_ === 'function', 'Brak executeParserPipeline_.');
}

function parserPipelineContextIdentityTest_() {
  const runtime = createParserTestContext_(['Campari 0,7 l']);
  const parserContext = createParserContext_(runtime);
  assertCondition_(parserContext.runtime === runtime, 'Pipeline zmienil obiekt runtime context.');
  assertCondition_(parserContext.contractVersion === '1.0', 'Nieprawidlowa wersja kontraktu.');
}

function parserPipelineBehaviorParityTest_() {
  const cases = [
    {
      products: ['Bacardi 8', 'Bacardi 10'],
      input: 'Bacardi 8 0,987 Bacardi 10 1,123'
    },
    {
      products: ['Campari 0,7 l', 'Bacardi 8'],
      input: 'Campari 1,239\nBacardi 8 0,987'
    },
    {
      products: ['Osco', 'Osco 2 years old'],
      input: 'Osco 2 years old 22'
    }
  ];

  cases.forEach(function(testCase) {
    const publicContext = createParserTestContext_(testCase.products);
    const legacyContext = createParserTestContext_(testCase.products);
    const publicResult = parseInventoryText(testCase.input, publicContext);
    const legacyResult = parseInventoryTextLegacy_(testCase.input, legacyContext);
    assertCondition_(
      JSON.stringify(publicResult) === JSON.stringify(legacyResult),
      'Pipeline zmienil wynik dla: ' + testCase.input + '\nPUBLIC: ' +
        JSON.stringify(publicResult) + '\nLEGACY: ' + JSON.stringify(legacyResult)
    );
  });
}

function parserPipelineStageRegistryTest_() {
  const stages = getParserPipelineStages_();
  const expected = ['boundary', 'tokenize', 'recognize', 'match', 'quantity', 'location', 'validate', 'result'];
  assertCondition_(stages.length === expected.length, 'Nieprawidlowa liczba etapow pipeline.');
  expected.forEach(function(stageId, index) {
    assertCondition_(stages[index].id === stageId, 'Brak lub zla kolejnosc etapu: ' + stageId);
  });
}
