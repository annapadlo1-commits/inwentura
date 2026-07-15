# Commit 002 — Parser Pipeline Architecture

**Proposed commit message**

`refactor(parser): introduce pipeline architecture without behavior change`

## Scope

- adds one public parser entry point owned by `20_ParserPipeline.gs`;
- renames the previous implementation to `parseInventoryTextLegacy_`;
- introduces `ParserContext` as the stable dependency boundary;
- documents eight parser stages and ownership rules;
- adds parity tests proving the pipeline delegates without changing output.

## Deliberately unchanged

- ZERO and 0% behaviour;
- continuous input and Enter boundaries;
- numeric product names;
- alias matching;
- location handling;
- Smart Review result model;
- import and writer behaviour.

## Verification

Run in this order:

1. `runParserPipelineArchitectureTests()`
2. `runParserContractTests()`
3. `runAllEnterpriseTests()`
