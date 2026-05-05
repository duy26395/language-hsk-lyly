import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Sparkles,
  ClipboardPaste,
  VolumeX,
  Volume2,
  BookMarked,
  Check,
} from 'lucide-react';
import InteractiveText from './InteractiveText';
import { WordExplanation, readAloud, AIModel } from '../lib/ai';

interface ReadPageProps {
  readInput: string;
  setReadInput: (val: string) => void;
  readText: string;
  setReadText: (val: string) => void;
  selectedModel: AIModel;
  onAddToNotebook: (word: string, explanation: WordExplanation) => void;
  onSavePassage: (text: string) => void;
  fadeVariants: any;
}

const QUICK_READS = [
  '今天我和朋友去咖啡店学习中文。我们一边喝茶，一边练习新的词语。',
  '小明每天早上七点起床。他喜欢跑步，然后吃一个简单的早餐。',
  '周末我想去图书馆看书。如果天气好，我还会去公园散步。',
];

export default function ReadPage({
  readInput,
  setReadInput,
  readText,
  setReadText,
  selectedModel,
  onAddToNotebook,
  onSavePassage,
  fadeVariants,
}: ReadPageProps) {
  const btnPrimary =
    'flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-200/70 transition-all duration-300 hover:from-fuchsia-500 hover:via-violet-600 hover:to-indigo-600 hover:shadow-xl hover:shadow-violet-200 active:scale-[0.97] disabled:opacity-60 disabled:shadow-none disabled:active:scale-100';
  const btnSecondary =
    'flex min-w-0 items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white/90 px-5 py-3 text-sm font-medium text-violet-700 transition-all duration-300 hover:border-violet-200 hover:bg-violet-50 hover:shadow-sm active:scale-[0.97]';
  const textAreaClasses =
    'w-full resize-none rounded-[1.25rem] border border-violet-100 bg-white/95 p-5 text-[17px] leading-relaxed text-slate-700 shadow-sm transition-all duration-300 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10';
  const cardClasses =
    'group relative overflow-hidden rounded-[1.25rem] border border-violet-50/80 bg-white/95 p-5 shadow-[0_2px_20px_rgba(139,92,246,0.06)] transition-all duration-500 hover:shadow-[0_10px_34px_rgba(139,92,246,0.13)] md:p-6';

  return (
    <motion.div
      key="read"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10"
    >
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">Reading Area</h1>
        {readText && (
          <button
            onClick={() => setReadText('')}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
          >
            Clear
          </button>
        )}
      </div>

      {!readText ? (
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <textarea
            value={readInput}
            onChange={(e) => setReadInput(e.target.value)}
            placeholder="Paste your Chinese text here..."
            className={`${textAreaClasses} min-h-[300px] flex-1 shadow-sm md:min-h-[400px]`}
          />
          <div className="flex min-w-0 flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-violet-400">
              <Sparkles className="h-3.5 w-3.5" /> Quick start
            </span>
            {QUICK_READS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setReadInput(sample)}
                className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98]"
              >
                <ClipboardPaste className="h-4 w-4 text-violet-400" />
                Sample {idx + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setReadText(readInput)}
            className={`${btnPrimary} self-stretch md:w-auto md:self-end md:px-8`}
          >
            Start Learning <BookOpen className="ml-1 h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative flex min-w-0 flex-1 flex-col gap-4">
          <div className="mb-1 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
              }}
              className={`${btnSecondary} !rounded-full !bg-white/50 !px-4 !py-2 !text-xs shadow-sm backdrop-blur-sm`}
            >
              <VolumeX className="h-4 w-4 text-slate-400" /> Stop
            </button>
            <button
              onClick={() => readAloud(readText)}
              className={`${btnSecondary} !rounded-full !bg-white/50 !px-4 !py-2 !text-xs shadow-sm backdrop-blur-sm`}
            >
              <Volume2 className="h-4 w-4 text-violet-500" /> Listen All
            </button>
            <SavePassageButton text={readText} onSave={onSavePassage} />
          </div>
          <div className={`${cardClasses} flex-1`}>
            <InteractiveText
              text={readText}
              onAddToNotebook={onAddToNotebook}
              selectedModel={selectedModel}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SavePassageButton({ text, onSave }: { text: string; onSave: (text: string) => void }) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <button
      onClick={handleSave}
      disabled={saved}
      className={`flex min-w-0 items-center justify-center gap-2 !rounded-full !px-4 !py-2 !text-xs font-semibold border shadow-sm backdrop-blur-sm transition-all duration-300 active:scale-[0.97]
        ${
          saved
            ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-600'
            : 'border-violet-100 bg-white/50 text-violet-700 hover:border-violet-200 hover:bg-violet-50'
        }`}
    >
      {saved ? (
        <>
          <Check className="h-4 w-4" /> Đã lưu!
        </>
      ) : (
        <>
          <BookMarked className="h-4 w-4 text-violet-500" /> Lưu đoạn văn
        </>
      )}
    </button>
  );
}
