/** Inventory PRO v2.3 - szybka diagnostyka silnika rozpoznawania. */
function debugRecognitionEngine() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Diagnostyka rozpoznawania', 'Wpisz sama nazwe produktu (bez ilosci):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const result = matchProduct(response.getResponseText(), buildRuntimeContext_());
  const candidates = (result.candidates || []).slice(0, 8).map(c => c.product.name + ' (' + Math.round(c.score) + '%)').join('\n');
  ui.alert('Wynik: ' + result.status, 'Pewnosc: ' + (result.score || 0) + '%\nProdukt: ' + (result.product ? result.product.name : '-') + '\n\nKandydaci:\n' + (candidates || '-'), ui.ButtonSet.OK);
}
