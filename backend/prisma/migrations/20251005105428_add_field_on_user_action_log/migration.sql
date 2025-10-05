/*
  Warnings:

  - A unique constraint covering the columns `[is_read,user_id,word_id,sentence_id]` on the table `user_action_log` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user_action_log` ADD COLUMN `is_read` BOOLEAN GENERATED ALWAYS AS (IF(`type` = 'read', 1, NULL)) STORED AFTER `type`,
    ADD COLUMN `word_id` INTEGER GENERATED ALWAYS AS (JSON_EXTRACT(action, '$.word_id')) STORED AFTER `action`,
    ADD COLUMN `sentence_id` INTEGER GENERATED ALWAYS AS (JSON_EXTRACT(action, '$.sentence_id')) STORED AFTER `word_id`;

-- CreateIndex
CREATE UNIQUE INDEX `user_action_log_is_read_user_id_word_id_sentence_id_key` ON `user_action_log`(`is_read`, `user_id`, `word_id`, `sentence_id`);
