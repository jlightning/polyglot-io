import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';
import { LanguageRule } from './utils';

export const sentenceSplitterAgent = new Agent({
  name: 'SentenceSplitterAgent',
  instructions: async (
    ctx: { context: BaseAgentContext & { sentence: string } },
    agent: unknown
  ) => {
    const { languageCode } = ctx.context;

    const languageRules = new LanguageRule({
      zh: [
        '- For Chinese: segment by 词 (word/word compound), not by single 字 (character). One 词 can be one or more characters (e.g. 你好 = one word, 中国 = one word). Do not split meaningful compounds like 喜欢, 因为, 什么 into single characters. Recognize both Simplified (简体) and Traditional (繁体) characters.',
        '- Keep conventional transliterated and loan terms from other languages—including place and personal names—as one 词 in their usual written form (characters or roman letters as printed). Split only when ordinary Chinese usage clearly treats two separate words; otherwise do not carve multi-character phonetic adaptations into lone 字 (e.g. "莫斯科" stays one segment for Moscow, likewise "威士忌", "沙发", "香奈儿").',
        '- Split Arabic numerals from the classifier, unit, or time word glued right after them (e.g. "100年" → "100" + "年", "500元" → "500" + "元").',
        '- For spelled-out Chinese numerals, split the numeral phrase from the measure/classifier that follows when they express quantity + unit together (e.g. "五百年" → "五百" + "年").',
        '- Also provide pronunciation in pinyin',
      ],
      ko: [
        '- For Korean (Hangul), segment into recognizable learner vocabulary units respecting morphemes and natural boundaries.',
        '- Split Arabic numerals from counters, currency, measures, units, or time/counting expressions glued immediately after digits with no space (e.g. "100년" → "100" + "년", "50명" → "50" + "명", "500원" → "500" + "원", "30분" → "30" + "분").',
        '- For spelled-out numbers written as one chunk before a fused counter/unit, split quantity from unit (e.g. "오백년" → "오백" + "년"). When the numeral word and counter are separated by spacing, keep them as distinct words per the spaced form (e.g. "한 개" → "한" + "개").',
        '- Also provide pronunciation in romanized form (romanization)',
      ],
      ja: [
        '- Keep て、た、ない、ちゃう、ば、ている/てる、ておく/とく、ます/ません/ました/ましょう、られる/れる、させる/せる、たら/なら、ないで form of word as 1 word (do not split the auxiliary from the verb stem):',
        '  - "食べて" is one word, not "食べ" + "て"',
        '  - "読んで" is one word, not "読ん" + "で"',
        '  - "食べている" is one word, not "食べ" + "ている"',
        '  - "見てる" is one word, not "見" + "てる"',
        '  - "読んでおく" is one word, not "読ん" + "でおく"',
        '  - "買っとく" is one word, not "買っ" + "とく"',
        '  - "食べます" is one word, not "食べ" + "ます"',
        '  - "食べません" is one word, not "食べ" + "ません"',
        '  - "食べました" is one word, not "食べ" + "ました"',
        '  - "食べましょう" is one word, not "食べ" + "ましょう"',
        '  - "行った" is one word, not "行っ" + "た"',
        '  - "食べた" is one word, not "食べ" + "た"',
        '  - "食べない" is one word, not "食べ" + "ない"',
        '  - "分からない" is one word, not "分か" + "らない" or smaller splits',
        '  - "食べちゃう" is one word, not "食べ" + "ちゃう"',
        '  - "しちゃう" is one word, not "し" + "ちゃう"',
        '  - "食べれば" is one word, not "食べ" + "れば"',
        '  - "来れば" is one word, not "来" + "れば"',
        '  - "食べられる" is one word, not "食べ" + "られる"',
        '  - "読まれる" is one word, not "読ま" + "れる"',
        '  - "食べさせる" is one word, not "食べ" + "させる"',
        '  - "読ませる" is one word, not "読ま" + "せる"',
        '  - "食べたら" is one word, not "食べ" + "たら"',
        '  - "行くなら" is one word, not "行く" + "なら"',
        '  - "食べないで" is one word, not "食べ" + "ないで"',
        '- Split these as their own words (do not attach them to the preceding word):',
        '  - Sentence particle "よ" (e.g. "食べる" + "よ", not one word "食べるよ")',
        '  - Sentence particles "ね", "ぞ", "ぜ" (e.g. "いい" + "ね", "行け" + "ぞ", "来い" + "ぜ")',
        '  - Topic/contrast particle "は" (e.g. "私" + "は", "今日" + "は")',
        '  - Copula "だ" (e.g. "学生" + "だ")',
        '  - Copula "です" (e.g. "学生" + "です")',
        '  - Copula past "でした" (e.g. "学生" + "でした")',
        '  - Copula past plain "だった" (e.g. "学生" + "だった")',
        '  - Explanatory "のだ" as "の" + "だ" (e.g. "分かる" + "の" + "だ")',
        '  - Explanatory "んだ" as "ん" + "だ" (e.g. "分かる" + "ん" + "だ")',
        '  - "じゃない" as its own word (e.g. "学生" + "じゃない", keep "じゃない" fused, not fused with the noun)',
        '  - "でしょう" as its own word (e.g. "降る" + "でしょう")',
        '  - Topic or quotative "って" (e.g. "田中さん" + "って"; "そうだ" + "って")',
        '  - Trailing "わよ" as "わ" + "よ" (e.g. "行く" + "わ" + "よ", not one word "行くわよ")',
        '  - Name honorific suffixes "さん", "くん" as their own words (e.g. "田中" + "さん", "太郎" + "くん"; if the name has family + given parts, separate those too, then the suffix)',
        '- Keep glued numeral + classifier/unit/time as one word when they express one measured quantity (e.g. "100年", "50人", "10分", "百年").',
        '- Also provide pronunciation in hiragana',
      ],
      other: [
        '- For languages with no spaces (like Chinese/Japanese), segment into meaningful units',
      ],
    });

    return [
      'You are a language learning assistant that splits sentences into individual meaningful words.',
      '',
      `The sentence is in ${languageCode}.`,
      '',
      'Your task is to:',
      `1. Split the given sentence into individual meaningful words that make sense for a language learner (excluding punctuation marks)`,
      '2. Return the words as an array of strings in their original order of appearance',
      '',
      'Guidelines:',
      '- Split compound words appropriately for the language',
      '- Always split person names into first name and last name as separate words for all languages',
      languageRules.getRule(languageCode),
      '- Be consistent with word segmentation',
      '- Exclude punctuation marks from the word list',
      `- When there're phrase that cannot be split to smaller word without changing the meaning, keep the phrase as 1 word`,
    ].join('\n');
  },
  outputType: z.object({
    words: z.array(
      z.object({
        word: z.string(),
        englishTranslation: z.string(),
        pronunciation: z.string(),
        pronunciationType: z.enum([
          'hiragana',
          'romanization',
          'pinyin',
          'ipa',
        ]),
      })
    ),
  }),
  modelSettings: {
    reasoning: { effort: 'low' },
  },
  model: OPENAI_MODEL.GPT_54,
});
