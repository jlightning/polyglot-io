-- CreateTable
CREATE TABLE `word` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `word` VARCHAR(255) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `word_word_language_code_key`(`word`, `language_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `word_translation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `word_id` INTEGER NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `translation` VARCHAR(191) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `word_translation_word_id_language_code_translation_key`(`word_id`, `language_code`, `translation`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `word_translation` ADD CONSTRAINT `word_translation_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
