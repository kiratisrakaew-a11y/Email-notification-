/**
 * Authorization for interactive Web App entry points.
 *
 * The Web App is deployed to execute as the owner, so any user inside the
 * deployment's access scope would otherwise run every callable function with
 * the owner's privileges. These helpers restrict interactive access to the
 * owner (the deploying account) plus an optional admin allow-list stored in
 * Script Properties, without touching the time-based trigger path.
 */
const AuthService = {
  /**
   * Returns the email of the user currently accessing the Web App.
   * @return {string} Lowercased active user email, or '' when unavailable.
   */
  getActiveEmail() {
    try {
      return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    } catch (error) {
      return '';
    }
  },

  /**
   * Returns the email of the account the script executes as (the deployer).
   * @return {string} Lowercased owner email, or '' when unavailable.
   */
  getOwnerEmail() {
    try {
      return String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
    } catch (error) {
      return '';
    }
  },

  /**
   * Reads the configured admin allow-list from Script Properties.
   * @return {Array<string>} Lowercased admin emails.
   */
  getAdminEmails() {
    const raw = PropertiesService.getScriptProperties().getProperty(APP_CONFIG.propertyKeys.adminEmails) || '';
    return String(raw).split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
  },

  /**
   * Checks whether the active user may use the interactive Web App.
   * The owner is always allowed (bootstrap); additional admins are opt-in.
   * @return {boolean} True when the active user is authorized.
   */
  isAuthorized() {
    const active = this.getActiveEmail();
    if (!active) return false;
    if (active === this.getOwnerEmail()) return true;
    return this.getAdminEmails().indexOf(active) !== -1;
  },

  /**
   * Throws when the active user is not authorized.
   */
  assertAuthorized() {
    if (!this.isAuthorized()) {
      throw new Error('ไม่มีสิทธิ์เข้าถึงระบบนี้ กรุณาติดต่อผู้ดูแลระบบ');
    }
  }
};
