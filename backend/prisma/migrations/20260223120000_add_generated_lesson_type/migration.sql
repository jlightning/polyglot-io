-- AlterTable
ALTER TABLE `lesson` MODIFY `lesson_type` ENUM('text', 'subtitle', 'manga', 'manual', 'generated') NOT NULL DEFAULT 'subtitle';
