/**
 * Spreadsheet access helpers.
 */
const SheetService = {
  /**
   * Normalizes a sheet header for matching.
   * @param {*} header Raw header value.
   * @return {string} Normalized header.
   */
  normalizeHeader(header) {
    return String(header || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  },

  /**
   * Reads DATA rows with row numbers and column map.
   * @return {Object} Data rows and column map.
   */
  getDataRows() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(APP_CONFIG.sheetNames.data);
    if (!sheet) throw new Error('ไม่พบชีต DATA');

    const columnMap = this.getColumnIndexMap(sheet);
    this.validateRequiredColumns(columnMap);

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { rows: [], columnMap, sheet };

    const rows = values.slice(1).map((row, index) => ({ values: row, rowNumber: index + 2 }));
    return { rows, columnMap, sheet };
  },

  /**
   * Builds a normalized header to zero-based column index map.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet DATA sheet.
   * @return {Object} Column index map.
   */
  getColumnIndexMap(sheet) {
    const lastColumn = sheet.getLastColumn();
    const headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
    return headers.reduce((map, header, index) => {
      const normalized = this.normalizeHeader(header);
      if (normalized) map[normalized] = index;
      return map;
    }, {});
  },

  /**
   * Validates required columns based on normalized headers.
   * @param {Object} columnMap Column map.
   */
  validateRequiredColumns(columnMap) {
    const c = APP_CONFIG.columns;
    const required = [c.no, c.vendorName, c.amountMonth, c.due, c.statusPayment, c.chqDate, c.prNo, c.poNo, c.epicoreCode, c.mediaLocation];
    const missing = required.filter((name) => !(name in columnMap));
    if (missing.length) throw new Error('ไม่พบคอลัมน์ที่จำเป็น: ' + missing.join(', '));
  },

  /**
   * Returns active spreadsheet URL.
   * @return {string} Spreadsheet URL.
   */
  getSpreadsheetUrl() {
    return SpreadsheetApp.getActiveSpreadsheet().getUrl();
  },

  /**
   * Gets a row value by normalized column name.
   * @param {Array<*>} row Row values.
   * @param {Object} columnMap Column map.
   * @param {string} columnName Column name.
   * @return {*} Cell value.
   */
  getValue(row, columnMap, columnName) {
    return row[columnMap[columnName]];
  }
};
