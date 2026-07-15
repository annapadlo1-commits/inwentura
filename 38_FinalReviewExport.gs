/**
 * Inventory PRO Enterprise v2.6
 * Final Review & Export.
 */

function showFinalReview() {
  const html = renderInventoryTemplate_('UI_FinalReview')
    .setWidth(1180)
    .setHeight(760);

  SpreadsheetApp.getUi().showModalDialog(
    html,
    '🍕 Zakończ inwentaryzację — Review & Export'
  );
}

function getFinalReviewSources() {
  const inventoryKey = normalizeText(CONFIG.SHEETS.INVENTORY);
  const sources = SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .map(sheet => sheet.getName())
    .filter(name => {
      const normalized = normalizeText(name);
      return normalized === inventoryKey || /^ARCHIWUM\b/i.test(name);
    })
    .map(name => ({
      name: name,
      current: normalizeText(name) === inventoryKey
    }));

  sources.sort((a, b) => {
    if (a.current) return -1;
    if (b.current) return 1;
    return b.name.localeCompare(a.name, 'pl');
  });

  return sources;
}

function getFinalReviewData(sourceSheetName) {
  const selectedSheet = resolveFinalReviewSheetName_(sourceSheetName);
  const snapshot = buildFinalInventorySnapshot_(selectedSheet);
  const session = ensureActiveInventorySession_();

  return {
    version: CONFIG.VERSION,
    sourceSheetName: selectedSheet,
    isCurrentInventory: normalizeText(selectedSheet) === normalizeText(CONFIG.SHEETS.INVENTORY),
    sessionId: session.id,
    startedAt: session.startedAt,
    generatedAt: new Date().toISOString(),
    summary: snapshot.summary,
    items: snapshot.items,
    warnings: snapshot.warnings,
    newProducts: getNewProductsForSession_(session.startedAt),
    duplicates: getDuplicateGroupsForSession_(session.startedAt)
  };
}

function applyFinalReviewCorrections(corrections, sourceSheetName) {
  if (!Array.isArray(corrections) || !corrections.length) {
    return { success: true, updated: 0 };
  }

  const selectedSheet = resolveFinalReviewSheetName_(sourceSheetName);
  if (normalizeText(selectedSheet) !== normalizeText(CONFIG.SHEETS.INVENTORY)) {
    throw new Error('Archiwalna inwentaryzacja jest tylko do odczytu.');
  }
  const sheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  if (!sheet) throw new Error('Nie znaleziono arkusza: ' + selectedSheet + '.');

  let updated = 0;
  corrections.forEach(correction => {
    const a1 = String(correction.a1 || '').trim().toUpperCase();
    if (!/^[A-Z]+\d+$/.test(a1)) return;

    const raw = correction.value;
    if (raw === '' || raw === null || raw === undefined) {
      sheet.getRange(a1).clearContent();
      updated++;
      return;
    }

    const value = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Nieprawidłowa wartość dla komórki ' + a1 + '.');
    }

    sheet.getRange(a1).setValue(value);
    updated++;
  });

  SpreadsheetApp.flush();
  return { success: true, updated: updated };
}

