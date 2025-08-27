-- CreateTable
CREATE TABLE `user_lesson_progress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `lesson_id` INTEGER NOT NULL,
    `status` ENUM('reading', 'finished') NOT NULL,
    `read_till_sentence_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `user_lesson_progress_user_id_lesson_id_key`(`user_id`, `lesson_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_lesson_progress` ADD CONSTRAINT `user_lesson_progress_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_lesson_progress` ADD CONSTRAINT `user_lesson_progress_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_lesson_progress` ADD CONSTRAINT `user_lesson_progress_read_till_sentence_id_fkey` FOREIGN KEY (`read_till_sentence_id`) REFERENCES `sentence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
