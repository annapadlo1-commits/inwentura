# Commit 003 — Parser 3.1 state-machine foundation

## Commit message

`refactor(parser): introduce replacement state-machine core in shadow mode`

## Scope

- adds Parser 3.1 state registry and isolated session;
- adds lossless tokenizer with hard newline boundaries;
- adds explicit transition diagnostics;
- prevents numeric candidates from being classified as quantities at the
  tokenizer/state-foundation level;
- adds a shadow comparison API against the legacy parser;
- adds five foundation tests;
- keeps the legacy parser as the production engine.

## Why shadow mode

The current production suite still exposes three pre-existing parser failures.
Activating an incomplete replacement core would make the application less safe.
This commit therefore creates the new core and migration gate without changing
what Import writes to the sheet.

## Files

- `20_ParserStateMachine.gs`
- `20_ParserPipeline.gs`
- `67_ParserStateMachineTests.gs`
- `docs/PARSER_31_STATE_MACHINE.md`
- `COMMIT_003.md`