function finalizeInventoryAndExport(options) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const data = options || {};
    const sourceSheetName = resolveFinalReviewSheetName_(data.sourceSheetName);
    const isCurrentInventory = normalizeText(sourceSheetName) === normalizeText(CONFIG.SHEETS.INVENTORY);
    const corrections = Array.isArray(data.corrections) ? data.corrections : [];
    if (corrections.length) applyFinalReviewCorrections(corrections, sourceSheetName);

    const snapshot = buildFinalInventorySnapshot_(sourceSheetName);
    const session = ensureActiveInventorySession_();
    const excluded = new Set((data.excludedProductKeys || []).map(String));
    const filteredItems = snapshot.items.filter(item => !excluded.has(item.key));
    const exportId = createInventoryExportId_();

    const exportSpreadsheet = createFinalExportSpreadsheet_({
      exportId: exportId,
      session: session,
      snapshot: snapshot,
      items: filteredItems,
      excludedCount: snapshot.items.length - filteredItems.length,
      note: String(data.note || '').trim(),
      sourceSheetName: sourceSheetName
    });

    const xlsxFile = exportSpreadsheetAsXlsx_(exportSpreadsheet, exportId);
    const pdfFile = data.includePdf === false ? null : exportManagerReportAsPdf_(exportSpreadsheet, exportId);
    const archiveSheetName = isCurrentInventory ? createFinalInventoryArchive_(exportId) : sourceSheetName;

    appendExportHistory_({
      exportId: exportId,
      sessionId: session.id,
      startedAt: session.startedAt,
      finishedAt: new Date(),
      itemsCount: filteredItems.length,
      warningsCount: snapshot.warnings.length,
      excludedCount: snapshot.items.length - filteredItems.length,
      spreadsheetUrl: exportSpreadsheet.getUrl(),
      xlsxUrl: xlsxFile.getUrl(),
      pdfUrl: pdfFile ? pdfFile.getUrl() : '',
      archiveSheetName: archiveSheetName,
      note: String(data.note || '').trim(),
      sourceSheetName: sourceSheetName
    });

    if (isCurrentInventory) {
      closeActiveInventorySession_(exportId);
      clearCurrentInventoryData_(getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY));
      startInventorySession_();
      appendApplicationEvent_('INVENTORY_STARTED','Rozpoczęto nową inwentaryzację po zamknięciu poprzedniej',{previousExportId:exportId});
    }

    logInfo('FinalReviewExport', 'finalizeInventoryAndExport', 'Zakończono inwentaryzację i utworzono eksport', {
      exportId: exportId,
      items: filteredItems.length,
      warnings: snapshot.warnings.length,
      xlsxFileId: xlsxFile.getId(),
      pdfFileId: pdfFile ? pdfFile.getId() : ''
    });

    return {
      success: true,
      exportId: exportId,
      xlsxUrl: xlsxFile.getUrl(),
      pdfUrl: pdfFile ? pdfFile.getUrl() : '',
      spreadsheetUrl: exportSpreadsheet.getUrl(),
      archiveSheetName: archiveSheetName,
      exportedItems: filteredItems.length,
      warnings: snapshot.warnings.length
    };
  } finally {
    lock.releaseLock();
  }
}

function buildFinalInventorySnapshot_(sourceSheetName) {
  const report = generateInventoryReport(sourceSheetName);
  return {
    items: report.items,
    warnings: report.warnings,
    summary: report.summary,
    validationIssues: report.validationIssues,
    statistics: report.statistics,
    metadata: report.metadata
  };
}

function buildLegacyReviewValues_(summaryItem) {
  const details = summaryItem.details || {};
  if (summaryItem.type === CONFIG.PRODUCT_TYPES.LOCATION) {
    return {
      Magazyn: normalizeReportNumber_(details.warehouse),
      Darkroom: normalizeReportNumber_(details.darkroom),
      'Lodówki': normalizeReportNumber_(details.fridges),
      'Stan końcowy': normalizeReportNumber_(summaryItem.finalTotal)
    };
  }
  if (summaryItem.type === CONFIG.PRODUCT_TYPES.KEG) {
    return {
      'Waga brutto': normalizeReportNumber_(details.grossWeight),
      'Waga pustego kega': normalizeReportNumber_(details.emptyContainerWeight),
      'Otwarty keg netto': normalizeReportNumber_(details.openNet),
      'Pełne kegi': normalizeReportNumber_(details.fullUnits),
      'Pojemność kega': normalizeReportNumber_(details.unitCapacity),
      'Pełne kegi w l': normalizeReportNumber_(details.fullUnitsVolume),
      'Stan końcowy': normalizeReportNumber_(summaryItem.finalTotal)
    };
  }
  return {
    'Waga brutto': normalizeReportNumber_(details.grossWeight),
    'Waga pustej butelki': normalizeReportNumber_(details.emptyContainerWeight),
    'Otwarta zawartość netto': normalizeReportNumber_(details.openNet),
    'PREP netto': normalizeReportNumber_(details.prepNet),
    'Pełne butelki': normalizeReportNumber_(details.fullUnits),
    'Pojemność butelki': normalizeReportNumber_(details.unitCapacity),
    'Pełne butelki w l': normalizeReportNumber_(details.fullUnitsVolume),
    'Stan końcowy': normalizeReportNumber_(summaryItem.finalTotal)
  };
}

function buildEditableReviewCells_(summaryItem) {
  const cells = summaryItem.cells || {};
  if (summaryItem.type === CONFIG.PRODUCT_TYPES.LOCATION) {
    return {
      Magazyn: cells.warehouse,
      Darkroom: cells.darkroom,
      'Lodówki': cells.fridges
    };
  }
  if (summaryItem.type === CONFIG.PRODUCT_TYPES.KEG) {
    return {
      'Waga brutto': cells.grossWeight,
      'Pełne kegi': cells.fullUnits
    };
  }
  return {
    'Waga brutto': cells.grossWeight,
    'Pełne butelki': cells.fullUnits
  };
}

