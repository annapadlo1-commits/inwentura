/**
 * Inventory PRO Enterprise v2.1.3 Recovery
 */

function renderInventoryTemplate_(fileName) {
  return HtmlService.createTemplateFromFile(fileName).evaluate();
}

function includeInventoryUiTheme_() {
  return HtmlService.createHtmlOutputFromFile('UI_Theme').getContent();
}

function showImport() {
  // v2.10.1: ImportDialog nie uzywa skryptletow. Ladowanie jako statyczny HTML
  // eliminuje ryzyko wstrzykniecia zawartosci pliku testowego do interfejsu.
  const html = HtmlService.createHtmlOutputFromFile('UI_Import')
    .setWidth(1120)
    .setHeight(820);

  SpreadsheetApp.getUi().showModalDialog(
    html,
    'Inventory PRO - Import'
  );
}

/**
 * v2.10.2 — bezpieczne renderowanie widoków po migracji nazw plikow.
 * Preferowane nazwy HTML: Dashboard oraz Analytics.
 * Obslugiwane sa rowniez reczne nazwy Dashboards / AnalyticsView.
 */
function renderInventoryViewWithFallback_(preferredName, fallbackNames) {
  const canonical = {
    Dashboard: 'UI_Dashboard',
    Analytics: 'UI_Analytics',
    UI_Dashboard: 'UI_Dashboard',
    UI_Analytics: 'UI_Analytics'
  };
  return renderInventoryTemplate_(canonical[preferredName] || preferredName);
}
