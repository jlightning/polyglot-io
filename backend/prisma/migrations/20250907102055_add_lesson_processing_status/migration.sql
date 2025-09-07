-- AlterTable
ALTER TABLE `lesson` ADD COLUMN `processing_status` ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'completed' AFTER lesson_type;
