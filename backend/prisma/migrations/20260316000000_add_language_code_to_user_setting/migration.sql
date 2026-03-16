-- AlterTable: add language_code for per-language settings (e.g. DAILY_SCORE_TARGET)
ALTER TABLE `user_setting` ADD COLUMN `language_code` VARCHAR(10) NULL AFTER `setting_key`;

-- Shadow column so unique constraint treats NULL language_code as '' (avoids duplicate user_id+setting_key when language_code is NULL)
ALTER TABLE `user_setting` ADD COLUMN `language_code_key` VARCHAR(10) GENERATED ALWAYS AS (IFNULL(`language_code`, '')) STORED AFTER `language_code`;

-- Create new unique index first (prefix user_id supports the FK), then drop the old one
CREATE UNIQUE INDEX `user_setting_user_id_setting_key_language_code_key_key` ON `user_setting`(`user_id`, `setting_key`, `language_code_key`);

DROP INDEX `user_setting_user_id_setting_key_key` ON `user_setting`;
