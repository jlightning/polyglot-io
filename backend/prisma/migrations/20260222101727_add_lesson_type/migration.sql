-- AlterTable
ALTER TABLE `lesson` MODIFY `lesson_type` ENUM('text', 'subtitle', 'manga', 'manual') NOT NULL DEFAULT 'subtitle';