function applySummaryWarnings_(item, settings) {
  const details = item.details || {};
  if (item.type === CONFIG.PRODUCT_TYPES.LOCATION) {
    ['warehouse', 'darkroom', 'fridges'].forEach(key => {
      const value = details[key];
      if (value !== '' && Number(value) > settings.locationWarning) item.flags.push('DUŻA ILOŚĆ');
    });
  } else if (item.type === CONFIG.PRODUCT_TYPES.KEG) {
    if (normalizeReportNumber_(details.grossWeight) !== '' && Number(normalizeReportNumber_(details.grossWeight)) > settings.kegWeightWarning) item.flags.push('DUŻA WAGA');
    if (normalizeReportNumber_(details.fullUnits) !== '' && Number(normalizeReportNumber_(details.fullUnits)) > settings.kegWholeWarning) item.flags.push('DUŻA ILOŚĆ');
  } else {
    if (normalizeReportNumber_(details.grossWeight) !== '' && Number(normalizeReportNumber_(details.grossWeight)) > settings.normalWeightWarning) item.flags.push('DUŻA WAGA');
    if (normalizeReportNumber_(details.fullUnits) !== '' && Number(normalizeReportNumber_(details.fullUnits)) > settings.normalWholeWarning) item.flags.push('DUŻA ILOŚĆ');
  }

  const entered = Object.keys(details).filter(key => details[key] !== '');
  if (settings.warnZero && entered.length && entered.every(key => Number(details[key]) === 0)) {
    item.flags.push('WPROWADZONO 0');
  }
}

function numericOrZero_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function createFinalExportSpreadsheet_(payload) {
  const source = SpreadsheetApp.getActiveSpreadsheet();
  const name = 'Inventory PRO ' + payload.exportId;
  const exportSpreadsheet = SpreadsheetApp.create(name);
  const summarySheet = exportSpreadsheet.getSheets()[0];
  summarySheet.setName('PODSUMOWANIE');

  buildExportManagerReportSheet_(summarySheet, payload);
  buildExportFinalSummarySheet_(exportSpreadsheet.insertSheet('PODSUMOWANIE FINALNE'), payload.items);
  buildExportNormalDetailsSheet_(exportSpreadsheet.insertSheet('SZCZEGÓŁY NORMAL'), payload.items);
  buildExportKegDetailsSheet_(exportSpreadsheet.insertSheet('SZCZEGÓŁY KEG'), payload.items);
  buildExportLocationDetailsSheet_(exportSpreadsheet.insertSheet('SZCZEGÓŁY LOCATION'), payload.items);
  buildExportWarningsSheet_(exportSpreadsheet.insertSheet('OSTRZEŻENIA'), payload.snapshot.warnings);
  buildExportNewProductsSheet_(exportSpreadsheet.insertSheet('NOWE PRODUKTY'), getNewProductsForSession_(payload.session.startedAt));
  buildExportDuplicatesSheet_(exportSpreadsheet.insertSheet('DUPLIKATY'), getDuplicateGroupsForSession_(payload.session.startedAt));
  buildExportStatisticsSheet_(exportSpreadsheet.insertSheet('STATYSTYKI'), payload);
  buildExportMetadataSheet_(exportSpreadsheet.insertSheet('METADANE'), payload);

  SpreadsheetApp.flush();
  return exportSpreadsheet;
}

function buildExportSummarySheet_(sheet, payload) {
  const source = SpreadsheetApp.getActiveSpreadsheet();
  const summary = payload.snapshot.summary;
  const values = [
    ['🍕 INVENTORY PRO — PODSUMOWANIE'],
    ['Numer eksportu', payload.exportId],
    ['Lokal / plik źródłowy', source.getName()],
    ['Arkusz źródłowy', payload.sourceSheetName || CONFIG.SHEETS.INVENTORY],
    ['Rozpoczęto', new Date(payload.session.startedAt)],
    ['Zakończono', new Date()],
    ['Użytkownik', getCurrentUserEmail_()],
    ['Wersja aplikacji', CONFIG.VERSION],
    ['Produkty w katalogu', summary.products],
    ['Pozycje uzupełnione', summary.completed],
    ['Brak wartości', summary.missing],
    ['Produkty z ostrzeżeniami', summary.warningProducts],
    ['Wykluczono z eksportu', payload.excludedCount],
    ['Notatka', payload.note || '']
  ];

  sheet.getRange(1, 1, values.length, 2).setValues(values.map(row => row.length === 1 ? [row[0], ''] : row));
  sheet.getRange('A1:B1').merge().setBackground('#f6b26b').setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sheet.getRange(2, 1, values.length - 1, 1).setFontWeight('bold').setBackground('#fff2cc');
  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 420);
  sheet.setFrozenRows(1);
}

