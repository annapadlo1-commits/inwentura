# Inventory PRO 4.0 — Parser 4.0

Pełna, spójna paczka aplikacji dla lokalizacji PAWILONY. Zastępuje mieszaną paczkę RC3/RC4/Parser 3.1.

## Instalacja

1. Utwórz kopię zapasową arkusza i projektu Apps Script.
2. Usuń z projektu stare pliki `.gs` i `.html`, w szczególności wszystkie dodatkowe pliki Parsera, Pipeline i State Machine.
3. Wgraj komplet plików `.gs` i `.html` z tej paczki.
4. Zawartość `appsscript.json` wklej do manifestu projektu Apps Script.
5. Zapisz projekt i uruchom `enterpriseSetup()`.
6. Odśwież arkusz.
7. Uruchom `runParserContractTests()` oraz `runAllEnterpriseTests()`.
8. W kopii arkusza wykonaj próbny import przed użyciem produkcyjnym.

## Najważniejsze zmiany

- jeden produkcyjny punkt wejścia `parseInventoryText()` w `20_Parser.gs`;
- usunięty niedokończony Pipeline i Parser 3.1 w trybie shadow;
- bezpieczny longest-match dla nazw, aliasów, wieku i liczb w nazwach;
- naprawiony przypadek `Osco 2 years 22`;
- kolizje kluczy katalogowych nie są rozstrzygane kolejnością produktów;
- ręczne zmiany SŁOWNIKA unieważniają cache Parsera;
- poprawiona obsługa wartości z przecinkiem w Smart Review;
- błędne pozycje nie są zaznaczane przez „Zaznacz wszystko”;
- zapis jest blokowany dla `NaN`, wartości ujemnych i nierozwiązanych pozycji;
- cofanie importu korzysta z prawidłowego arkusza `Audyt importow`;
- w przypadku błędu po zapisie kolumn inwentury Writer przywraca poprzednie wartości.

## Testy obowiązkowe

- `Osco 2 years old 22`
- `Osco 2 years 22`
- `Bacardi 8 0,987 Bacardi 10 1,123`
- `Jameson 12 Auchentoshan 12 1,234`
- `1,407 Ardbeg 10`
- `amaro lucano zero 1,234`
- `żubrówka bison grass pół litra 1,234`
- ten sam zestaw z Enterami i w jednym ciągu
- lokalizacje `magazyn`, `darkroom`, `lodówki`
- ręczna korekta wartości `1,25`
- cofnięcie ostatniego próbnego importu

