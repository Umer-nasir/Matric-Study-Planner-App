export type SubjectStudyLanguage = 'english' | 'urdu';

const URDU_SUBJECT_NAMES: Record<string, string> = {
  Physics: 'طبیعیات',
  Chemistry: 'کیمیا',
  Mathematics: 'ریاضی',
  Math: 'ریاضی',
  Biology: 'حیاتیات',
  'Computer Science': 'کمپیوٹر سائنس',
  English: 'انگریزی',
  Urdu: 'اردو',
  Islamiat: 'اسلامیات',
  'Pakistan Studies': 'مطالعہ پاکستان',
};

const URDU_CHAPTER_NAMES: Record<string, Record<string, string>> = {
  Physics: {
    Measurements: 'پیمائش',
    'Vectors and Equilibrium': 'ویکٹرز اور توازن',
    'Forces and Motion': 'قوت اور حرکت',
    'Turning Effect of Forces': 'قوتوں کا گردشی اثر',
    Gravitation: 'کشش ثقل',
    'Work and Energy': 'کام اور توانائی',
    'Properties of Matter': 'مادے کی خصوصیات',
    'Thermal Properties of Matter': 'مادے کی حرارتی خصوصیات',
    'Transfer of Heat': 'حرارت کی منتقلی',
    'Current Electricity': 'برقی رو',
    Electromagnetism: 'برقی مقناطیسیت',
    'Geometrical Optics': 'جیومیٹریائی بصریات',
  },
  Chemistry: {
    'Fundamentals of Chemistry': 'کیمیا کی بنیادی باتیں',
    'Structure of Atoms': 'ایٹموں کی ساخت',
    'Periodic Table and Periodicity': 'دوری جدول اور دوریت',
    'Chemical Bonding': 'کیمیائی بندش',
    'States of Matter': 'مادے کی حالتیں',
    Solutions: 'محالیل',
    Electrochemistry: 'برقی کیمیا',
    'Chemical Kinetics': 'کیمیائی حرکیات',
    'Acids Bases and Salts': 'تیزاب، اساس اور نمکیات',
    'Organic Chemistry': 'نامیاتی کیمیا',
  },
  Mathematics: {
    'Matrices and Determinants': 'مصفوفات اور ڈیٹرمیننٹس',
    'Real and Complex Numbers': 'حقیقی اور مختلط اعداد',
    Logarithms: 'لوگارتھمز',
    'Algebraic Expressions': 'الجبری عبارات',
    Factorization: 'تجزیہ',
    'Algebraic Manipulation': 'الجبری عملیات',
    'Linear Equations and Inequalities': 'خطی مساوات اور عدم مساوات',
    'Ratio Proportion and Variation': 'نسبت، تناسب اور تغیر',
    'Financial Arithmetic': 'مالی حساب',
    'Introduction to Trigonometry': 'مثلثیات کا تعارف',
    'Practical Geometry': 'عملی جیومیٹری',
    'Coordinate Geometry': 'مختصاتی جیومیٹری',
  },
  Biology: {
    'Introduction to Biology': 'حیاتیات کا تعارف',
    'Solving a Biological Problem': 'حیاتیاتی مسئلہ حل کرنا',
    Biodiversity: 'حیاتیاتی تنوع',
    'Cells and Tissues': 'خلیات اور بافتیں',
    'Cell Cycle': 'خلوی دور',
    Enzymes: 'خامرے',
    Bioenergetics: 'حیاتی توانائی',
    Nutrition: 'غذائیت',
    Transport: 'نقل و حمل',
    'Gaseous Exchange': 'گیسی تبادلہ',
    Homeostasis: 'اندرونی توازن',
    'Support and Movement': 'سہارا اور حرکت',
  },
  'Computer Science': {
    'Introduction to Computer': 'کمپیوٹر کا تعارف',
    'Information Networks': 'معلوماتی نیٹ ورکس',
    Internet: 'انٹرنیٹ',
    'Fundamentals of Programming': 'پروگرامنگ کی بنیادی باتیں',
    'Control Structures': 'کنٹرول اسٹرکچرز',
    Functions: 'فنکشنز',
    Arrays: 'ایریز',
    'Introduction to Databases': 'ڈیٹابیس کا تعارف',
    'Software Development': 'سافٹ ویئر ڈیویلپمنٹ',
    'Information Security': 'معلوماتی سلامتی',
  },
  Islamiat: {
    'Quran Majeed — Selected Verses': 'قرآن مجید — منتخب آیات',
    'Hadith and Sunnah': 'حدیث اور سنت',
    'Seerat-un-Nabi (SAW)': 'سیرت النبی ﷺ',
    'Khulafa-e-Rashideen': 'خلفائے راشدین',
    'Islamic Worship — Salah and Sawm': 'اسلامی عبادات — نماز اور روزہ',
    'Islamic Worship — Zakat and Hajj': 'اسلامی عبادات — زکوٰۃ اور حج',
    'Islamic Ethics and Morality': 'اسلامی اخلاقیات',
    'Islam and Social Life': 'اسلام اور معاشرتی زندگی',
    'Islamic History — Early Period': 'اسلامی تاریخ — ابتدائی دور',
    'Tazkia-e-Nafs': 'تزکیہ نفس',
  },
  'Pakistan Studies': {
    'Geography of Pakistan — Land and People': 'پاکستان کا جغرافیہ — زمین اور لوگ',
    'Natural Resources of Pakistan': 'پاکستان کے قدرتی وسائل',
    'Agriculture in Pakistan': 'پاکستان میں زراعت',
    'Industry and Economy': 'صنعت اور معیشت',
    'Pakistan Movement — Early Phase': 'تحریک پاکستان — ابتدائی مرحلہ',
    'Creation of Pakistan 1947': 'قیام پاکستان 1947',
    'Constitutional Development': 'آئینی ارتقا',
    'Political History': 'سیاسی تاریخ',
    'Foreign Policy of Pakistan': 'پاکستان کی خارجہ پالیسی',
    'Current Challenges and Development': 'موجودہ مسائل اور ترقی',
  },
};

