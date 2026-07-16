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
    if (DateService.isWeekend()) return { sent: false, reason: 'Weekend skipped' };

    const payload = this.buildReminderPayload(settings);
    if (!payload.dueReminders.length && !payload.chqReminders.length && !payload.warnings.length) {
      return { sent: false, reason: 'No reminders' };
    }

    const recipients = this.filterValidRecipients(settings);
    const body = this.buildReminderEmailBody(payload);
    const htmlBody = this.buildReminderEmailHtml(payload);
    return this.sendReminderEmail({
      subject: 'แจ้งเตือน: Vendor ที่จะถึงครบกำหนดเพื่อดำเนินการล่วงหน้า',
      body,
      htmlBody,
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
    const emailFields = Object.assign(this.buildRecipientFields(recipients), {
      subject: reminderPayload.subject,
      body: reminderPayload.body
    });
    if (reminderPayload.htmlBody) emailFields.htmlBody = reminderPayload.htmlBody;
    const result = this.sendEmailWithRetry(emailFields);

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
   * Escapes HTML special characters in a cell value.
   * @param {*} value Raw value.
   * @return {string} Escaped string.
   */
  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /**
   * Builds an HTML email body with real tables (readable in email clients).
   * @param {Object} reminders Reminder payload.
   * @return {string} HTML email body.
   */
  buildReminderEmailHtml(reminders) {
    const url = this.escapeHtml(reminders.spreadsheetUrl);
    const parts = [
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#202124">',
      '<p>แจ้งเตือนรายการ Vendor ที่ถึงกำหนดเพื่อดำเนินการ</p>',
      '<p><a href="' + url + '" style="color:#1a73e8">เปิด Google Sheet</a></p>'
    ];
    parts.push(this.buildSectionHtml('รายการที่ใกล้ถึงกำหนดทำจ่าย', reminders.dueReminders));
    parts.push(this.buildSectionHtml('รายการที่ต้องไปรับเช็ค', reminders.chqReminders));
    parts.push(this.buildSectionHtml('Warning', reminders.warnings));
    parts.push('</div>');
    return parts.join('');
  },

  /**
   * Builds one HTML table section.
   * @param {string} title Section title.
   * @param {Array<Object>} items Reminder items.
   * @return {string} HTML fragment, or empty string when no items.
   */
  buildSectionHtml(title, items) {
    if (!items.length) return '';
    const cellBase = 'border:1px solid #dadce0;padding:6px;vertical-align:top;';
    const headers = ['No', 'Vendor name', 'Amount/Month', 'PR No', 'PO No', 'Epicore Code', 'Media Location', 'Date', 'Days', 'Row'];
    const headHtml = headers.map((h) => '<th style="' + cellBase + 'text-align:left;background:#f1f3f4;white-space:nowrap">' + this.escapeHtml(h) + '</th>').join('');
    const rowsHtml = items.map((item) => {
      const wide = cellBase + 'word-break:break-word;max-width:240px';
      const cells = [
        '<td style="' + cellBase + 'white-space:nowrap">' + this.escapeHtml(item.no) + '</td>',
        '<td style="' + cellBase + 'word-break:break-word;max-width:200px">' + this.escapeHtml(item.vendorName) + '</td>',
        '<td style="' + cellBase + 'white-space:nowrap;text-align:right">' + this.escapeHtml(item.amountMonth) + '</td>',
        '<td style="' + cellBase + '">' + this.escapeHtml(item.prNo) + '</td>',
        '<td style="' + cellBase + '">' + this.escapeHtml(item.poNo) + '</td>',
        '<td style="' + cellBase + '">' + this.escapeHtml(item.epicoreCode) + '</td>',
        '<td style="' + wide + '">' + this.escapeHtml(item.mediaLocation) + '</td>',
        '<td style="' + cellBase + 'white-space:nowrap">' + this.escapeHtml(item.relatedDate || '') + '</td>',
        '<td style="' + cellBase + 'text-align:right">' + this.escapeHtml(item.daysUntil === 0 ? '0' : (item.daysUntil || '')) + '</td>',
        '<td style="' + cellBase + 'text-align:right">' + this.escapeHtml(item.rowNumber) + '</td>'
      ];
      return '<tr>' + cells.join('') + '</tr>';
    }).join('');
    return '<h3 style="margin:16px 0 6px">' + this.escapeHtml(title) + '</h3>' +
      '<table style="border-collapse:collapse;width:100%;font-size:12px">' +
      '<thead><tr>' + headHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';
  },

  /**
   * Sends a test email using current settings.
   * @return {Object} Test result.
   */
  sendTestEmail() {
    this.assertTestEmailCooldown();
    const settings = SettingsService.getSettings();
    const recipients = this.filterValidRecipients(settings);
    const now = new Date();
    const result = this.sendEmailWithRetry(Object.assign(this.buildRecipientFields(recipients), {
      subject: 'ทดสอบระบบแจ้งเตือนอีเมล',
      body: 'นี่คืออีเมลทดสอบจากระบบแจ้งเตือน Google Apps Script\n' + now,
      htmlBody: '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#202124">' +
        '<p>นี่คืออีเมลทดสอบจากระบบแจ้งเตือน Google Apps Script</p>' +
        '<p>เวลา: ' + this.escapeHtml(now) + '</p></div>'
    }));
    PropertiesService.getScriptProperties().setProperty(APP_CONFIG.propertyKeys.lastTestEmailAt, String(now.getTime()));
    LogService.appendLog({ type: 'Test', recipient: recipients.to.concat(recipients.cc, recipients.bcc).join(','), status: result.status, errorMessage: result.errorMessage || '' });
    return result;
  },

  /**
   * Enforces a minimum interval between manual test emails to prevent abuse
   * of the owner's daily sending quota.
   * @throws {Error} When a test email was sent too recently.
   */
  assertTestEmailCooldown() {
    const props = PropertiesService.getScriptProperties();
    const last = Number(props.getProperty(APP_CONFIG.propertyKeys.lastTestEmailAt) || 0);
    const cooldownMs = APP_CONFIG.testEmailCooldownSeconds * 1000;
    if (last && (Date.now() - last) < cooldownMs) {
      throw new Error('กรุณารอสักครู่ก่อนส่งอีเมลทดสอบอีกครั้ง');
    }
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
   * Builds MailApp to/cc/bcc fields without duplicating a recipient.
   * MailApp requires a "to" value, so when To is empty the first available
   * CC or BCC recipient is promoted to To and removed from its original field.
   * @param {Object} recipients Filtered recipients with to/cc/bcc arrays.
   * @return {Object} MailApp recipient fields.
   */
  buildRecipientFields(recipients) {
    const cc = recipients.cc.slice();
    const bcc = recipients.bcc.slice();
    let to = recipients.to.slice();
    if (!to.length) {
      if (cc.length) to = [cc.shift()];
      else if (bcc.length) to = [bcc.shift()];
    }
    return { to: to.join(','), cc: cc.join(','), bcc: bcc.join(',') };
  },

  /**
   * Detects whether an error is a Gmail/MailApp quota error.
   * @param {Error|string} error Error from MailApp.
   * @return {boolean} True when the error indicates a quota limit.
   */
  isQuotaError(error) {
    const message = (error && error.message ? error.message : String(error)).toLowerCase();
    return message.indexOf('quota') !== -1 || message.indexOf('too many times') !== -1;
  },

  /**
   * Sends email and retries once when failed. Quota errors are not retried and
   * are reported with a dedicated QUOTA_EXCEEDED status.
   * @param {Object} emailPayload Email payload.
   * @return {Object} Send result.
   */
  sendEmailWithRetry(emailPayload) {
    try {
      if (MailApp.getRemainingDailyQuota() <= 0) {
        return { status: APP_CONFIG.logStatuses.quotaExceeded, errorMessage: 'Daily email quota exhausted' };
      }
    } catch (quotaCheckError) {
      // If the quota probe itself fails, fall through and let sendEmail report.
    }
    try {
      MailApp.sendEmail(emailPayload);
      return { status: APP_CONFIG.logStatuses.success };
    } catch (firstError) {
      if (this.isQuotaError(firstError)) {
        return { status: APP_CONFIG.logStatuses.quotaExceeded, errorMessage: firstError.message };
      }
      try {
        MailApp.sendEmail(emailPayload);
        return { status: APP_CONFIG.logStatuses.successAfterRetry, errorMessage: firstError.message };
      } catch (secondError) {
        if (this.isQuotaError(secondError)) {
          return { status: APP_CONFIG.logStatuses.quotaExceeded, errorMessage: secondError.message };
        }
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
