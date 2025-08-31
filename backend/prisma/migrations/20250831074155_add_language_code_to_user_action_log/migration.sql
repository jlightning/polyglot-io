-- AlterTable
ALTER TABLE `user_action_log` ADD COLUMN `language_code` VARCHAR(10) NOT NULL AFTER user_id;