const URDU_STARTER_QUESTIONS: Record<string, string[]> = {
  Physics: ['نیوٹن کا دوسرا قانون سمجھائیں', 'ویکٹر کیا ہوتا ہے؟'],
  Chemistry: ['کیمیائی بندش سمجھائیں', 'دوری جدول کیوں اہم ہے؟'],
  Mathematics: ['مصفوفات آسان الفاظ میں سمجھائیں', 'لوگارتھم کیا ہوتا ہے؟'],
  Biology: ['ضیائی تالیف سمجھائیں', 'خامرے کیسے کام کرتے ہیں؟'],
  'Computer Science': ['فنکشن کیا ہوتا ہے؟', 'ڈیٹابیس کا مقصد کیا ہے؟'],
  Islamiat: ['سیرت النبی ﷺ کے اہم نکات بتائیں', 'زکوٰۃ کی اہمیت سمجھائیں'],
  'Pakistan Studies': ['تحریک پاکستان کے اہم نکات بتائیں', 'پاکستان کے قدرتی وسائل سمجھائیں'],
  Urdu: ['تشریح کا درست طریقہ بتائیں', 'درخواست کا خاکہ لکھیں'],
};

export const LANGUAGE_FIXED_SUBJECTS: Record<string, SubjectStudyLanguage> = {
  English: 'english',
  Urdu: 'urdu',
};

export function canChooseSubjectLanguage(subject: string): boolean {
  return !LANGUAGE_FIXED_SUBJECTS[subject];
}

export function defaultSubjectLanguage(subject: string): SubjectStudyLanguage {
  if (LANGUAGE_FIXED_SUBJECTS[subject]) return LANGUAGE_FIXED_SUBJECTS[subject];
  if (subject === 'Islamiat' || subject === 'Pakistan Studies') return 'urdu';
  return 'english';
}

export function getSubjectStudyLanguage(
  subject: string,
  subjectLanguages?: Record<string, SubjectStudyLanguage>,
): SubjectStudyLanguage {
  return LANGUAGE_FIXED_SUBJECTS[subject] ?? subjectLanguages?.[subject] ?? defaultSubjectLanguage(subject);
}

export function normalizeSubjectLanguages(
  subjects: string[],
  current?: Record<string, SubjectStudyLanguage>,
): Record<string, SubjectStudyLanguage> {
  const result: Record<string, SubjectStudyLanguage> = {};
  for (const subject of subjects) {
    result[subject] = current?.[subject] ?? defaultSubjectLanguage(subject);
  }
  return result;
}

export function isSubjectUrdu(
  subject: string,
  subjectLanguages?: Record<string, SubjectStudyLanguage>,
): boolean {
  return getSubjectStudyLanguage(subject, subjectLanguages) === 'urdu';
}

export function subjectDisplayName(
  subject: string,
  _subjectLanguages?: Record<string, SubjectStudyLanguage>,
): string {
  return subject;
}

export function subjectNameDirectionClass(subject: string): string {
  return '';
}

export function chapterDisplayName(
  subject: string,
  chapter: string,
  subjectLanguages?: Record<string, SubjectStudyLanguage>,
): string {
  return isSubjectUrdu(subject, subjectLanguages)
    ? URDU_CHAPTER_NAMES[subject]?.[chapter] ?? chapter
    : chapter;
}

export function subjectDirectionClass(
  subject: string,
  subjectLanguages?: Record<string, SubjectStudyLanguage>,
): string {
  return isSubjectUrdu(subject, subjectLanguages) ? 'font-urdu text-right leading-loose [direction:rtl]' : '';
}

export function subjectStarterQuestions(
  subject: string,
  subjectLanguages?: Record<string, SubjectStudyLanguage>,
): string[] {
  if (subject === 'General') return ['Explain photosynthesis', "What is Newton's second law?", 'How do I revise algebra?'];
  if (isSubjectUrdu(subject, subjectLanguages)) {
    return URDU_STARTER_QUESTIONS[subject] ?? ['اہم نکات آسان الفاظ میں سمجھائیں', 'امتحان کے لحاظ سے خلاصہ بتائیں'];
  }
  return ['Explain photosynthesis', "What is Newton's second law?", 'How do I revise algebra?'];
}
