-- AlterTable
ALTER TABLE `word_user_mark` ADD COLUMN `source` ENUM('lesson', 'import', 'ling_q') NOT NULL DEFAULT 'lesson';
