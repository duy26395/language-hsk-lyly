import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Wand2, VolumeX, Volume2, Shuffle } from 'lucide-react';
import InteractiveText from './InteractiveText';
import WordModal from './WordModal';
import { WordExplanation, readAloud, AIModel, generateChineseText } from '../lib/ai';

interface CreatePageProps {
  createWords: string;
  setCreateWords: (val: string) => void;
  hskLevel: string;
  setHskLevel: (val: string) => void;
  createdText: string;
  setCreatedText: (val: string) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  selectedModel: AIModel;
  onAddToNotebook: (word: string, explanation: WordExplanation) => void;
  onOpenReading: (text: string) => void;
  fadeVariants: any;
}

const STORY_PROMPTS = [
  { label: 'Trò chuyện', words: '朋友, 咖啡, 学习, 开心', level: 'HSK 2' },
  { label: 'Du lịch', words: '旅行, 火车站, 买票, 风景', level: 'HSK 3' },
  { label: 'Văn phòng', words: '会议, 同事, 计划, 完成', level: 'HSK 4' },
];

export default function CreatePage({
  createWords, setCreateWords, hskLevel, setHskLevel,
  createdText, setCreatedText, isGenerating, setIsGenerating,
  selectedModel, onAddToNotebook, onOpenReading, fadeVariants
}: CreatePageProps) {

  const handleGenerateText = async () => {
    setIsGenerating(true);
    setCreatedText('');
    const wordsArray = createWords.trim() ? createWords.split(',').map(w => w.trim()).filter(Boolean) : [];
    const result = await generateChineseText(wordsArray, hskLevel, selectedModel);
    if (result) {
      setCreatedText(result);
    }
    setIsGenerating(false);
  };

  const btnPrimary = "flex min-w-0 items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 hover:from-fuchsia-500 hover:via-violet-600 hover:to-indigo-600 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-violet-200/70 hover:shadow-xl hover:shadow-violet-200 transition-all duration-300 active:scale-[0.97] disabled:opacity-60 disabled:shadow-none disabled:active:scale-100";
  const btnSecondary = "flex min-w-0 items-center justify-center gap-2 px-5 py-3 bg-white/90 border border-violet-100 text-violet-700 rounded-xl font-medium text-sm hover:bg-violet-50 hover:border-violet-200 hover:shadow-sm transition-all duration-300 active:scale-[0.97]";
  const cardClasses = "bg-white/95 rounded-[1.25rem] p-5 md:p-6 shadow-[0_2px_20px_rgba(139,92,246,0.06)] border border-violet-50/80 hover:shadow-[0_10px_34px_rgba(139,92,246,0.13)] transition-all duration-500 relative overflow-hidden group";

  return (
    <motion.div key="create" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Trợ lý Sáng tạo</h1>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex min-w-0 flex-wrap gap-2">
          {STORY_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => {
                setCreateWords(prompt.words);
                setHskLevel(prompt.level);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98]"
            >
              <Shuffle className="w-4 h-4 text-violet-400" />
              {prompt.label}
            </button>
          ))}
        </div>

        <div className={`${cardClasses} !p-4 sm:!p-6 flex min-w-0 flex-col gap-5 items-stretch md:flex-row md:items-end bg-gradient-to-br from-white to-violet-50/50 border-violet-100/50`}>
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-bold text-violet-400 mb-2 uppercase tracking-wider">Từ vựng mục tiêu (Tùy chọn)</label>
            <input
              type="text"
              value={createWords}
              onChange={(e) => setCreateWords(e.target.value)}
              placeholder="Để trống để ngẫu nhiên, hoặc VD: 旅游, 漂亮, 菜..."
              className="w-full rounded-xl border border-violet-100 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            />
          </div>
          <div className="w-full md:w-36">
            <label className="block text-xs font-bold text-violet-400 mb-2 uppercase tracking-wider">Cấp độ</label>
            <select 
              value={hskLevel}
              onChange={(e) => setHskLevel(e.target.value)}
              className="w-full rounded-xl border border-violet-100 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            >
              {[1,2,3,4,5,6].map(level => (
                <option key={level} value={`HSK ${level}`}>HSK {level}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleGenerateText}
            disabled={isGenerating}
            className={`${btnPrimary} !py-3 w-full md:w-auto mt-2 md:mt-0 md:px-8`}
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</>
            ) : (
              <><Wand2 className="w-5 h-5" /> Tạo Truyện</>
            )}
          </button>
        </div>

        {createdText && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-1">
              <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest">Kết quả</h3>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap md:w-auto md:justify-end">
                <button onClick={() => {
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                }} className={`${btnSecondary} !py-1.5 !px-3 !rounded-full !text-xs flex-1 md:flex-none`}>
                  <VolumeX className="w-4 h-4 text-slate-400" /> Dừng
                </button>
                <button onClick={() => readAloud(createdText)} className={`${btnSecondary} !py-1.5 !px-4 !rounded-full !text-xs flex-1 md:flex-none`}>
                  <Volume2 className="w-4 h-4 text-violet-500" /> Nghe
                </button>
                <button onClick={() => onOpenReading(createdText)} className={`${btnSecondary} !py-1.5 !px-4 !rounded-full !text-xs col-span-2 sm:col-span-1 sm:flex-1 md:flex-none !text-violet-600 !border-violet-200 bg-violet-50 hover:bg-violet-100`}>
                  Mở trong Reading
                </button>
              </div>
            </div>
            <div className={`${cardClasses}`}>
              <InteractiveText text={createdText} onAddToNotebook={onAddToNotebook} selectedModel={selectedModel} />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
