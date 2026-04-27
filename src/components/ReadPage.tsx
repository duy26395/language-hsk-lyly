import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, ClipboardPaste, VolumeX, Volume2 } from 'lucide-react';
import InteractiveText from './InteractiveText';
import { WordExplanation, readAloud, AIModel } from '../lib/ai';

interface ReadPageProps {
  readInput: string;
  setReadInput: (val: string) => void;
  readText: string;
  setReadText: (val: string) => void;
  selectedModel: AIModel;
  onAddToNotebook: (word: string, explanation: WordExplanation) => void;
  fadeVariants: any;
}

const QUICK_READS = [
  '今天我和朋友去咖啡店学习中文。我们一边喝茶, 一边练习新的词语。',
  '小明每天早上七点起床。他喜欢跑步, 然后吃一个简单的早餐。',
  '周末我想去图书馆看书。如果天气好, 我还会去公园散步。',
];

export default function ReadPage({ 
  readInput, setReadInput, readText, setReadText, 
  selectedModel, onAddToNotebook, fadeVariants 
}: ReadPageProps) {
  
  const btnPrimary = "flex min-w-0 items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 hover:from-fuchsia-500 hover:via-violet-600 hover:to-indigo-600 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-violet-200/70 hover:shadow-xl hover:shadow-violet-200 transition-all duration-300 active:scale-[0.97] disabled:opacity-60 disabled:shadow-none disabled:active:scale-100";
  const btnSecondary = "flex min-w-0 items-center justify-center gap-2 px-5 py-3 bg-white/90 border border-violet-100 text-violet-700 rounded-xl font-medium text-sm hover:bg-violet-50 hover:border-violet-200 hover:shadow-sm transition-all duration-300 active:scale-[0.97]";
  const textAreaClasses = "w-full bg-white/95 border border-violet-100 rounded-[1.25rem] p-5 text-[17px] leading-relaxed text-slate-700 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 shadow-sm transition-all duration-300 resize-none";
  const cardClasses = "bg-white/95 rounded-[1.25rem] p-5 md:p-6 shadow-[0_2px_20px_rgba(139,92,246,0.06)] border border-violet-50/80 hover:shadow-[0_10px_34px_rgba(139,92,246,0.13)] transition-all duration-500 relative overflow-hidden group";

  return (
    <motion.div key="read" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Reading Area</h1>
        {readText && (
          <button onClick={() => setReadText('')} className="text-sm font-semibold text-violet-400 hover:text-violet-600 transition-colors px-3 py-2 rounded-lg hover:bg-violet-50">
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
            className={`${textAreaClasses} flex-1 min-h-[300px] md:min-h-[400px] shadow-sm`}
          />
          <div className="flex min-w-0 flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-violet-400">
              <Sparkles className="w-3.5 h-3.5" /> Quick start
            </span>
            {QUICK_READS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setReadInput(sample)}
                className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98]"
              >
                <ClipboardPaste className="w-4 h-4 text-violet-400" />
                Sample {idx + 1}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setReadText(readInput)}
            className={`${btnPrimary} self-stretch md:self-end md:w-auto md:px-8`}
          >
            Start Learning <BookOpen className="w-4 h-4 ml-1" />
          </button>
        </div>
      ) : (
        <div className="relative flex min-w-0 flex-1 flex-col gap-4">
          <div className="mb-1 flex flex-wrap justify-end gap-2">
            <button onClick={() => {
              if (window.speechSynthesis) window.speechSynthesis.cancel();
            }} className={`${btnSecondary} !py-2 !px-4 !rounded-full !text-xs !bg-white/50 backdrop-blur-sm shadow-sm`}>
              <VolumeX className="w-4 h-4 text-slate-400" /> Stop
            </button>
            <button onClick={() => readAloud(readText)} className={`${btnSecondary} !py-2 !px-4 !rounded-full !text-xs !bg-white/50 backdrop-blur-sm shadow-sm`}>
              <Volume2 className="w-4 h-4 text-violet-500" /> Listen All
            </button>
          </div>
          <div className={`${cardClasses} flex-1`}>
            <InteractiveText text={readText} onAddToNotebook={onAddToNotebook} selectedModel={selectedModel} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
