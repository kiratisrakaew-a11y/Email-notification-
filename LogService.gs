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
    const s = this.sanitizeCell;
    sheet.appendRow([
      new Date(),
      s(logEntry.type || ''),
      s(logEntry.recipient || ''),
      s(logEntry.rowNumber || ''),
      s(logEntry.no || ''),
      s(logEntry.vendorName || ''),
      s(logEntry.relatedDate || ''),
      s(logEntry.status || ''),
      s(logEntry.errorMessage || ''),
      s(logEntry.notifyCount || '')
    ]);
  },

  /**
   * Neutralizes spreadsheet formula (CSV) injection by prefixing values that
   * begin with a formula trigger character with a single quote, forcing the
   * cell to be treated as text. Non-string values pass through unchanged.
   * @param {*} value Raw cell value.
   * @return {*} Sanitized value.
   */
  sanitizeCell(value) {
    if (typeof value !== 'string' || !value) return value;
    return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
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
   * Opens the spreadsheet used for storing logs.
   * Logs live in a separate spreadsheet so the DATA sheet can stay read-only.
   * When no Log Sheet ID is configured, a dedicated spreadsheet is created and
   * its ID is saved, guaranteeing write access for the account running triggers.
   * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} Log spreadsheet.
   */
  getLogSpreadsheet() {
    const props = PropertiesService.getScriptProperties();
    const key = APP_CONFIG.propertyKeys.logSheetId;
    const logSheetId = String(props.getProperty(key) || '').trim();
    if (logSheetId) {
      try {
        return SpreadsheetApp.openById(logSheetId);
      } catch (error) {
        throw new Error('เปิด Google Sheet สำหรับเก็บ Log จาก Log Sheet ID ไม่สำเร็จ กรุณาตรวจสอบ Log Sheet ID และสิทธิ์แก้ไข');
      }
    }
    const created = SpreadsheetApp.create('Email Notification Log');
    props.setProperty(key, created.getId());
    return created;
  },

  /**
   * Gets or creates the Log sheet with headers inside the log spreadsheet.
   * @return {GoogleAppsScript.Spreadsheet.Sheet} Log sheet.
   */
  getOrCreateLogSheet() {
    const spreadsheet = this.getLogSpreadsheet();
    let sheet = spreadsheet.getSheetByName(APP_CONFIG.sheetNames.log);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(APP_CONFIG.sheetNames.log);
      sheet.appendRow(['Timestamp', 'Type', 'Recipient', 'Row Number', 'No', 'Vendor name', 'Related Date', 'Status', 'Error Message', 'Notify Count']);
    }
    return sheet;
  }
};
