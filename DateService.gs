/**
 * Date helpers for sheet values and reminder windows.
 */
const DateService = {
  /**
   * Parses a Google Sheet date value or DD/MM/YYYY text into a Date.
   * @param {*} value Sheet cell value.
   * @return {Date|null} Parsed date at local midnight, or null.
   */
  parseSheetDate(value) {
    if (!value) return null;
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const text = String(value).trim();
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return date;
  },

  /**
   * Returns today's date at local midnight in the spreadsheet timezone.
   * @return {Date} Today at local midnight.
   */
  getToday() {
    const text = Utilities.formatDate(new Date(), APP_CONFIG.timezone, 'dd/MM/yyyy');
    return this.parseSheetDate(text);
  },

  /**
   * Calculates whole days from today to target date.
   * @param {Date} targetDate Target date.
   * @param {Date} today Today date.
   * @return {number} Number of days until target.
   */
  calculateDaysUntil(targetDate, today) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((targetDate.getTime() - today.getTime()) / msPerDay);
  },

  /**
   * Checks if a date is within the reminder window including today.
   * @param {Date} targetDate Target date.
   * @param {number} daysBefore Days before due date.
   * @param {Date=} today Optional today date.
   * @return {boolean} True when 0 <= daysUntil <= daysBefore.
   */
  isDateWithinReminderWindow(targetDate, daysBefore, today) {
    const daysUntil = this.calculateDaysUntil(targetDate, today || this.getToday());
    return daysUntil >= 0 && daysUntil <= Number(daysBefore);
  },

  /**
   * Formats a date as DD/MM/YYYY.
   * @param {Date|null} date Date to format.
   * @return {string} Formatted date or blank.
   */
  formatDate(date) {
    return date ? Utilities.formatDate(date, APP_CONFIG.timezone, 'dd/MM/yyyy') : '';
  }
};
