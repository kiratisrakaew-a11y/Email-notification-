/**
 * Serves the Thai settings page as a Web App (standalone project entry point).
 * @return {GoogleAppsScript.HTML.HtmlOutput} Settings page.
 */
function doGet() {
  if (!AuthService.isAuthorized()) {
    return HtmlService.createHtmlOutput('<p style="font-family:Arial,sans-serif;padding:16px">ไม่มีสิทธิ์เข้าถึงระบบนี้ กรุณาติดต่อผู้ดูแลระบบ</p>')
      .setTitle('ไม่มีสิทธิ์เข้าถึง');
  }
  return HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('ตั้งค่าแจ้งเตือน')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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
      EmailService.sendEmailWithRetry(Object.assign(EmailService.buildRecipientFields(recipients), {
        subject: 'แจ้งเตือนระบบทำงานผิดพลาด',
        body: 'ระบบแจ้งเตือนทำงานผิดพลาด กรุณาตรวจสอบชีต Log เพื่อดูรายละเอียด'
      }));
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
  AuthService.assertAuthorized();
  return EmailService.sendTestEmail();
}

/**
 * Returns current settings for Sidebar rendering.
 * @return {Object} Settings with trigger state.
 */
function getSettingsForSidebar() {
  AuthService.assertAuthorized();
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
  AuthService.assertAuthorized();
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
  AuthService.assertAuthorized();
  return TriggerService.toggleReminderSystem(isEnabled);
}
