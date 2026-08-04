import { SYLLABUS_DATA } from '../data/syllabusData.ts';

const MATCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'about',
  'chapter',
  'chapters',
  'explain',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'please',
  'the',
  'to',
  'what',
  'write',
]);

const SUBJECT_TOPIC_PHRASES: Record<string, readonly string[]> = {
  Physics: [
    'physics',
    'physical quantity',
    'measurement',
    'scalar',
    'vector',
    'force',
    'motion',
    'speed',
    'velocity',
    'acceleration',
    'gravity',
    'gravitation',
    'kinetic energy',
    'potential energy',
    'thermal energy',
    'heat transfer',
    'temperature',
    'electric current',
    'electricity',
    'voltage',
    'resistance',
    'electromagnet',
    'magnetism',
    'optics',
    'mirror',
    'lens',
    'refraction',
    'reflection of light',
  ],
  Chemistry: [
    'chemistry',
    'chemical reaction',
    'chemical equation',
    'chemical energy',
    'atom',
    'atomic structure',
    'element',
    'periodic table',
    'molecule',
    'compound',
    'chemical bond',
    'bonding',
    'state of matter',
    'solution concentration',
    'electrochemistry',
    'reaction rate',
    'acid',
    'base',
    'salt',
    'organic compound',
    'electron',
    'proton',
    'neutron',
  ],
  Mathematics: [
    'mathematics',
    'maths',
    'math',
    'matrix',
    'determinant',
    'complex number',
    'logarithm',
    'algebra',
    'factorization',
    'linear equation',
    'inequality',
    'ratio',
    'proportion',
    'variation',
    'arithmetic',
    'trigonometry',
    'sine',
    'cosine',
    'tangent',
    'geometry',
    'coordinate',
    'theorem',
  ],
  Biology: [
    'biology',
    'biological',
    'organism',
    'biodiversity',
    'cell',
    'tissue',
    'enzyme',
    'bioenergetics',
    'photosynthesis',
    'respiration',
    'nutrition',
    'digestion',
    'gaseous exchange',
    'homeostasis',
    'chromosome',
    'gene',
    'ecosystem',
  ],
  'Computer Science': [
    'computer science',
    'computer memory',
    'operating system',
    'information technology',
    'information security',
    'cyber security',
    'input device',
    'output device',
    'storage device',
    'computer virus',
    'computer',
    'computing',
    'hardware',
    'software',
    'processor',
    'cpu',
    'memory',
    'ram',
    'rom',
    'database',
    'programming',
    'coding',
    'algorithm',
    'network',
    'internet',
    'cybersecurity',
    'binary',
  ],
  English: [
    'english',
    'english grammar',
    'reading comprehension',
    'vocabulary',
    'synonym',
    'antonym',
    'tense',
    'passive voice',
    'active voice',
    'direct narration',
    'indirect narration',
    'clause',
    'letter writing',
    'application writing',
    'story writing',
    'essay writing',
    'pair of words',
    'english translation',
  ],
  Urdu: [
    'urdu',
    'urdu grammar',
    'urdu poetry',
    'ghazal',
    'nazm',
    'hamd',
    'naat',
    'muhawara',
    'qawaid',
    'khulasa',
    'mazmoon',
    'khat',
    'darkhwast',
    'اردو',
    'غزل',
    'نظم',
    'حمد',
    'نعت',
    'محاورہ',
    'قواعد',
    'خلاصہ',
    'مضمون',
    'خط',
    'درخواست',
    'تشریح',
  ],
  Islamiat: [
    'islamiat',
    'islamic studies',
    'islamic history',
    'islamic ethics',
    'quran',
    'ayat',
    'surah',
    'hadith',
    'sunnah',
    'seerat',
    'nabi',
    'prophet',
    'sahaba',
    'khulafa',
    'salah',
    'namaz',
    'sawm',
    'roza',
    'zakat',
    'hajj',
    'tazkia',
    'اسلامیات',
    'قرآن',
    'آیت',
    'سورت',
    'حدیث',
    'سنت',
    'سیرت',
    'نبی',
    'صحابہ',
    'خلفاء',
    'نماز',
    'روزہ',
    'زکوٰۃ',
    'حج',
  ],
  'Pakistan Studies': [
    'pakistan studies',
    'pak studies',
    'geography of pakistan',
    'pakistan movement',
    'creation of pakistan',
    'ideology of pakistan',
    'constitution of pakistan',
    'natural resources of pakistan',
    'agriculture in pakistan',
    'economy of pakistan',
    'foreign policy of pakistan',
    'quaid e azam',
    'allama iqbal',
    'independence 1947',
    '1947',
    'مطالعہ پاکستان',
    'تحریک پاکستان',
    'قیام پاکستان',
    'آئین پاکستان',
    'قائد اعظم',
    'علامہ اقبال',
  ],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word))
    .join(' ');
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(' ')
    .map((token) => (token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token))
    .filter((token) => token.length > 2 && !MATCH_STOP_WORDS.has(token));
}

function containsPhrase(normalizedMessage: string, phrase: string): boolean {
  return ` ${normalizedMessage} `.includes(` ${normalize(phrase)} `);
}

/**
 * Detects a subject only from subjects that the student selected during onboarding.
 * Exact chapter names remain the strongest signal; subject vocabulary covers common
 * questions that do not repeat a chapter title, such as "What is memory?".
 */
export function detectTutorSubject(message: string, availableSubjects: string[]): string | null {
  const normalizedMessage = normalize(message);
  const messageTokens = new Set(tokens(message));
  if (!normalizedMessage || messageTokens.size === 0) return null;

  const available = new Set(availableSubjects);
  const candidates: Array<{ subject: string; score: number }> = [];

  for (const subject of available) {
    if (containsPhrase(normalizedMessage, subject)) {
      candidates.push({ subject, score: 200 });
    }

    const chapters = SYLLABUS_DATA[subject] ?? [];
    for (const chapter of chapters) {
      const normalizedChapter = normalize(chapter);
      const chapterTokens = tokens(chapter);
      if (!normalizedChapter || chapterTokens.length === 0) continue;

      if (containsPhrase(normalizedMessage, normalizedChapter)) {
        candidates.push({ subject, score: 120 + chapterTokens.length });
        continue;
      }

      const matchedTokens = chapterTokens.filter((token) => messageTokens.has(token));
      if (chapterTokens.length >= 2 && matchedTokens.length === chapterTokens.length) {
        candidates.push({ subject, score: 100 + matchedTokens.length });
      } else if (
        chapterTokens.length === 1 &&
        matchedTokens.length === 1 &&
        chapterTokens[0].length >= 6
      ) {
        candidates.push({ subject, score: 70 });
      }
    }
  }

  for (const subject of available) {
    for (const topic of SUBJECT_TOPIC_PHRASES[subject] ?? []) {
      if (containsPhrase(normalizedMessage, topic)) {
        const topicWordCount = normalize(topic).split(' ').length;
        candidates.push({ subject, score: 90 + topicWordCount });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const tied = candidates.some(
    (candidate) =>
      candidate !== best && candidate.score === best.score && candidate.subject !== best.subject,
  );

  return tied ? null : best.subject;
}
