/**
 * Inventory PRO Enterprise v2.1.3 Recovery
 */

function renderInventoryTemplate_(fileName) {
  return HtmlService.createTemplateFromFile(fileName).evaluate();
}

function includeInventoryUiTheme_() {
  return HtmlService.createHtmlOutputFromFile('UI_Theme').getContent();
}

function includeInventoryHelp_() {
  return HtmlService.createHtmlOutputFromFile('UI_Help').getContent();
}

function showImport() {
  const html = renderInventoryTemplate_('UI_Import')
    .setWidth(1320)
    .setHeight(900);

  SpreadsheetApp.getUi().showModalDialog(
    html,
    'Inventory PRO - Import'
  );
}

function showParserDiagnostics() {
  const html = renderInventoryTemplate_('UI_ParserDiagnostics')
    .setWidth(1180)
    .setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(html, 'Inventory PRO — Diagnostyka Parsera');
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