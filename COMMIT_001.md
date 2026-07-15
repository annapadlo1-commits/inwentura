# Commit 001 — Parser contract baseline

## Cel

Zamrożenie uzgodnionego zachowania parsera przed refaktoryzacją silnika.

## Zmiany

- dodano formalny kontrakt parsera w `docs/PARSER_CONTRACT.md`;
- dodano niezależny zestaw 12 testów kontraktowych w `65_ParserContractTests.gs`;
- dodano publiczny runner `runParserContractTests()`;
- testy obejmują tekst ciągły, Entery, ZERO, zwykłe zero, pojemności, wiek, liczby w nazwach, wartość przed/po produkcie i lokalizacje.

## Celowo nie zmieniono

- produkcyjnej logiki parsera;
- importu i zapisu do arkusza;
- raportowania, historii i eksportu;
- UI.

Ten commit jest punktem odniesienia. Następny commit może refaktoryzować parser tylko wtedy, gdy zachowa pełny PASS kontraktu.