function buildExportFinalSummarySheet_(sheet, items) {
  const headers = ['Kategoria', 'Produkt', 'Typ', 'Stan końcowy', 'Jednostka', 'Status'];
  const rows = items.map(item => [
    item.category,
    item.product,
    item.type,
    item.finalTotal,
    item.unit,
    item.flags.join(', ') || 'OK'
  ]);
  writeExportTable_(sheet, headers, rows, '#f6b26b');
}

function buildExportNormalDetailsSheet_(sheet, items) {
  const headers = ['Kategoria', 'Produkt', 'Waga brutto C', 'Waga pustej butelki D', 'Otwarta zawartość E', 'PREP netto G', 'Pełne sztuki H', 'Pojemność I', 'Pełne butelki w l J', 'Stan końcowy K', 'Jednostka'];
  const rows = items.filter(item => item.type === CONFIG.PRODUCT_TYPES.NORMAL).map(item => {
    const d = item.details || {};
    return [item.category, item.product, d.grossWeight, d.emptyContainerWeight, d.openNet, d.prepNet, d.fullUnits, d.unitCapacity, d.fullUnitsVolume, item.finalTotal, item.unit];
  });
  writeExportTable_(sheet, headers, rows, '#fff2cc');
}

function buildExportKegDetailsSheet_(sheet, items) {
  const headers = ['Kategoria', 'Produkt', 'Waga brutto C', 'Waga pustego kega D', 'Otwarty keg E', 'Pełne kegi G', 'Pojemność kega H', 'Pełne kegi w l I', 'Stan końcowy J', 'Jednostka'];
  const rows = items.filter(item => item.type === CONFIG.PRODUCT_TYPES.KEG).map(item => {
    const d = item.details || {};
    return [item.category, item.product, d.grossWeight, d.emptyContainerWeight, d.openNet, d.fullUnits, d.unitCapacity, d.fullUnitsVolume, item.finalTotal, item.unit];
  });
  writeExportTable_(sheet, headers, rows, '#cfe2f3');
}

function buildExportLocationDetailsSheet_(sheet, items) {
  const headers = ['Kategoria', 'Produkt', 'Magazyn B', 'Darkroom C', 'Lodówki D', 'Stan końcowy E', 'Jednostka'];
  const rows = items.filter(item => item.type === CONFIG.PRODUCT_TYPES.LOCATION).map(item => {
    const d = item.details || {};
    return [item.category, item.product, d.warehouse, d.darkroom, d.fridges, item.finalTotal, item.unit];
  });
  writeExportTable_(sheet, headers, rows, '#d9ead3');
}

function buildExportWarningsSheet_(sheet, warnings) {
  const headers = ['Produkt', 'Kategoria', 'Flagi', 'Wartości'];
  const rows = warnings.map(item => [item.product, item.category, item.flags.join(', '), JSON.stringify(item.values)]);
  writeExportTable_(sheet, headers, rows, '#f4cccc');
}

function buildExportNewProductsSheet_(sheet, rows) {
  const headers = ['Data', 'Użytkownik', 'Produkt', 'Produkt referencyjny', 'Typ', 'Kategoria', 'Wiersz', 'Wpis źródłowy'];
  writeExportTable_(sheet, headers, rows, '#cfe2f3');
}

function buildExportDuplicatesSheet_(sheet, rows) {
  const headers = ['Import ID', 'Produkt', 'Liczba wystąpień', 'Wartości źródłowe', 'Suma'];
  writeExportTable_(sheet, headers, rows, '#ead1dc');
}

function writeExportTable_(sheet, headers, rows, headerColor) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground(headerColor);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  if (sheet.getLastRow() > 1) sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
}

function exportSpreadsheetAsXlsx_(spreadsheet, exportId) {
  const url = 'https://www.googleapis.com/drive/v3/files/' + spreadsheet.getId() + '/export?mimeType=' + encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Nie udało się wygenerować XLSX. Kod: ' + response.getResponseCode() + '. ' + response.getContentText().slice(0, 300));
  }

  const blob = response.getBlob().setName(exportId + '.xlsx');
  return getExportFolder_().createFile(blob);
}

