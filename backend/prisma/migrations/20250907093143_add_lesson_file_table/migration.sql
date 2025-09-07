/*
  Warnings:

  - You are about to drop the column `file_s3_key` on the `lesson` table. All the data in the column will be lost.
  - Added the required column `lesson_file_id` to the `sentence` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE `lesson_file` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lesson_id` INTEGER NOT NULL,
    `file_s3_key` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO lesson_file (lesson_id, file_s3_key)
SELECT
    id,
    file_s3_key
FROM lesson;

-- AlterTable
ALTER TABLE `lesson` DROP COLUMN `file_s3_key`,
    ADD COLUMN `lesson_type` ENUM('text', 'subtitle', 'manga') NOT NULL DEFAULT 'subtitle';

-- AlterTable
ALTER TABLE `sentence` ADD COLUMN `lesson_file_id` INTEGER NULL;

UPDATE `sentence` SET `lesson_file_id` = (SELECT id FROM lesson_file WHERE lesson_id = sentence.lesson_id);

ALTER TABLE `sentence` MODIFY COLUMN `lesson_file_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `lesson_file` ADD CONSTRAINT `lesson_file_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentence` ADD CONSTRAINT `sentence_lesson_file_id_fkey` FOREIGN KEY (`lesson_file_id`) REFERENCES `lesson_file`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
