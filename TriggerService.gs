/**
 * Trigger management for scheduled reminders.
 */
const TriggerService = {
  /**
   * Synchronizes reminder triggers with settings.
   * @param {Object} settings Current settings.
   */
  syncReminderTriggers(settings) {
    this.deleteExistingReminderTriggers();
    const reminderTimes = settings.reminderTimes || APP_CONFIG.defaults.reminderTimes;
    reminderTimes.forEach((timeText) => {
      const parts = String(timeText).split(':');
      const hour = Number(parts[0]);
      const minute = Number(parts[1]);
      if (!isNaN(hour)) {
        const builder = ScriptApp.newTrigger(APP_CONFIG.triggerHandler)
          .timeBased()
          .everyDays(1)
          .atHour(hour);
        if (!isNaN(minute)) builder.nearMinute(minute);
        builder.inTimezone(APP_CONFIG.timezone).create();
      }
    });
  },

  /**
   * Deletes existing reminder triggers.
   */
  deleteExistingReminderTriggers() {
    ScriptApp.getProjectTriggers().forEach((trigger) => {
      if (trigger.getHandlerFunction() === APP_CONFIG.triggerHandler) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  },

  /**
   * Checks whether at least one reminder trigger exists.
   * @return {boolean} True when a trigger exists.
   */
  hasActiveReminderTrigger() {
    return ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === APP_CONFIG.triggerHandler);
  },

  /**
   * Enables or disables the reminder system without deleting other settings.
   * @param {boolean} isEnabled Whether to enable reminders.
   * @return {Object} Updated state.
   */
  toggleReminderSystem(isEnabled) {
    const settings = SettingsService.getSettings();
    settings.isEnabled = Boolean(isEnabled);
    SettingsService.setReminderSystemEnabled(settings.isEnabled);
    if (settings.isEnabled) {
      this.syncReminderTriggers(settings);
    } else {
      this.deleteExistingReminderTriggers();
    }
    return { isEnabled: settings.isEnabled, hasActiveTrigger: this.hasActiveReminderTrigger() };
  }
};
