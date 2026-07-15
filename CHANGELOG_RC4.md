# Changelog — 3.0.0 RC4

## Parser Engine
- usunięto nakładające się implementacje RC3.2–RC3.4;
- nowy jednolity silnik longest-match;
- indeksowanie fraz po pierwszym tokenie;
- twarde granice wierszy bez obowiązku używania Entera;
- ochrona wariantów liczbowych i wieku;
- bezpieczny fallback dla nierozpoznanych produktów;
- brak fałszywych rekordów z tokenów `years`, `old`, `yo`.

## UX i przepływ
- finalizacja pokazuje czytelne ostrzeżenie o wyczyszczeniu danych;
- przycisk zapisu korekt jest widoczny tylko po edycji;
- historia eksportów jest częścią Historii zdarzeń;
- stare zakładki dublujące dane są ukrywane.

## Dane i raportowanie
- KAWA zawsze korzysta z kolumny wagowej;
- liczby raportowe do 3 miejsc po przecinku;
- ARCHIWUM pozostaje jedyną wewnętrzną kopią zakończonej inwentury;
- brak nowych zakładek FINAL.
