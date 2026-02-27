-- AlterTable
ALTER TABLE `lesson` ADD COLUMN `created_with_prompt` VARCHAR(4096) NULL AFTER `audio_s3_key`;