function getExportFolder_() {
  const sourceFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parents = sourceFile.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const folderName = 'Inventory PRO — Eksporty';
  const folders = parent.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parent.createFolder(folderName);
}

function createFinalInventoryArchive_(exportId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const inventory = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  const base = 'ARCHIWUM ' + exportId.replace(/^INV-/, '');
  const name = createUniqueArchiveName_(spreadsheet, base.slice(0, 90));
  inventory.copyTo(spreadsheet).setName(name);
  return name;
}

function getOrCreateExportHistorySheet_() {
  const sheet = getOrCreateConfiguredSheet_(CONFIG.SHEETS.EXPORT_HISTORY);
  const headers = ['Export ID', 'Session ID', 'Rozpoczęto', 'Zakończono', 'Użytkownik', 'Liczba pozycji', 'Ostrzeżenia', 'Wykluczone', 'Google Sheet', 'XLSX', 'PDF', 'Arkusz archiwum', 'Notatka', 'Wersja', 'Arkusz źródłowy'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f6b26b');
  sheet.setFrozenRows(1);
  return sheet;
}

function appendExportHistory_(data) {
  appendApplicationEvent_('EXPORT', 'Zakończono inwentaryzację i utworzono eksport', {
    exportId:data.exportId, sessionId:data.sessionId, itemsCount:data.itemsCount,
    warningsCount:data.warningsCount, excludedCount:data.excludedCount,
    spreadsheetUrl:data.spreadsheetUrl, xlsxUrl:data.xlsxUrl, pdfUrl:data.pdfUrl || '',
    archiveSheetName:data.archiveSheetName, note:data.note || '', sourceSheetName:data.sourceSheetName
  });
}

function getNewProductsForSession_(startedAt) {
  const sheet = getOrCreateNewProductsSheet_();
  if (sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  const start = new Date(startedAt).getTime();
  return rows.filter(row => row[0] instanceof Date && row[0].getTime() >= start);
}

function getDuplicateGroupsForSession_(startedAt) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REPORT);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 19).getValues();
  const start = new Date(startedAt).getTime();
  return rows
    .filter(row => row[1] instanceof Date && row[1].getTime() >= start && Number(row[11]) >= 2)
    .map(row => [row[0], row[4], row[11], row[12], row[13]]);
}

function createInventoryExportId_() {
  const zone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return 'INV-' + Utilities.formatDate(new Date(), zone, 'yyyyMMdd-HHmmss');
}

function ensureActiveInventorySession_() {
  const properties = PropertiesService.getDocumentProperties();
  const raw = properties.getProperty('INVENTORY_PRO_ACTIVE_SESSION');
  if (raw) {
    try { return JSON.parse(raw); } catch (error) { /* odbuduj */ }
  }
  const session = { id: createUniqueId_('SESSION'), startedAt: new Date().toISOString() };
  properties.setProperty('INVENTORY_PRO_ACTIVE_SESSION', JSON.stringify(session));
  return session;
}

function startInventorySession_() {
  const session = { id: createUniqueId_('SESSION'), startedAt: new Date().toISOString() };
  PropertiesService.getDocumentProperties().setProperty('INVENTORY_PRO_ACTIVE_SESSION', JSON.stringify(session));
  return session;
}

function closeActiveInventorySession_(exportId) {
  const properties = PropertiesService.getDocumentProperties();
  const session = ensureActiveInventorySession_();
  session.closedAt = new Date().toISOString();
  session.exportId = exportId;
  properties.setProperty('INVENTORY_PRO_LAST_CLOSED_SESSION', JSON.stringify(session));
  properties.deleteProperty('INVENTORY_PRO_ACTIVE_SESSION');
}


function resolveFinalReviewSheetName_(requestedName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requested = String(requestedName || CONFIG.SHEETS.INVENTORY).trim();
  const requestedKey = normalizeText(requested);
  const inventoryKey = normalizeText(CONFIG.SHEETS.INVENTORY);

  if (!requested || requestedKey === inventoryKey) {
    const inventorySheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
    if (!inventorySheet) throw new Error('Nie znaleziono bieżącego arkusza INWENTURA.');
    return inventorySheet.getName();
  }

  const sheet = ss.getSheets().find(item => normalizeText(item.getName()) === requestedKey);
  if (!sheet) throw new Error('Nie znaleziono arkusza: ' + requested + '.');
  return sheet.getName();
}
