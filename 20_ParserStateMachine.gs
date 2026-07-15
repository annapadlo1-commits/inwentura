/**
 * Inventory PRO — Parser 3.1 state-machine core.
 *
 * Commit 003 introduces the replacement parser core in SHADOW mode.
 * Production output still comes from parseInventoryTextLegacy_. The new core
 * can be executed independently and compared against the legacy engine before
 * it becomes authoritative in a later commit.
 */

const PARSER31_STATE_ = Object.freeze({
  WAIT_PRODUCT: 'WAIT_PRODUCT',
  READ_PRODUCT: 'READ_PRODUCT',
  WAIT_VALUE: 'WAIT_VALUE',
  READ_VALUE: 'READ_VALUE',
  WAIT_LOCATION: 'WAIT_LOCATION',
  END_ENTRY: 'END_ENTRY'
});

/**
 * Creates an isolated state-machine session. No Spreadsheet service is called
 * here; all catalog data is supplied through ParserContext.
 *
 * @param {string} inputText
 * @param {Object} parserContext
 * @return {Object}
 */
function createParser31Session_(inputText, parserContext) {
  const context = parserContext || createParserContext_();
  return {
    inputText: String(inputText || ''),
    context: context,
    lines: tokenizeParser31Input_(inputText),
    state: PARSER31_STATE_.WAIT_PRODUCT,
    currentLocation: '',
    currentEntry: createEmptyParser31Entry_(),
    results: [],
    diagnostics: [],
    lineIndex: 0,
    tokenIndex: 0
  };
}

function createEmptyParser31Entry_() {
  return {
    productTokens: [],
    valueToken: null,
    location: '',
    startTokenIndex: -1,
    endTokenIndex: -1
  };
}

/**
 * Tokenizes text while preserving hard newline boundaries. Tokenization is
 * deliberately lossless: original spelling and separators remain available
 * for diagnostics and result reconstruction.
 *
 * @param {string} inputText
 * @return {Array<Object>}
 */
function tokenizeParser31Input_(inputText) {
  const raw = String(inputText || '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return [];

  return raw.split('\n').map(function(line, lineIndex) {
    const originalLine = String(line || '').trim();
    const preparedLine = prepareParserText_(originalLine);
    const rawTokens = preparedLine ? preparedLine.split(/\s+/).filter(Boolean) : [];
    return {
      lineIndex: lineIndex,
      original: originalLine,
      prepared: preparedLine,
      tokens: rawTokens.map(function(token, tokenIndex) {
        return classifyParser31Token_(token, lineIndex, tokenIndex);
      })
    };
  }).filter(function(lineRecord) {
    return lineRecord.tokens.length > 0;
  });
}

function classifyParser31Token_(token, lineIndex, tokenIndex) {
  const normalized = normalizeWordForParser_(token);
  const number = readNumberAt_([token], 0);
  return {
    original: token,
    normalized: normalized,
    lineIndex: lineIndex,
    tokenIndex: tokenIndex,
    kind: number ? 'NUMBER_CANDIDATE' : 'WORD',
    numericValue: number ? number.value : null
  };
}

/**
 * Executes the replacement core. Commit 003 intentionally supports only the
 * state transitions and hard-boundary model. Resolution stages are explicit
 * extension points and are not yet used as production output.
 *
 * @param {string} inputText
 * @param {Object=} parserContext
 * @return {Object}
 */
function executeParser31StateMachine_(inputText, parserContext) {
  const session = createParser31Session_(inputText, parserContext);

  session.lines.forEach(function(lineRecord) {
    resetParser31LineState_(session, lineRecord);
    lineRecord.tokens.forEach(function(tokenRecord) {
      consumeParser31Token_(session, tokenRecord);
    });
    closeParser31Line_(session, lineRecord);
  });

  return {
    results: session.results,
    diagnostics: session.diagnostics,
    finalState: session.state,
    lineCount: session.lines.length
  };
}

function resetParser31LineState_(session, lineRecord) {
  session.lineIndex = lineRecord.lineIndex;
  session.tokenIndex = 0;
  session.state = PARSER31_STATE_.WAIT_PRODUCT;
  session.currentEntry = createEmptyParser31Entry_();
}

function consumeParser31Token_(session, tokenRecord) {
  session.tokenIndex = tokenRecord.tokenIndex;

  switch (session.state) {
    case PARSER31_STATE_.WAIT_PRODUCT:
      session.currentEntry.startTokenIndex = tokenRecord.tokenIndex;
      session.currentEntry.productTokens.push(tokenRecord);
      transitionParser31_(session, PARSER31_STATE_.READ_PRODUCT, tokenRecord, 'product-start');
      break;

    case PARSER31_STATE_.READ_PRODUCT:
      // Numeric candidates are NOT immediately treated as quantities. This is
      // the core invariant needed for Bacardi 8, Auchentoshan 12 and 0% names.
      session.currentEntry.productTokens.push(tokenRecord);
      transitionParser31_(session, PARSER31_STATE_.READ_PRODUCT, tokenRecord, 'product-continue');
      break;

    default:
      session.diagnostics.push({
        type: 'UNHANDLED_STATE',
        state: session.state,
        token: tokenRecord.original,
        lineIndex: tokenRecord.lineIndex
      });
  }
}

function closeParser31Line_(session, lineRecord) {
  if (session.currentEntry.productTokens.length > 0) {
    session.currentEntry.endTokenIndex = lineRecord.tokens.length - 1;
    session.diagnostics.push({
      type: 'UNRESOLVED_ENTRY',
      lineIndex: lineRecord.lineIndex,
      original: lineRecord.original,
      productCandidate: session.currentEntry.productTokens.map(function(token) {
        return token.original;
      }).join(' ')
    });
  }

  // A newline is always a hard boundary. State and partial entry never leak.
  transitionParser31_(session, PARSER31_STATE_.END_ENTRY, null, 'hard-line-boundary');
}

function transitionParser31_(session, nextState, tokenRecord, reason) {
  session.diagnostics.push({
    type: 'STATE_TRANSITION',
    from: session.state,
    to: nextState,
    reason: reason,
    token: tokenRecord ? tokenRecord.original : '',
    lineIndex: tokenRecord ? tokenRecord.lineIndex : session.lineIndex,
    tokenIndex: tokenRecord ? tokenRecord.tokenIndex : session.tokenIndex
  });
  session.state = nextState;
}

/**
 * Runs both engines for diagnostics without changing application behaviour.
 * This is the migration gate used by tests and future telemetry.
 *
 * @param {string} inputText
 * @param {Object=} runtimeContext
 * @return {Object}
 */
function compareParser31WithLegacy_(inputText, runtimeContext) {
  const parserContext = createParserContext_(runtimeContext);
  return {
    legacy: parseInventoryTextLegacy_(inputText, parserContext.runtime),
    parser31: executeParser31StateMachine_(inputText, parserContext),
    productionEngine: 'parseInventoryTextLegacy_',
    shadowEngine: 'executeParser31StateMachine_'
  };
}
