import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Wand2, VolumeX, Volume2, Shuffle, BookMarked, Check } from 'lucide-react';
import InteractiveText from './InteractiveText';
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
  onAddToNotebook: (word: string, explanation: WordExplanation) => Promise<boolean>;
  onSavePassage: (text: string) => Promise<boolean>;
  onOpenReading: (text: string) => void;
  fadeVariants: any;
}

const STORY_PROMPTS = [
  { label: 'Trò chuyện', words: '朋友, 咖啡, 学习, 开心', level: 'HSK 2' },
  { label: 'Du lịch', words: '旅行, 火车站, 买票, 风景', level: 'HSK 3' },
  { label: 'Văn phòng', words: '会议, 同事, 计划, 完成', level: 'HSK 4' },
];

export default function CreatePage({
  createWords,
  setCreateWords,
  hskLevel,
  setHskLevel,
  createdText,
  setCreatedText,
  isGenerating,
  setIsGenerating,
  selectedModel,
  onAddToNotebook,
  onSavePassage,
  onOpenReading,
  fadeVariants,
}: CreatePageProps) {
  const handleGenerateText = async () => {
    setIsGenerating(true);
    setCreatedText('');
    const wordsArray = createWords.trim()
      ? createWords
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean)
      : [];
    const result = await generateChineseText(wordsArray, hskLevel, selectedModel);
    if (result) {
      setCreatedText(result);
    }
    setIsGenerating(false);
  };

  const btnPrimary =
    'flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-200/70 transition-all duration-300 hover:from-fuchsia-500 hover:via-violet-600 hover:to-indigo-600 hover:shadow-xl hover:shadow-violet-200 active:scale-[0.97] disabled:opacity-60 disabled:shadow-none disabled:active:scale-100';
  const btnSecondary =
    'flex min-w-0 items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white/90 px-5 py-3 text-sm font-medium text-violet-700 transition-all duration-300 hover:border-violet-200 hover:bg-violet-50 hover:shadow-sm active:scale-[0.97]';
  const cardClasses =
    'group relative overflow-hidden rounded-[1.25rem] border border-violet-50/80 bg-white/95 p-5 shadow-[0_2px_20px_rgba(139,92,246,0.06)] transition-all duration-500 hover:shadow-[0_10px_34px_rgba(139,92,246,0.13)] md:p-6';

  return (
    <motion.div
      key="create"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10"
    >
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">Trợ lý Sáng tạo</h1>
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
              <Shuffle className="h-4 w-4 text-violet-400" />
              {prompt.label}
            </button>
          ))}
        </div>

        <div
          className={`${cardClasses} !p-4 flex min-w-0 flex-col items-stretch gap-5 border-violet-100/50 bg-gradient-to-br from-white to-violet-50/50 sm:!p-6 md:flex-row md:items-end`}
        >
          <div className="min-w-0 flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-violet-400">
              Từ vựng mục tiêu (Tùy chọn)
            </label>
            <input
              type="text"
              value={createWords}
              onChange={(e) => setCreateWords(e.target.value)}
              placeholder="Để trống để ngẫu nhiên, hoặc VD: 旅游, 漂亮, 菜..."
              className="w-full rounded-xl border border-violet-100 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            />
          </div>
          <div className="w-full md:w-36">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-violet-400">
              Cấp độ
            </label>
            <select
              value={hskLevel}
              onChange={(e) => setHskLevel(e.target.value)}
              className="w-full rounded-xl border border-violet-100 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            >
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <option key={level} value={`HSK ${level}`}>
                  HSK {level}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerateText}
            disabled={isGenerating}
            className={`${btnPrimary} mt-2 w-full !py-3 md:mt-0 md:w-auto md:px-8`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Đang tạo...
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" /> Tạo truyện
              </>
            )}
          </button>
        </div>

        {createdText && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col items-start justify-between gap-3 px-1 md:flex-row md:items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-violet-400">Kết quả</h3>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap md:w-auto md:justify-end">
                <button
                  onClick={() => {
                    if (window.speechSynthesis) window.speechSynthesis.cancel();
                  }}
                  className={`${btnSecondary} flex-1 !rounded-full !px-3 !py-1.5 !text-xs md:flex-none`}
                >
                  <VolumeX className="h-4 w-4 text-slate-400" /> Dừng
                </button>
                <button
                  onClick={() => readAloud(createdText)}
                  className={`${btnSecondary} flex-1 !rounded-full !px-4 !py-1.5 !text-xs md:flex-none`}
                >
                  <Volume2 className="h-4 w-4 text-violet-500" /> Nghe
                </button>
                <button
                  onClick={() => onOpenReading(createdText)}
                  className={`${btnSecondary} col-span-2 !rounded-full !border-violet-200 !px-4 !py-1.5 !text-xs !text-violet-600 bg-violet-50 hover:bg-violet-100 sm:col-span-1 sm:flex-1 md:flex-none`}
                >
                  Mở trong Reading
                </button>
                <div className="col-span-2 flex justify-stretch sm:col-span-1">
                  <SavePassageButton text={createdText} onSave={onSavePassage} />
                </div>
              </div>
            </div>
            <div className={cardClasses}>
              <InteractiveText
                text={createdText}
                onAddToNotebook={onAddToNotebook}
                selectedModel={selectedModel}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function SavePassageButton({ text, onSave }: { text: string; onSave: (text: string) => Promise<boolean> }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(text);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saved || saving}
      className={`w-full flex min-w-0 items-center justify-center gap-2 !rounded-full !px-4 !py-1.5 !text-xs font-semibold border shadow-sm backdrop-blur-sm transition-all duration-300 active:scale-[0.97]
        ${
          saved
            ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-600'
            : 'border-violet-100 bg-white/50 text-violet-700 hover:border-violet-200 hover:bg-violet-50'
        }`}
    >
      {saving ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
        </>
      ) : saved ? (
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
