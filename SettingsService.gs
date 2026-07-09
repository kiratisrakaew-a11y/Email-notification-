/**
 * Settings persistence using PropertiesService.
 */
const SettingsService = {
  /**
   * Returns default settings.
   * @return {Object} Default settings.
   */
  getDefaultSettings() {
    return Object.assign({}, APP_CONFIG.defaults);
  },

  /**
   * Loads settings from document properties.
   * @return {Object} Current settings.
   */
  getSettings() {
    const props = PropertiesService.getDocumentProperties();
    const keys = APP_CONFIG.propertyKeys;
    const defaults = this.getDefaultSettings();
    const timesText = props.getProperty(keys.reminderTimes);
    return {
      dueReminderDays: Number(props.getProperty(keys.dueReminderDays) || defaults.dueReminderDays),
      chqReminderDays: Number(props.getProperty(keys.chqReminderDays) || defaults.chqReminderDays),
      toRecipients: props.getProperty(keys.toRecipients) || defaults.toRecipients,
      ccRecipients: props.getProperty(keys.ccRecipients) || defaults.ccRecipients,
      bccRecipients: props.getProperty(keys.bccRecipients) || defaults.bccRecipients,
      reminderTimes: timesText ? JSON.parse(timesText) : defaults.reminderTimes.slice(),
      isEnabled: props.getProperty(keys.isEnabled) === 'true'
    };
  },

  /**
   * Saves settings and synchronizes triggers when enabled.
   * @param {Object} settings Settings from Sidebar.
   * @return {Object} Saved settings.
   */
  saveSettings(settings) {
    const normalized = this.normalizeSettings(settings);
    const props = PropertiesService.getDocumentProperties();
    const keys = APP_CONFIG.propertyKeys;
    props.setProperties({
      [keys.dueReminderDays]: String(normalized.dueReminderDays),
      [keys.chqReminderDays]: String(normalized.chqReminderDays),
      [keys.toRecipients]: normalized.toRecipients,
      [keys.ccRecipients]: normalized.ccRecipients,
      [keys.bccRecipients]: normalized.bccRecipients,
      [keys.reminderTimes]: JSON.stringify(normalized.reminderTimes),
      [keys.isEnabled]: String(normalized.isEnabled)
    }, true);

    if (normalized.isEnabled) {
      TriggerService.syncReminderTriggers(normalized);
    } else {
      TriggerService.deleteExistingReminderTriggers();
    }
    return normalized;
  },

  /**
   * Updates the enabled flag without deleting other settings.
   * @param {boolean} isEnabled Whether reminders are enabled.
   */
  setReminderSystemEnabled(isEnabled) {
    PropertiesService.getDocumentProperties().setProperty(APP_CONFIG.propertyKeys.isEnabled, String(Boolean(isEnabled)));
  },

  /**
   * Checks whether reminders are enabled.
   * @return {boolean} True when enabled.
   */
  isReminderSystemEnabled() {
    return this.getSettings().isEnabled;
  },

  /**
   * Normalizes settings from UI or storage.
   * @param {Object} settings Raw settings.
   * @return {Object} Normalized settings.
   */
  normalizeSettings(settings) {
    const defaults = this.getDefaultSettings();
    const dueReminderDays = Math.min(60, Math.max(1, Number(settings.dueReminderDays || defaults.dueReminderDays)));
    const chqReminderDays = Math.min(60, Math.max(1, Number(settings.chqReminderDays || defaults.chqReminderDays)));
    const reminderTimes = Array.isArray(settings.reminderTimes) && settings.reminderTimes.length
      ? settings.reminderTimes.filter(Boolean)
      : defaults.reminderTimes.slice();
    return {
      dueReminderDays,
      chqReminderDays,
      toRecipients: String(settings.toRecipients || ''),
      ccRecipients: String(settings.ccRecipients || ''),
      bccRecipients: String(settings.bccRecipients || ''),
      reminderTimes,
      isEnabled: Boolean(settings.isEnabled)
    };
  }
};
