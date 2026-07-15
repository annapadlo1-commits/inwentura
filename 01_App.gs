function onOpen() {
  const ui = SpreadsheetApp.getUi();

  const reportingMenu = ui.createMenu('Raportowanie')
    .addItem('Raport bieżącej inwentaryzacji', 'showReport')
    .addItem('Dashboard managera', 'showInventoryDashboard')
    .addItem('Porównanie inwentaryzacji', 'showInventoryAnalytics')
    .addItem('Excel PRO i PDF', 'showFinalReview');

  const catalogMenu = ui.createMenu('Produkty i aliasy')
    .addItem('Product Manager', 'showProductManager')
    .addItem('Alias Manager', 'showAliasManager')
    .addItem('Nowe produkty', 'showNewProductsSheet_')
    .addItem('Audyt katalogu', 'runProductDataAudit');

  const adminMenu = ui.createMenu('Administracja')
    .addItem('Health Check', 'runEnterpriseHealthCheck')
    .addItem('Uruchom wszystkie testy', 'runAllEnterpriseTests')
    .addItem('Testy raportowania', 'runReportingEngineTests')
    .addItem('Waliduj konfigurację', 'validateEnterpriseConfiguration')
    .addItem('Pokaż diagnostykę', 'showEnterpriseDiagnostics')
    .addSeparator()
    .addItem('Wyczyść cache katalogu', 'clearProductCatalogCache')
    .addItem('Audyt danych produktów', 'runProductDataAudit')
    .addItem('Napraw dane produktów', 'repairProductData')
    .addItem('Odbuduj konfigurację SŁOWNIKA', 'rebuildDictionaryConfigurationSafely')
    .addItem('Napraw kategorie na podstawie INWENTURA', 'repairInvalidDictionaryCategories290WithDialog')
    .addSeparator()
    .addItem('Pełny widok techniczny', 'showManagerWorkspace')
    .addItem('Wyczyść log techniczny', 'clearTechnicalLog');

  ui.createMenu('INVENTORY PRO')
    .addItem('🍕 Import', 'showImport')
    .addItem('🍕 Rozpocznij / zakończ inwentaryzację', 'startNewInventory')
    .addItem('🍕 Wyczyść bieżącą inwenturę', 'clearCurrentInventory')
    .addSeparator()
    .addItem('Cofnij ostatni import', 'undoLastImport')
    .addSeparator()
    .addSubMenu(reportingMenu)
    .addSubMenu(catalogMenu)
    .addItem('Historia', 'showHistory')
    .addItem('Ustawienia', 'showSettings')
    .addSeparator()
    .addItem('Widok użytkownika', 'showUserWorkspace')
    .addItem('Widok managera', 'showManagerWorkspace')
    .addSubMenu(adminMenu)
    .addSeparator()
    .addItem('🍕 O aplikacji', 'showAbout')
    .addToUi();

  logInfo('App', 'onOpen', 'Menu Production Edition zostało utworzone', {
    version: CONFIG.VERSION,
    location: CONFIG.LOCATION.NAME
  });
}

/**
 * Ręczna zmiana SŁOWNIKA lub nazw produktów w INWENTURZE musi od razu
 * unieważnić katalog. Bez tego Parser może pracować na danych sprzed 6 godzin.
 */
function onEdit(event) {
  try {
    const range = event && event.range;
    const sheet = range && range.getSheet();
    if (!sheet) return;
    const name = normalizeText(sheet.getName());
    if (
      name === normalizeText(CONFIG.SHEETS.DICTIONARY) ||
      (name === normalizeText(CONFIG.SHEETS.INVENTORY) && range.getColumn() === 1)
    ) {
      invalidateProductCatalogCache_();
    }
  } catch (error) {
    console.error('Inventory PRO onEdit cache invalidation: ' + String(error));
  }
}

function showNewProductsSheet_() {
  activateSheetByName_(CONFIG.SHEETS.NEW_PRODUCTS);
}

function showReport() {
  activateSheetByName_(CONFIG.SHEETS.REPORT);
}

function showHistory() {
  activateSheetByName_(CONFIG.SHEETS.HISTORY);
}


function showExportHistory() { showHistory(); }

function showSettings() {
  ensureQualitySettingsSheet_();
  activateSheetByName_(CONFIG.SHEETS.SETTINGS);
}

function activateSheetByName_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    const message = 'Nie znaleziono arkusza: ' + sheetName;

    logWarning(
      'Code',
      'activateSheetByName_',
      message,
      { sheetName }
    );

    SpreadsheetApp.getUi().alert(message);
    return;
  }

  spreadsheet.setActiveSheet(sheet);
}

function showAbout() {
  const html = renderInventoryTemplate_('UI_About')
    .setWidth(520)
    .setHeight(620);

  SpreadsheetApp.getUi().showModalDialog(
    html,
    'O aplikacji'
  );
}


function debugProductConfiguration() {
  return runSafely_(
    'Code',
    'debugProductConfiguration',
    function() {
      const products = loadProductConfigurations();
      const aliases = loadAliases();

      SpreadsheetApp.getUi().alert(
        'Inventory PRO - Debug\n\n' +
        'Aktywne produkty: ' + products.length + '\n' +
        'Aliasy: ' + Object.keys(aliases).length
      );
    },
    'Nie udalo sie sprawdzic konfiguracji.'
  );
}

function debugProductCatalog() {
  return runSafely_(
    'Code',
    'debugProductCatalog',
    function() {
      const summary = getProductCatalogSummary();

      SpreadsheetApp.getUi().alert(
        'Inventory PRO - Product Engine\n\n' +
        'Produkty: ' + summary.products + '\n' +
        'Aliasy: ' + summary.aliases + '\n' +
        'NORMAL: ' + summary.normal + '\n' +
        'KEG: ' + summary.keg + '\n' +
        'LOCATION: ' + summary.location + '\n' +
        'Brak wiersza w Inwentura: ' +
        summary.missingInventoryRow
      );
    },
    'Nie udalo sie zbudowac statystyk katalogu.'
  );
}

function debugSmartMatch() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Inventory PRO - Smart Match',
    'Wpisz nazwe produktu do przetestowania:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  return runSafely_(
    'Code',
    'debugSmartMatch',
    function() {
      const inputName = response.getResponseText();
      const result = matchProduct(inputName);

      let message =
        'Wpis: ' + inputName + '\n' +
        'Status: ' + result.status + '\n' +
        'Informacja: ' + result.message + '\n\n';

      if (result.product) {
        message +=
          'Wybrany produkt:\n' +
          result.product.name + '\n\n' +
          'Typ: ' + result.product.type + '\n' +
          'Kategoria: ' + result.product.category + '\n' +
          'Wiersz: ' +
          (result.product.inventoryRow || 'BRAK') +
          '\n' +
          'Wynik: ' + result.score;
      }

      if (
        !result.product &&
        result.candidates &&
        result.candidates.length
      ) {
        message += 'Mozliwe produkty:\n';

        result.candidates.forEach((candidate, index) => {
          message +=
            (index + 1) + '. ' +
            candidate.product.name +
            ' (' + candidate.score + ' pkt)\n';
        });
      }

      ui.alert('Wynik dopasowania', message, ui.ButtonSet.OK);
    },
    'Nie udalo sie wykonac testu Smart Match.'
  );
}
