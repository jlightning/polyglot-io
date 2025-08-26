-- CreateTable
CREATE TABLE `sentence_translation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sentence_id` INTEGER NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `translation` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `sentence_translation_sentence_id_language_code_key`(`sentence_id`, `language_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sentence_translation` ADD CONSTRAINT `sentence_translation_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
