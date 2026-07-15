# Inventory PRO 4.0

## Parser

- ujednolicono publiczne API Parsera;
- usunięto niedokończone implementacje równoległe;
- rozdzielono dokładne frazy katalogowe od agresywnych wariantów technicznych;
- dodano bezpieczną obsługę skróconych markerów wieku;
- dopasowanie zwraca kanoniczną nazwę produktu z katalogu;
- poprawiono testy nazw numerycznych i testy niezależne od danych arkusza.

## Import i dane

- naprawiono walidację wartości w UI;
- naprawiono blokowanie zapisu i status nowego produktu;
- dodano rollback kolumn inwentury przy błędzie dalszej części zapisu;
- naprawiono źródło danych dla funkcji cofania importu;
- dodano automatyczne unieważnianie cache po ręcznej zmianie SŁOWNIKA.

## Wydanie

- wersja aplikacji: `4.0.0`;
- poprawna nazwa manifestu: `appsscript.json`;
- jeden manifest plików i nowe sumy SHA-256.

