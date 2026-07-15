/**
 * Inventory PRO — Parser Pipeline seam.
 *
 * Commit 002 introduces a single public entry point and an explicit parser
 * context without changing production parsing behaviour. The current engine
 * remains in parseInventoryTextLegacy_ until individual stages are migrated
 * behind this pipeline in later commits.
 */

/**
 * Public parser API used by Import Engine, tests and diagnostics.
 *
 * @param {string} inputText Raw dictated or pasted inventory text.
 * @param {Object=} runtimeContext Existing runtime context, when supplied.
 * @return {Array<Object>} Parsed inventory items.
 */
function parseInventoryText(inputText, runtimeContext) {
  return executeParserPipeline_(inputText, createParserContext_(runtimeContext));
}

/**
 * Creates the stable context boundary for all future parser stages.
 * The original runtime context object is preserved exactly, so this commit
 * does not alter indexes, caches or recognition behaviour.
 *
 * @param {Object=} runtimeContext
 * @return {Object}
 */
function createParserContext_(runtimeContext) {
  return {
    runtime: runtimeContext || buildRuntimeContext_(),
    contractVersion: '1.0',
    pipelineVersion: '1.0',
    stages: getParserPipelineStages_()
  };
}

/**
 * Executes the parser pipeline. For now the execution stage delegates to the
 * proven legacy engine. Subsequent commits can migrate one stage at a time
 * while contract tests protect behaviour.
 *
 * @param {string} inputText
 * @param {Object} parserContext
 * @return {Array<Object>}
 */
function executeParserPipeline_(inputText, parserContext) {
  const context = parserContext || createParserContext_();
  return parseInventoryTextLegacy_(inputText, context.runtime);
}

/**
 * Architectural stage registry. It is descriptive in Commit 002 and becomes
 * executable incrementally; keeping it central prevents responsibility from
 * drifting between Parser, Matcher and Recognition Engine.
 *
 * @return {Array<Object>}
 */
function getParserPipelineStages_() {
  return [
    { id: 'boundary', responsibility: 'Preserve hard newline boundaries.' },
    { id: 'tokenize', responsibility: 'Prepare and tokenize input text.' },
    { id: 'recognize', responsibility: 'Resolve exact products and aliases.' },
    { id: 'match', responsibility: 'Choose the best product candidate.' },
    { id: 'quantity', responsibility: 'Resolve value outside product name.' },
    { id: 'location', responsibility: 'Resolve section and inline location.' },
    { id: 'validate', responsibility: 'Build status, errors and warnings.' },
    { id: 'result', responsibility: 'Return the stable parser result model.' }
  ];
}

/**
 * Diagnostics-only description of the active pipeline.
 *
 * @return {Object}
 */
function getParserPipelineInfo() {
  return {
    publicEntryPoint: 'parseInventoryText',
    executionEngine: 'parseInventoryTextLegacy_',
    contractVersion: '1.0',
    pipelineVersion: '1.0',
    behaviorChange: false,
    stages: getParserPipelineStages_()
  };
}
