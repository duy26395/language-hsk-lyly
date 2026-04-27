import React from 'react';
import { motion } from 'framer-motion';
import { Printer, Loader2, Check, Cloud, Book, Trash2 } from 'lucide-react';
import { SavedWordEntry } from './StudyDeck';

interface NotebookPageProps {
  noteContent: string;
  setNoteContent: (val: string) => void;
  savedWords: SavedWordEntry[];
  handleRemoveWord: (word: string) => void;
  isSyncing: boolean;
  lastSynced: number | null;
  saveToServer: (words: SavedWordEntry[]) => void;
  handlePrint: () => void;
  formatReviewDue: (dueAt: number) => string;
  fadeVariants: any;
}

export default function NotebookPage({
  noteContent, setNoteContent, savedWords, handleRemoveWord,
  isSyncing, lastSynced, saveToServer, handlePrint, formatReviewDue, fadeVariants
}: NotebookPageProps) {

  const btnSecondary = "flex min-w-0 items-center justify-center gap-2 px-5 py-3 bg-white/90 border border-violet-100 text-violet-700 rounded-xl font-medium text-sm hover:bg-violet-50 hover:border-violet-200 hover:shadow-sm transition-all duration-300 active:scale-[0.97]";
  const textAreaClasses = "w-full bg-white/95 border border-violet-100 rounded-[1.25rem] p-5 text-[17px] leading-relaxed text-slate-700 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 shadow-sm transition-all duration-300 resize-none";
  const cardClasses = "bg-white/95 rounded-[1.25rem] p-5 md:p-6 shadow-[0_2px_20px_rgba(139,92,246,0.06)] border border-violet-50/80 hover:shadow-[0_10px_34px_rgba(139,92,246,0.13)] transition-all duration-500 relative overflow-hidden group";

  return (
    <motion.div key="notebook" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 p-4 print:bg-white print:p-0 sm:p-5 md:gap-6 md:p-10">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">My Notebook</h1>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <button 
            onClick={() => saveToServer(savedWords)} 
            disabled={isSyncing || savedWords.length === 0}
            className={`${btnSecondary} !py-2 !px-3 !rounded-full text-xs font-semibold sm:!px-5 ${isSyncing ? 'opacity-70' : ''}`}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : lastSynced && (Date.now() - lastSynced < 5000) ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Cloud className="w-4 h-4 text-violet-500" />
            )}
            {isSyncing ? 'Syncing...' : 'Save to JSON'}
          </button>
          <button onClick={handlePrint} className={`${btnSecondary} !py-2 !px-3 !rounded-full text-xs font-semibold sm:!px-5`}>
            <Printer className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 print:block print:w-full lg:grid-cols-2 lg:gap-8">
        {/* Notes */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-widest text-violet-400 font-bold px-1 print:text-black">Personal Notes</h2>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Write your notes here..."
            className={`${textAreaClasses} flex-1 min-h-[300px] print:border-none print:p-0 print:h-auto overflow-hidden bg-amber-50/30 border-amber-100/50 focus:border-amber-300 focus:ring-amber-400/20`}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
        </div>

        {/* Saved Words */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-widest text-violet-400 font-bold px-1 print:text-black">Saved Words ({savedWords.length})</h2>
          {savedWords.length === 0 ? (
            <div className={`${cardClasses} flex flex-col items-center justify-center text-center py-16 bg-white/50 border-dashed border-2 border-violet-100 shadow-none`}>
              <Book className="w-12 h-12 text-violet-200 mb-3" strokeWidth={1} />
              <p className="text-slate-500 font-medium">No saved words yet.</p>
              <p className="text-sm text-slate-400 mt-1">Scan words in the Reading tab to save them here!</p>
            </div>
          ) : (
             <div className="flex flex-col gap-4">
               {savedWords.map((item, idx) => (
                 <div key={idx} className={`${cardClasses} !p-4 format-avoid-break print:border-b print:border-slate-300 print:mb-4 hover:border-violet-200 transition-colors sm:!p-5`}>
                   {/* Border accent */}
                   <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-400 to-violet-500 rounded-l-2xl"></div>
                   
                   <div className="mb-3 ml-2 flex min-w-0 flex-wrap items-baseline gap-2 pr-8 sm:gap-3">
                     <span className="chinese break-words text-3xl font-bold tracking-wide text-slate-800">{item.word}</span>
                     <span className="break-words font-medium text-violet-500">{item.explanation.pinyin}</span>
                     <span className="rounded-md border border-violet-100/50 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-600 shadow-sm">
                       {item.explanation.hskLevel}
                     </span>
                   </div>
                   <div className="ml-2 mb-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider">
                     <span className={`rounded-full px-2.5 py-1 ${((item.review?.dueAt ?? Date.now()) <= Date.now()) ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                       {formatReviewDue(item.review?.dueAt ?? Date.now())}
                     </span>
                     <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-500">
                       Streak {item.review?.streak ?? 0}
                     </span>
                   </div>
                   <div className="text-[15px] text-slate-700 mb-3 font-semibold leading-relaxed ml-2">
                     {item.explanation.meaning}
                   </div>
                   <div className="ml-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-500 shadow-inner sm:p-4">
                     <strong className="text-slate-600">Ex:</strong> <span className="chinese text-slate-700">{item.explanation.example}</span> <br/>
                     <span className="italic opacity-90 mt-1 inline-block text-violet-600/70">{item.explanation.exampleMeaning}</span>
                   </div>
                   <button 
                    onClick={() => handleRemoveWord(item.word)}
                    className="absolute top-3 right-3 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-100 transition-all print:hidden sm:top-4 sm:right-4 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
