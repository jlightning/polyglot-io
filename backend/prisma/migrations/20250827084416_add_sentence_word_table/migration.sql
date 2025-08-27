-- CreateTable
CREATE TABLE `sentence_word` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `word_id` INTEGER NOT NULL,
    `sentence_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `sentence_word_word_id_sentence_id_key`(`word_id`, `sentence_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sentence_word` ADD CONSTRAINT `sentence_word_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentence_word` ADD CONSTRAINT `sentence_word_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Populate sentence_word table with existing data from split_text
-- This script links words to sentences based on existing split_text data
INSERT INTO `sentence_word` (`word_id`, `sentence_id`, `created_at`, `updated_at`)
SELECT DISTINCT 
    w.id as word_id,
    s.id as sentence_id,
    NOW() as created_at,
    NOW() as updated_at
FROM `sentence` s
INNER JOIN `lesson` l ON s.lesson_id = l.id
INNER JOIN `word` w ON w.language_code = l.language_code
WHERE s.split_text IS NOT NULL
    AND JSON_VALID(s.split_text) = 1
    AND JSON_CONTAINS(s.split_text, JSON_QUOTE(w.word))
ON DUPLICATE KEY UPDATE updated_at = NOW();
