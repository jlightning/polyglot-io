/*
  Warnings:

  - A unique constraint covering the columns `[user_id,word_id]` on the table `word_user_mark` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `word_user_mark_user_id_word_id_key` ON `word_user_mark`(`user_id`, `word_id`);
