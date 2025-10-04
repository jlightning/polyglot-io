import cron from 'node-cron';
import { prisma } from './index';
import { NUMBER_OF_TRANSLATION_TO_REDUCE } from './consts';
import { WordService } from './wordService';

export class CronService {
  registerCron(): void {
    this.registerWordTranslationCleaningCron();
  }

  registerWordTranslationCleaningCron(): void {
    let isRunning = false;
    cron.schedule('*/30 * * * *', async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        const wordIdsToProcess = await prisma.wordTranslation.groupBy({
          by: 'word_id',
          _count: {
            id: true,
          },
          having: {
            translation: {
              _count: {
                gt: NUMBER_OF_TRANSLATION_TO_REDUCE,
              },
            },
          },
        });

        const words = await prisma.word.findMany({
          where: {
            id: { in: wordIdsToProcess.map(w => w.word_id) },
          },
        });

        for (let i = 0; i < words.length; i++) {
          const word = words[i]!;
          console.log(
            `Processing word translations (${i + 1}/${words.length}) for: ${word.word} (${word.language_code}) that has ${wordIdsToProcess.find(w => w.word_id === word.id)?._count} translations`
          );
          await WordService.getWordTranslations(word.word, word.language_code);
        }
      } finally {
        isRunning = false;
      }
    });
  }
}
