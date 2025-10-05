-- AlterTable
ALTER TABLE `user_action_log` MODIFY `type` ENUM('word_mark', 'read') NOT NULL;
