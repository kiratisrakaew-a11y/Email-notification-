/**
 * Log writer for reminder events.
 */
const LogService = {
  /**
   * Appends a log entry to the Log sheet.
   * @param {Object} logEntry Log entry.
   */
  appendLog(logEntry) {
    const sheet = this.getOrCreateLogSheet();
    sheet.appendRow([
      new Date(),
      logEntry.type || '',
      logEntry.recipient || '',
      logEntry.rowNumber || '',
      logEntry.no || '',
      logEntry.vendorName || '',
      logEntry.relatedDate || '',
      logEntry.status || '',
      logEntry.errorMessage || '',
      logEntry.notifyCount || ''
    ]);
  },

  /**
   * Appends an error log entry.
   * @param {Error|string} error Error object or message.
   * @param {Object=} context Optional context.
   */
  appendErrorLog(error, context) {
    context = context || {};
    this.appendLog(Object.assign({}, context, {
      type: context.type || 'Error',
      status: APP_CONFIG.logStatuses.failed,
      errorMessage: error && error.message ? error.message : String(error)
    }));
  },

  /**
   * Appends a warning log entry.
   * @param {Object} warningEntry Warning entry.
   */
  appendWarningLog(warningEntry) {
    this.appendLog(Object.assign({ type: 'Warning' }, warningEntry));
  },

  /**
   * Checks whether a Chq. Date reminder has already been sent for a row/date.
   * @param {string} rowIdentifier Unique row/date identifier.
   * @return {boolean} True when previously sent.
   */
  hasChqDateReminderAlreadySent(rowIdentifier) {
    const sheet = this.getOrCreateLogSheet();
    const values = sheet.getDataRange().getValues();
    const parts = String(rowIdentifier).split('|');
    const targetRow = parts[1];
    const targetDate = parts[2];
    return values.some((row) => String(row[1]) === 'Chq. Date' && String(row[3]) === targetRow && String(row[6]) === targetDate && [APP_CONFIG.logStatuses.success, APP_CONFIG.logStatuses.successAfterRetry].indexOf(row[7]) !== -1);
  },

  /**
   * Gets or creates the Log sheet with headers.
   * @return {GoogleAppsScript.Spreadsheet.Sheet} Log sheet.
   */
  getOrCreateLogSheet() {
    const spreadsheet = SheetService.getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(APP_CONFIG.sheetNames.log);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(APP_CONFIG.sheetNames.log);
      sheet.appendRow(['Timestamp', 'Type', 'Recipient', 'Row Number', 'No', 'Vendor name', 'Related Date', 'Status', 'Error Message', 'Notify Count']);
    }
    return sheet;
  }
};
