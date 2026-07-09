/**
 * Adds the custom reminder menu when the spreadsheet opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(APP_CONFIG.menuName)
    .addItem('เปิดหน้าตั้งค่า', 'showSidebar')
    .addItem('ทดสอบส่งอีเมล', 'sendTestEmail')
    .addToUi();
}

/**
 * Shows the Thai settings Sidebar.
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('ตั้งค่าแจ้งเตือน');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Scheduled trigger wrapper. Business logic stays in EmailService.
 * @return {Object} Reminder result.
 */
function runScheduledReminder() {
  try {
    return EmailService.runReminders();
  } catch (error) {
    LogService.appendErrorLog(error, { type: 'Trigger Error' });
    try {
      const settings = SettingsService.getSettings();
      const recipients = EmailService.filterValidRecipients(settings);
      EmailService.sendEmailWithRetry({
        to: EmailService.getMailTo(recipients),
        cc: recipients.cc.join(','),
        bcc: recipients.bcc.join(','),
        subject: 'แจ้งเตือนระบบทำงานผิดพลาด',
        body: 'Trigger ทำงานผิดพลาด\n' + error.message
      });
    } catch (emailError) {
      LogService.appendErrorLog(emailError, { type: 'Trigger Error Email' });
    }
    throw error;
  }
}

/**
 * Wrapper function for Sidebar/menu test email action.
 * @return {Object} Test email result.
 */
function sendTestEmail() {
  return EmailService.sendTestEmail();
}

/**
 * Returns current settings for Sidebar rendering.
 * @return {Object} Settings with trigger state.
 */
function getSettingsForSidebar() {
  const settings = SettingsService.getSettings();
  settings.hasActiveTrigger = TriggerService.hasActiveReminderTrigger();
  return settings;
}

/**
 * Saves Sidebar settings.
 * @param {Object} settings Settings from Sidebar.
 * @return {Object} Saved settings with trigger state.
 */
function saveSettingsFromSidebar(settings) {
  const saved = SettingsService.saveSettings(settings);
  saved.hasActiveTrigger = TriggerService.hasActiveReminderTrigger();
  return saved;
}

/**
 * Toggles the reminder system from Sidebar.
 * @param {boolean} isEnabled Whether reminders are enabled.
 * @return {Object} Toggle state.
 */
function toggleReminderSystemFromSidebar(isEnabled) {
  return TriggerService.toggleReminderSystem(isEnabled);
}
