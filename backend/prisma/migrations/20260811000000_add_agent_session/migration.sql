-- CreateTable
CREATE TABLE `agent_session` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `agent_type` VARCHAR(50) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `lesson_id` INTEGER NULL,
    `idempotency_key` VARCHAR(100) NULL,
    `goal` VARCHAR(2000) NOT NULL,
    `tmux_session_name` VARCHAR(100) NOT NULL,
    `status` ENUM('starting', 'running', 'exited', 'failed', 'stopped') NOT NULL DEFAULT 'starting',
    `exit_code` INTEGER NULL,
    `error_code` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_seen_at` TIMESTAMP(0) NULL,
    `ended_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `agent_session_tmux_session_name_key`(`tmux_session_name`),
    UNIQUE INDEX `agent_session_user_id_idempotency_key_key`(`user_id`, `idempotency_key`),
    INDEX `agent_session_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `agent_session_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agent_session` ADD CONSTRAINT `agent_session_user_id_fkey`
FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_session` ADD CONSTRAINT `agent_session_lesson_id_fkey`
FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
