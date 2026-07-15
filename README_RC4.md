# Inventory PRO 3.0 RC4 — pełna paczka PAWILONY

To jest pełny projekt, nie patch. W projekcie Apps Script należy zastąpić komplet plików `.gs` i `.html` zawartością tej paczki. Nie należy łączyć starego `20_Parser.gs` z nowym ani zostawiać dodatkowych plików parsera/hotfixów.

## Najważniejsze zmiany

- jeden kompletny `20_Parser.gs`, bez równoległych implementacji i fragmentów RC3.4;
- dictionary-first + longest-match;
- Enter jest twardą granicą, ale nie jest wymagany;
- wartości przed i po produkcie;
- ochrona cyfr, wieku i pojemności w nazwach;
- `Osco 2 years old 22` jest jedną pozycją;
- `Bacardi 8 0,987 Bacardi 10 1,123` działa w jednym ciągu;
- indeks produktów/aliasów jest budowany raz na analizę;
- KAWA jest zapisywana do kolumny wagowej również dla liczby całkowitej;
- ręczna zmiana w imporcie udostępnia pole „Zapamiętaj”;
- filtry aktywnych błędów, wyborów, duplikatów i korekt ręcznych;
- kompaktowanie aliasów w SŁOWNIKU;
- Historia przechowuje zdarzenia, a szczegóły importów trafiają do Audytu importów;
- nie są tworzone arkusze FINAL;
- zostaje jedno ARCHIWUM na zakończoną inwentaryzację;
- stara „Historia eksportow” i stare FINAL są ukrywane przez setup;
- końcowe wartości raportowe są zaokrąglane do maks. 3 miejsc;
- własne ostrzeżenie przed wyczyszczeniem bieżącej inwentury;
- „Zapisz poprawki” pojawia się dopiero po rzeczywistej edycji.

## Instalacja

1. Zrób kopię arkusza i projektu Apps Script.
2. Usuń z projektu wszystkie obecne pliki `.gs` i `.html`, szczególnie dodatkowe pliki parsera/hotfixów.
3. Utwórz pliki dokładnie według nazw w tej paczce i wklej ich pełną zawartość.
4. Zachowaj manifest projektu z pliku `appsscript.gs` zgodnie z dotychczasowym sposobem importu projektu.
5. Zapisz projekt i uruchom `enterpriseSetup()`.
6. Odśwież arkusz.
7. Uruchom `runAllEnterpriseTests()`.
8. Dopiero po wyniku PASS wykonaj próbny import w kopii arkusza.

## Obowiązkowe testy ręczne

- `Osco 2 years old 22`
- `Bacardi 8 0,987 Bacardi 10 1,123`
- `Jameson 12 Auchentoshan 12 1,234`
- `1,407 Ardbeg 10`
- `amaro lucano zero 1,234`
- `żubrówka bison grass pół litra 1,234`
- tekst z Enterami i ten sam tekst w jednym ciągu;
- `kawa czarna fala 25` — zapis do kolumny wagowej B;
- ręczne „Zmień” i zaznaczenie „Zapamiętaj”;
- filtr „Aktywne błędy”;
- zakończenie inwentury: ARCHIWUM + XLSX/PDF + wyczyszczenie po potwierdzeniu.

## Walidacja wykonana przed spakowaniem

- statyczna kontrola składni wszystkich plików `.gs`;
- kontrola braku zduplikowanych globalnych funkcji `.gs`;
- izolowane testy parsera dla tekstu ciągłego, longest-match, nazw z cyframi, wartości przed produktem, lokalizacji i Enterów;
- test integralności archiwum ZIP.

Pełne testy wymagające `SpreadsheetApp`, `DriveApp` i danych arkusza muszą zostać uruchomione w Google Apps Script.
