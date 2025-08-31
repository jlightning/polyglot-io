/*
  Warnings:

  - You are about to drop the `user_action` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `user_action` DROP FOREIGN KEY `user_action_user_id_fkey`;

-- DropTable
DROP TABLE `user_action`;

-- CreateTable
CREATE TABLE `user_action_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` ENUM('word_mark') NOT NULL,
    `action` JSON NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_action_log` ADD CONSTRAINT `user_action_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
