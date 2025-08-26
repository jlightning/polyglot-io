-- CreateTable
CREATE TABLE `word_pronunciation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `word_id` INTEGER NOT NULL,
    `pronunciation` VARCHAR(255) NOT NULL,
    `pronunciation_type` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `word_pronunciation_word_id_pronunciation_pronunciation_type_key`(`word_id`, `pronunciation`, `pronunciation_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `word_pronunciation` ADD CONSTRAINT `word_pronunciation_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
