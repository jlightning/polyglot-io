-- CreateIndex
CREATE INDEX `user_action_log_user_id_created_at_idx` ON `user_action_log`(`user_id`, `created_at`);
