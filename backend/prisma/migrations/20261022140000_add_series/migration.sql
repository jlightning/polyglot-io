-- CreateTable
CREATE TABLE `series` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_by` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`),
    CONSTRAINT `series_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_ja_0900_as_cs_ks;

-- CreateTable
CREATE TABLE `series_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `series_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `series_user_series_id_user_id_key`(`series_id`, `user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `series_user_series_id_fkey` FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `series_user_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_ja_0900_as_cs_ks;

-- CreateTable
CREATE TABLE `series_lesson` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `series_id` INTEGER NOT NULL,
    `lesson_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `series_lesson_series_id_lesson_id_key`(`series_id`, `lesson_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `series_lesson_series_id_fkey` FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `series_lesson_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_ja_0900_as_cs_ks;
