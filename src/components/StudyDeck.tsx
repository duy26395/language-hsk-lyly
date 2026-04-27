import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  Eye,
  Flame,
  Layers3,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { WordExplanation, readAloud } from '../lib/ai';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface WordReview {
  dueAt: number;
  intervalDays: number;
  ease: number;
  lapses: number;
  streak: number;
  lastReviewedAt?: number;
}

export interface SavedWordEntry {
  word: string;
  explanation: WordExplanation;
  review?: WordReview;
}

interface StudyDeckProps {
  words: SavedWordEntry[];
  onReview: (word: string, grade: ReviewGrade) => void;
  onOpenNotebook: () => void;
  onOpenReading: () => void;
}

const gradeConfig: Record<ReviewGrade, { label: string; hint: string; className: string }> = {
  again: {
    label: 'Again',
    hint: '10 min',
    className: 'border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100',
  },
  hard: {
    label: 'Hard',
    hint: '1 day',
    className: 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
  good: {
    label: 'Good',
    hint: 'Next step',
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  easy: {
    label: 'Easy',
    hint: 'Longer',
    className: 'border-violet-100 bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
};

const getReview = (word: SavedWordEntry): WordReview => ({
  dueAt: word.review?.dueAt ?? Date.now(),
  intervalDays: word.review?.intervalDays ?? 0,
  ease: word.review?.ease ?? 2.5,
  lapses: word.review?.lapses ?? 0,
  streak: word.review?.streak ?? 0,
  lastReviewedAt: word.review?.lastReviewedAt,
});

const formatDue = (dueAt: number) => {
  const diff = dueAt - Date.now();
  if (diff <= 0) return 'Due now';
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return `${Math.ceil(hours / 24)} day`;
};

export default function StudyDeck({ words, onReview, onOpenNotebook, onOpenReading }: StudyDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  const now = Date.now();
  const dueWords = useMemo(
    () => words.filter((item) => getReview(item).dueAt <= now).sort((a, b) => getReview(a).dueAt - getReview(b).dueAt),
    [words, now],
  );
  const studyWords = dueWords.length > 0
    ? dueWords
    : [...words].sort((a, b) => getReview(a).dueAt - getReview(b).dueAt).slice(0, 8);

  const currentWord = studyWords[currentIndex % Math.max(studyWords.length, 1)];
  const masteredCount = words.filter((item) => getReview(item).streak >= 4 || getReview(item).intervalDays >= 14).length;
  const learningCount = words.filter((item) => getReview(item).lastReviewedAt).length;

  const handleGrade = (grade: ReviewGrade) => {
    if (!currentWord) return;
    onReview(currentWord.word, grade);
    setIsRevealed(false);
    setCurrentIndex((idx) => (studyWords.length <= 1 ? 0 : idx + 1));
  };

  if (words.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-violet-100 bg-white/80 p-5 text-center shadow-sm sm:min-h-[520px] sm:p-8">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-violet-50 text-violet-500 mb-5">
          <BrainCircuit className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">No words to review yet</h2>
        <p className="max-w-md text-slate-500 mb-6">Save words from the Reading tab first, then this space becomes your daily flashcard review.</p>
        <button onClick={onOpenReading} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-95">
          <BookOpen className="h-4 w-4" />
          Open Reading
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 md:gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={CalendarCheck} label="Due now" value={dueWords.length} accent="text-violet-600 bg-violet-50" />
        <StatCard icon={Layers3} label="Saved" value={words.length} accent="text-sky-600 bg-sky-50" />
        <StatCard icon={Flame} label="Learning" value={learningCount} accent="text-amber-600 bg-amber-50" />
        <StatCard icon={CheckCircle2} label="Mastered" value={masteredCount} accent="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-violet-100 bg-white/90 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-violet-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-400">
              {dueWords.length > 0 ? 'Daily review' : 'Extra practice'}
            </p>
            <h2 className="text-lg font-bold text-slate-800">
              Card {Math.min(currentIndex + 1, studyWords.length)} of {studyWords.length}
            </h2>
          </div>
          <button onClick={onOpenNotebook} className="rounded-full border border-violet-100 bg-white px-4 py-2 text-xs font-bold text-violet-600 transition-all hover:bg-violet-50 active:scale-95">
            Notebook
          </button>
        </div>

        {currentWord && (
          <div className="p-4 sm:p-5 md:p-8">
            <motion.button
              type="button"
              onClick={() => setIsRevealed((value) => !value)}
              whileTap={{ scale: 0.985 }}
              className="w-full min-h-[280px] rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-white to-violet-50/40 p-4 text-left shadow-inner transition-all hover:border-violet-200 sm:min-h-[300px] sm:p-6"
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-500 shadow-sm border border-violet-100">
                  {currentWord.explanation.hskLevel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-400 shadow-sm border border-slate-100">
                  <Eye className="h-3.5 w-3.5" />
                  {isRevealed ? 'Hide answer' : 'Reveal answer'}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {!isRevealed ? (
                  <motion.div key="front" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col items-center justify-center text-center min-h-[210px]">
                    <div className="chinese break-words text-5xl font-black tracking-wide text-slate-900 sm:text-6xl md:text-7xl">{currentWord.word}</div>
                    <p className="mt-5 text-sm font-medium text-slate-400">Think of the pinyin, meaning, and one example before revealing.</p>
                  </motion.div>
                ) : (
                  <motion.div key="back" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="min-h-[210px]">
                    <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <div className="chinese break-words text-4xl font-black text-slate-900 sm:text-5xl">{currentWord.word}</div>
                        <p className="mt-2 text-lg font-bold text-violet-600">{currentWord.explanation.pinyin}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          readAloud(currentWord.word);
                        }}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-95"
                        title="Listen"
                      >
                        <Volume2 className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="mt-5 text-lg font-semibold leading-relaxed text-slate-700">{currentWord.explanation.meaning}</p>
                    <div className="mt-5 rounded-2xl border border-slate-100 bg-white/80 p-4">
                      <p className="chinese text-slate-800">{currentWord.explanation.example}</p>
                      <p className="mt-1 text-sm italic text-slate-500">{currentWord.explanation.exampleMeaning}</p>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-500">{currentWord.explanation.learningTip}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
              {(Object.keys(gradeConfig) as ReviewGrade[]).map((grade) => (
                <button
                  key={grade}
                  onClick={() => handleGrade(grade)}
                  disabled={!isRevealed}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${gradeConfig[grade].className}`}
                >
                  <span className="block text-sm font-black">{gradeConfig[grade].label}</span>
                  <span className="text-xs font-semibold opacity-75">{gradeConfig[grade].hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2 text-xs font-semibold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>Next due: {formatDue(getReview(currentWord).dueAt)}</span>
              <button
                onClick={() => {
                  setIsRevealed(false);
                  setCurrentIndex(0);
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-violet-500 transition-all hover:bg-violet-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-violet-50 bg-white/90 p-3 shadow-sm sm:p-4">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-black text-slate-800">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}
