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
import { readAloud } from '../lib/voice';
import { useNotebook } from '../hooks/useNotebook';
import { ReviewGrade, WordReview, SavedWordEntry } from '../types';

interface StudyDeckProps {
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

export default function StudyDeck({ onOpenNotebook, onOpenReading }: StudyDeckProps) {
  const { savedWords: words, reviewWord } = useNotebook();
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
    reviewWord(currentWord.word, grade);
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

      {studyWords.length > 0 && currentWord ? (
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>
              Reviewing {currentIndex + 1} of {studyWords.length}
            </span>
            {dueWords.length > 0 ? (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 font-extrabold text-violet-600">Due queue</span>
            ) : (
              <span className="rounded-full bg-slate-50 px-2.5 py-1">Previewing oldest</span>
            )}
          </div>

          <motion.button
            layout
            onClick={() => setIsRevealed(true)}
            className="flex min-h-[280px] w-full flex-col justify-between rounded-[2rem] border border-white/60 bg-white/95 p-6 text-left shadow-xl transition-all hover:bg-white sm:min-h-[340px] sm:p-8"
          >
            <div className="mb-5 flex w-full items-start justify-between">
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold tracking-wider text-slate-500 sm:px-2.5">
                {currentWord.explanation.hskLevel || 'Saved'}
              </span>
              {getReview(currentWord).streak > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs font-extrabold text-amber-600">
                  <Flame className="h-3.5 w-3.5 fill-current" />
                  <span>Streak {getReview(currentWord).streak}</span>
                </div>
              )}
            </div>

            <div className="my-auto flex flex-col items-center justify-center text-center">
              <h2 className="chinese text-5xl font-bold tracking-tight text-slate-800 sm:text-6xl">{currentWord.word}</h2>
              {isRevealed && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-lg font-bold text-slate-500">
                  {currentWord.explanation.pinyin}
                </motion.p>
              )}
            </div>

            <AnimatePresence>
              {!isRevealed ? (
                <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-2 text-sm font-bold text-violet-600">
                  <Eye className="h-4 w-4" /> Reveal details
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 w-full border-t border-slate-100 pt-6 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Meaning</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        readAloud(currentWord.word);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-2 text-lg font-semibold leading-relaxed text-slate-700">{currentWord.explanation.meaning}</p>
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
      ) : (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[1.5rem] bg-white p-5 text-center shadow-sm sm:p-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-500 mb-4">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">Queue completed!</h3>
          <p className="max-w-xs text-sm text-slate-500 mb-5">You've reviewed all words due for today. Keep up the amazing work!</p>
          <button onClick={onOpenNotebook} className="rounded-xl border border-violet-100 px-4 py-2 text-xs font-bold text-violet-600 transition-colors hover:bg-violet-50">
            Open Notebook
          </button>
        </div>
      )}
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
    <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/95 p-4 shadow-sm">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xl font-black text-slate-700">{value}</span>
      </div>
    </div>
  );
}
