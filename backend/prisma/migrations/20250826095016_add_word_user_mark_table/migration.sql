-- CreateTable
CREATE TABLE `word_user_mark` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `word_id` INTEGER NOT NULL,
    `note` VARCHAR(512) NOT NULL,
    `mark` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `word_user_mark` ADD CONSTRAINT `word_user_mark_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `word_user_mark` ADD CONSTRAINT `word_user_mark_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
