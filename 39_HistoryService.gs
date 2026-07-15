/** Inventory PRO 3.0 RC3 — historia zdarzeń i osobny log techniczny. */
function getOrCreateBusinessHistorySheet_() {
  const sheet = getOrCreateConfiguredSheet_(CONFIG.SHEETS.HISTORY);
  const headers = [['Timestamp','User','Zdarzenie','Opis','Liczba pozycji','Arkusz / archiwum','XLSX','PDF','ID','Wersja']];
  sheet.getRange(1,1,1,headers[0].length).setValues(headers).setFontWeight('bold').setBackground('#f6b26b');
  sheet.setFrozenRows(1);
  return sheet;
}

function getOrCreateTechnicalHistorySheet_() {
  const sheet = getOrCreateConfiguredSheet_(CONFIG.SHEETS.IMPORT_AUDIT);
  const headers = [['Import ID','Timestamp','User','Original input','Product','Value','Location','Sheet','Row','Column','Previous value','New value','Status','Undone at','Undone by','Version']];
  sheet.getRange(1,1,1,headers[0].length).setValues(headers).setFontWeight('bold').setBackground('#cfe2f3');
  sheet.setFrozenRows(1);
  return sheet;
}

function appendImportHistory_(importId, results) {
  if (!Array.isArray(results) || !results.length) return;
  const tech = getOrCreateTechnicalHistorySheet_();
  const timestamp = new Date();
  const user = getCurrentUserEmail_();
  const rows = results.map(result => [importId,timestamp,user,result.originalInput||'',result.product||'',result.addedValue??'',result.location||'',CONFIG.SHEETS.INVENTORY,result.row||'',result.column||'',result.previousValue??'',result.newValue??'',result.saved?'SAVED':'SKIPPED','','',CONFIG.VERSION]);
  tech.getRange(tech.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
  appendApplicationEvent_('IMPORT','Zapisano import: '+results.filter(r=>r.saved).length+' pozycji',{eventId:importId,itemsCount:results.filter(r=>r.saved).length,sourceSheetName:CONFIG.SHEETS.INVENTORY});
}

function getLastActiveImportId_() {
  const sheet = getOrCreateTechnicalHistorySheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';
  const values = sheet.getRange(2,1,lastRow-1,14).getValues();
  for (let i=values.length-1;i>=0;i--) {
    const importId=String(values[i][0]||'').trim();
    const status=String(values[i][12]||'').trim();
    const undoneAt=values[i][13];
    if(importId && status==='SAVED' && !undoneAt) return importId;
  }
  return '';
}

function appendApplicationEvent_(eventType, description, payload) {
  const sheet=getOrCreateBusinessHistorySheet_();
  const data=payload||{};
  sheet.appendRow([new Date(),getCurrentUserEmail_(),eventType,description,data.itemsCount!==undefined?data.itemsCount:'',data.archiveSheetName||data.sourceSheetName||'',data.xlsxUrl||'',data.pdfUrl||'',data.exportId||data.sessionId||data.eventId||('EVT-'+Date.now()),CONFIG.VERSION]);
}
