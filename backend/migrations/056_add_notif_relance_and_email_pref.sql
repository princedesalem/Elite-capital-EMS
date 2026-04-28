-- 056_add_notif_relance_and_email_pref.sql
-- Adds:
--   * EMPLOYE.notif_email_enabled (opt-out flag for email dispatch)
--   * Notification.dernier_rappel_at (last out-of-app reminder timestamp for unread notifs)
-- Note: MySQL 8.0 does not support IF NOT EXISTS on ADD COLUMN / CREATE INDEX.
-- The auto-migrator tolerates duplicate-column (1060) and duplicate-key-name (1061) errors.

ALTER TABLE EMPLOYE
    ADD COLUMN notif_email_enabled TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE Notification
    ADD COLUMN dernier_rappel_at DATETIME NULL;

CREATE INDEX idx_notification_lue_creation
    ON Notification (lue, date_creation);
