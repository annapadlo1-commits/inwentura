# Inventory PRO 3.0 RC4.1 — Full package

Pełna paczka zastępująca RC4.

## Zmiana RC4.1
Naprawiono ostatni test `testContinuousParser_`. Parser zwraca poprawnie dwie pozycje, ale zgodnie z kontraktem używa znormalizowanych nazw rozpoznawczych (`martini bitter`, `godet vsop`). Test błędnie porównywał wielkość liter zamiast sprawdzać rzeczywiste rozdzielenie produktów.

Nie zmieniono logiki produkcyjnego parsera.

## Oczekiwany wynik
`34 PASS / 0 FAIL`
