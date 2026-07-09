/**
 * Email reminder business logic.
 */
const EmailService = {
  /**
   * Runs reminders and sends one combined email when needed.
   * @return {Object} Run result.
   */
  runReminders() {
    const settings = SettingsService.getSettings();
    if (!settings.isEnabled) return { sent: false, reason: 'Reminder system disabled' };

    const recipients = this.filterValidRecipients(settings);
    const payload = this.buildReminderPayload(settings);
    if (!payload.dueReminders.length && !payload.chqReminders.length && !payload.warnings.length) {
      return { sent: false, reason: 'No reminders' };
    }

    const body = this.buildReminderEmailBody(payload);
    return this.sendReminderEmail({
      subject: 'แจ้งเตือน: Vendor ที่จะถึงครบกำหนดเพื่อดำเนินการล่วงหน้า',
      body,
      recipients,
      payload
    });
  },

  /**
   * Builds reminder data from DATA sheet.
   * @param {Object} settings Current settings.
   * @return {Object} Reminder payload.
   */
  buildReminderPayload(settings) {
    const data = SheetService.getDataRows();
    const c = APP_CONFIG.columns;
    const today = DateService.getToday();
    const payload = {
      dueReminders: [],
      chqReminders: [],
      warnings: [],
      spreadsheetUrl: SheetService.getSpreadsheetUrl()
    };

    data.rows.forEach((item) => {
      const row = item.values;
      const base = this.buildBaseReminderItem(row, data.columnMap, item.rowNumber);
      const dueDate = DateService.parseSheetDate(SheetService.getValue(row, data.columnMap, c.due));
      const chqDate = DateService.parseSheetDate(SheetService.getValue(row, data.columnMap, c.chqDate));
      const statusPayment = String(SheetService.getValue(row, data.columnMap, c.statusPayment) || '').trim();

      if (!dueDate) {
        const warning = Object.assign({}, base, { type: 'Missing Due', status: APP_CONFIG.logStatuses.warningMissingDue });
        payload.warnings.push(warning);
        LogService.appendWarningLog({
          rowNumber: base.rowNumber,
          no: base.no,
          vendorName: base.vendorName,
          status: APP_CONFIG.logStatuses.warningMissingDue,
          errorMessage: 'Missing Due'
        });
      } else if (statusPayment !== 'เบิกแล้ว') {
        const dueDaysUntil = DateService.calculateDaysUntil(dueDate, today);
        if (dueDaysUntil >= 0 && dueDaysUntil <= settings.dueReminderDays) {
          payload.dueReminders.push(Object.assign({}, base, {
            type: 'Due',
            relatedDate: DateService.formatDate(dueDate),
            daysUntil: dueDaysUntil
          }));
        }
      }

      if (chqDate) {
        const chqDaysUntil = DateService.calculateDaysUntil(chqDate, today);
        const rowIdentifier = this.buildChqDateIdentifier(base.rowNumber, chqDate);
        if (chqDaysUntil >= 0 && chqDaysUntil <= settings.chqReminderDays && !LogService.hasChqDateReminderAlreadySent(rowIdentifier)) {
          payload.chqReminders.push(Object.assign({}, base, {
            type: 'Chq. Date',
            relatedDate: DateService.formatDate(chqDate),
            daysUntil: chqDaysUntil,
            rowIdentifier
          }));
        }
      }
    });

    return payload;
  },

  /**
   * Builds common reminder display fields.
   * @param {Array<*>} row Row values.
   * @param {Object} columnMap Column map.
   * @param {number} rowNumber Sheet row number.
   * @return {Object} Reminder item.
   */
  buildBaseReminderItem(row, columnMap, rowNumber) {
    const c = APP_CONFIG.columns;
    return {
      rowNumber,
      no: SheetService.getValue(row, columnMap, c.no) || '',
      vendorName: SheetService.getValue(row, columnMap, c.vendorName) || '',
      amountMonth: SheetService.getValue(row, columnMap, c.amountMonth) || '',
      prNo: SheetService.getValue(row, columnMap, c.prNo) || '',
      poNo: SheetService.getValue(row, columnMap, c.poNo) || '',
      epicoreCode: SheetService.getValue(row, columnMap, c.epicoreCode) || '',
      mediaLocation: SheetService.getValue(row, columnMap, c.mediaLocation) || ''
    };
  },

  /**
   * Sends reminder email and writes logs.
   * @param {Object} reminderPayload Email payload.
   * @return {Object} Send result.
   */
  sendReminderEmail(reminderPayload) {
    const recipients = reminderPayload.recipients;
    const result = this.sendEmailWithRetry({
      to: this.getMailTo(recipients),
      cc: recipients.cc.join(','),
      bcc: recipients.bcc.join(','),
      subject: reminderPayload.subject,
      body: reminderPayload.body
    });

    const allItems = reminderPayload.payload.dueReminders.concat(reminderPayload.payload.chqReminders, reminderPayload.payload.warnings);
    allItems.forEach((item) => {
      LogService.appendLog({
        type: item.type || 'Reminder',
        recipient: recipients.to.concat(recipients.cc, recipients.bcc).join(','),
        rowNumber: item.rowNumber,
        no: item.no,
        vendorName: item.vendorName,
        relatedDate: item.relatedDate || '',
        status: result.status,
        errorMessage: result.errorMessage || '',
        notifyCount: result.status === APP_CONFIG.logStatuses.successAfterRetry ? 2 : 1
      });
    });
    return result;
  },

  /**
   * Builds plain text email body.
   * @param {Object} reminders Reminder payload.
   * @return {string} Email body.
   */
  buildReminderEmailBody(reminders) {
    const lines = [
      'แจ้งเตือนรายการ Vendor ที่ถึงกำหนดเพื่อดำเนินการ',
      'ลิงก์ Google Sheet: ' + reminders.spreadsheetUrl,
      ''
    ];
    this.appendReminderSection(lines, 'รายการที่ใกล้ถึงกำหนดทำจ่าย', reminders.dueReminders);
    this.appendReminderSection(lines, 'รายการที่ต้องไปรับเช็ค', reminders.chqReminders);
    this.appendReminderSection(lines, 'Warning', reminders.warnings);
    return lines.join('\n');
  },

  /**
   * Appends a section table to email lines.
   * @param {Array<string>} lines Email lines.
   * @param {string} title Section title.
   * @param {Array<Object>} items Reminder items.
   */
  appendReminderSection(lines, title, items) {
    if (!items.length) return;
    lines.push('## ' + title);
    lines.push('No | Vendor name | Amount/Month | PR No | PO No | Epicore Code | Media Location | Date | Days | Row');
    lines.push('---|-------------|--------------|-------|-------|--------------|----------------|------|------|----');
    items.forEach((item) => {
      lines.push([
        item.no,
        item.vendorName,
        item.amountMonth,
        item.prNo,
        item.poNo,
        item.epicoreCode,
        item.mediaLocation,
        item.relatedDate || '',
        item.daysUntil === 0 ? '0' : (item.daysUntil || ''),
        item.rowNumber
      ].join(' | '));
    });
    lines.push('');
  },

  /**
   * Sends a test email using current settings.
   * @return {Object} Test result.
   */
  sendTestEmail() {
    const settings = SettingsService.getSettings();
    const recipients = this.filterValidRecipients(settings);
    const result = this.sendEmailWithRetry({
      to: this.getMailTo(recipients),
      cc: recipients.cc.join(','),
      bcc: recipients.bcc.join(','),
      subject: 'ทดสอบระบบแจ้งเตือนอีเมล',
      body: 'นี่คืออีเมลทดสอบจากระบบแจ้งเตือน Google Apps Script\n' + new Date()
    });
    LogService.appendLog({ type: 'Test', recipient: recipients.to.concat(recipients.cc, recipients.bcc).join(','), status: result.status, errorMessage: result.errorMessage || '' });
    return result;
  },

  /**
   * Filters To/CC/BCC recipients by basic email shape and allowed domain.
   * @param {Object} settings Current settings.
   * @return {Object} Valid recipients.
   */
  filterValidRecipients(settings) {
    const filterList = (text, type) => String(text || '').split(',').map((email) => email.trim()).filter(Boolean).filter((email) => {
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.toLowerCase().endsWith(APP_CONFIG.allowedDomain);
      if (!valid) {
        LogService.appendLog({ type, recipient: email, status: email.toLowerCase().endsWith(APP_CONFIG.allowedDomain) ? APP_CONFIG.logStatuses.skippedInvalidEmail : APP_CONFIG.logStatuses.skippedInvalidDomain, errorMessage: APP_CONFIG.invalidEmailMessage });
      }
      return valid;
    });
    const recipients = {
      to: filterList(settings.toRecipients, 'To'),
      cc: filterList(settings.ccRecipients, 'CC'),
      bcc: filterList(settings.bccRecipients, 'BCC')
    };
    if (!recipients.to.length && !recipients.cc.length && !recipients.bcc.length) throw new Error('ไม่พบอีเมลผู้รับที่ถูกต้อง');
    return recipients;
  },


  /**
   * Returns a required MailApp to value. Falls back to the first CC/BCC when To is empty.
   * @param {Object} recipients Filtered recipients.
   * @return {string} MailApp to recipient string.
   */
  getMailTo(recipients) {
    if (recipients.to.length) return recipients.to.join(',');
    if (recipients.cc.length) return recipients.cc[0];
    return recipients.bcc[0];
  },

  /**
   * Sends email and retries once when failed.
   * @param {Object} emailPayload Email payload.
   * @return {Object} Send result.
   */
  sendEmailWithRetry(emailPayload) {
    try {
      MailApp.sendEmail(emailPayload);
      return { status: APP_CONFIG.logStatuses.success };
    } catch (firstError) {
      try {
        MailApp.sendEmail(emailPayload);
        return { status: APP_CONFIG.logStatuses.successAfterRetry, errorMessage: firstError.message };
      } catch (secondError) {
        return { status: APP_CONFIG.logStatuses.failed, errorMessage: secondError.message };
      }
    }
  },

  /**
   * Builds a unique Chq. Date reminder identifier.
   * @param {number} rowNumber Row number.
   * @param {Date} chqDate Chq. Date.
   * @return {string} Identifier.
   */
  buildChqDateIdentifier(rowNumber, chqDate) {
    return 'CHQ|' + rowNumber + '|' + DateService.formatDate(chqDate);
  }
};
