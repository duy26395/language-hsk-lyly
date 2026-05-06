import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  CircleAlert,
  CircleCheck,
  Cloud,
  FileText,
  LibraryBig,
  Loader2,
  NotebookPen,
  Printer,
  Search,
  Trash2,
  Type,
} from 'lucide-react';
import { SavedNoteEntry, SavedPassageEntry, SavedWordEntry } from './StudyDeck';

interface NotebookPageProps {
  noteContent: string;
  setNoteContent: (val: string) => void;
  savedNotes: SavedNoteEntry[];
  handleRemoveSavedNote: (id: string) => Promise<boolean>;
  savedWords: SavedWordEntry[];
  handleRemoveWord: (word: string) => Promise<boolean>;
  savedPassages: SavedPassageEntry[];
  handleRemovePassage: (id: string) => Promise<boolean>;
  onOpenPassage: (text: string) => void;
  isSyncing: boolean;
  isSavingNote: boolean;
  notebookToast: { type: 'success' | 'error'; title: string; message: string } | null;
  lastSynced: number | null;
  saveToServer: (
    words: SavedWordEntry[],
    passages?: SavedPassageEntry[],
    notes?: SavedNoteEntry[],
    options?: { showToast?: boolean; successMessage?: string; errorMessage?: string },
  ) => Promise<boolean>;
  onSaveNotes: () => void;
  handlePrint: () => void;
  fadeVariants: any;
}

type NotebookFilter = 'all' | 'words' | 'passages' | 'notes';

type NotebookTimelineItem =
  | { id: string; type: 'word'; savedAt: number; word: SavedWordEntry }
  | { id: string; type: 'passage'; savedAt: number; passage: SavedPassageEntry }
  | { id: string; type: 'note'; savedAt: number; note: SavedNoteEntry };

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayLabel(ts: number) {
  return new Date(ts).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function dayKey(ts: number) {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWordSearchText(item: SavedWordEntry) {
  return [
    item.word,
    item.explanation.pinyin,
    item.explanation.meaning,
    item.explanation.example,
    item.explanation.exampleMeaning,
    item.explanation.hskLevel,
  ]
    .join(' ')
    .toLowerCase();
}

function getPassageSearchText(item: SavedPassageEntry) {
  return [item.text, item.source ?? ''].join(' ').toLowerCase();
}

function getNoteSearchText(item: SavedNoteEntry) {
  return item.content.toLowerCase();
}

export default function NotebookPage({
  noteContent,
  setNoteContent,
  savedNotes,
  handleRemoveSavedNote,
  savedWords,
  handleRemoveWord,
  savedPassages,
  handleRemovePassage,
  onOpenPassage,
  isSyncing,
  isSavingNote,
  notebookToast,
  lastSynced,
  saveToServer,
  onSaveNotes,
  handlePrint,
  fadeVariants,
}: NotebookPageProps) {
  const [activeFilter, setActiveFilter] = useState<NotebookFilter>('all');
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const timelineItems: NotebookTimelineItem[] = (() => {
    const wordItems = savedWords.map((word, index) => ({
      id: `word-${word.word}-${index}`,
      type: 'word' as const,
      savedAt: word.savedAt ?? 0,
      word,
    }));

    const passageItems = savedPassages.map((passage) => ({
      id: `passage-${passage.id}`,
      type: 'passage' as const,
      savedAt: passage.savedAt,
      passage,
    }));

    const noteItems = savedNotes.map((note) => ({
      id: `note-${note.id}`,
      type: 'note' as const,
      savedAt: note.savedAt,
      note,
    }));

    return [...wordItems, ...passageItems, ...noteItems].sort((a, b) => b.savedAt - a.savedAt);
  })();

  const filteredTimeline = timelineItems.filter((item) => {
    if (activeFilter === 'words' && item.type !== 'word') return false;
    if (activeFilter === 'passages' && item.type !== 'passage') return false;
    if (activeFilter === 'notes' && item.type !== 'note') return false;
    if (!normalizedQuery) return true;

    if (item.type === 'word') {
      return getWordSearchText(item.word).includes(normalizedQuery);
    }

    if (item.type === 'note') {
      return getNoteSearchText(item.note).includes(normalizedQuery);
    }

    return getPassageSearchText(item.passage).includes(normalizedQuery);
  });

  const groups = new Map<string, { label: string; items: NotebookTimelineItem[]; sortTs: number }>();

  for (const item of filteredTimeline) {
    const stamp = item.savedAt > 0 ? item.savedAt : 1;
    const key = item.savedAt > 0 ? dayKey(item.savedAt) : 'older';
    const label = item.savedAt > 0 ? formatDayLabel(item.savedAt) : 'Saved before date tracking';
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      existing.sortTs = Math.max(existing.sortTs, stamp);
      continue;
    }

    groups.set(key, { label, items: [item], sortTs: stamp });
  }

  const groupedTimeline = Array.from(groups.entries())
    .sort((a, b) => b[1].sortTs - a[1].sortTs)
    .map(([key, value]) => ({ key, ...value }));

  const notesCount = noteContent.trim().length;
  const savedNotesCount = savedNotes.length;
  const visibleWords = filteredTimeline.filter((item) => item.type === 'word').length;
  const visiblePassages = filteredTimeline.filter((item) => item.type === 'passage').length;
  const visibleNotes = filteredTimeline.filter((item) => item.type === 'note').length;

  const btnSecondary =
    'inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-violet-100 bg-white/90 px-4 py-3 text-sm font-semibold text-violet-700 transition-all duration-300 hover:border-violet-200 hover:bg-violet-50 hover:shadow-sm active:scale-[0.98]';
  const panelClass =
    'rounded-[1.5rem] border border-white/70 bg-white/92 shadow-[0_10px_40px_rgba(76,29,149,0.06)] backdrop-blur-sm';

  return (
    <motion.div
      key="notebook"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 p-4 print:bg-white print:p-0 sm:p-5 md:gap-6 md:p-10"
    >
      <AnimatePresence>
        {notebookToast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="fixed right-4 top-4 z-[140] w-[calc(100vw-2rem)] max-w-sm sm:right-6 sm:top-6"
            role="status"
            aria-live="polite"
          >
            <div
              className={`flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.18)] ${
                notebookToast.type === 'success'
                  ? 'border-emerald-100 text-emerald-700'
                  : 'border-rose-100 text-rose-700'
              }`}
            >
              {notebookToast.type === 'success' ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-black">
                  {notebookToast.title}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-600">{notebookToast.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="overflow-hidden rounded-[2rem] border border-violet-100/70 bg-[radial-gradient(circle_at_top_left,_rgba(196,181,253,0.35),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(245,243,255,0.98))] p-5 shadow-[0_20px_60px_rgba(109,40,217,0.10)] print:shadow-none sm:p-6 md:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-violet-500">
                <NotebookPen className="h-3.5 w-3.5" />
                My Notebook
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                All your saved words, passages, and notes in one workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
                Data is still saved by day in the backend, but here we surface everything together so users can search,
                scan, review, and reopen content faster.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <button
                onClick={() => {
                  void saveToServer(savedWords, savedPassages, savedNotes, {
                    successMessage: 'Notebook synced successfully.',
                    errorMessage: 'Could not sync notebook. Please try again.',
                  });
                }}
                disabled={isSyncing || (savedWords.length === 0 && savedPassages.length === 0)}
                className={`${btnSecondary} ${isSyncing ? 'opacity-70' : ''}`}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : lastSynced && Date.now() - lastSynced < 5000 ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Cloud className="h-4 w-4 text-violet-500" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync data'}
              </button>
              <button onClick={handlePrint} className={btnSecondary}>
                <Printer className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard icon={Type} label="Saved words" value={savedWords.length} tone="violet" />
            <OverviewCard icon={FileText} label="Saved passages" value={savedPassages.length} tone="sky" />
            <OverviewCard icon={LibraryBig} label="Saved notes" value={savedNotesCount} tone="rose" />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="min-w-0 space-y-5">
          <div className={`${panelClass} p-4 sm:p-5`}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-400">Library view</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Everything saved, organized for quick action</h2>
                </div>

                <div className="inline-flex w-full max-w-full items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-500 lg:max-w-sm">
                  <Search className="h-4 w-4 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search words, pinyin, meaning, or passages"
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    active={activeFilter === 'all'}
                    label={`All (${filteredTimeline.length})`}
                    onClick={() => setActiveFilter('all')}
                  />
                  <FilterChip
                    active={activeFilter === 'words'}
                    label={`Words (${visibleWords})`}
                    onClick={() => setActiveFilter('words')}
                  />
                  <FilterChip
                    active={activeFilter === 'passages'}
                    label={`Passages (${visiblePassages})`}
                    onClick={() => setActiveFilter('passages')}
                  />
                  <FilterChip
                    active={activeFilter === 'notes'}
                    label={`Notes (${visibleNotes})`}
                    onClick={() => setActiveFilter('notes')}
                  />
                </div>
                <p className="text-sm text-slate-500">
                  Grouped by save day for new content, while still showing your full notebook together.
                </p>
              </div>
            </div>
          </div>

          {groupedTimeline.length === 0 ? (
            <div className={`${panelClass} flex flex-col items-center justify-center px-6 py-16 text-center`}>
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-violet-50 text-violet-500">
                <BookOpen className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-slate-900">No matching items</h3>
              <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
                Try another keyword, or save more words and reading passages to build your notebook.
              </p>
            </div>
          ) : (
            groupedTimeline.map((group) => (
              <section key={group.key} className="space-y-3">
                <div className="flex items-center gap-3 px-1">
                  <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-violet-400">{group.label}</h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-violet-100 to-transparent" />
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                    {group.items.length} items
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items.map((item) =>
                    item.type === 'word' ? (
                      <WordCard
                        key={item.id}
                        item={item.word}
                        savedAt={item.savedAt}
                        onRemove={handleRemoveWord}
                        onOpenPassage={onOpenPassage}
                      />
                    ) : item.type === 'passage' ? (
                      <PassageCard
                        key={item.id}
                        item={item.passage}
                        onOpenPassage={onOpenPassage}
                        onRemove={handleRemovePassage}
                      />
                    ) : (
                      <SavedNoteCard
                        key={item.id}
                        item={item.note}
                        onRemove={handleRemoveSavedNote}
                        onOpenPassage={onOpenPassage}
                      />
                    ),
                  )}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="space-y-5">
          <div className={`${panelClass} p-5 sm:p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">Personal notes</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Scratchpad for what you want to remember</h2>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-600">{notesCount} chars</div>
            </div>

            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your notes here..."
              className="mt-4 min-h-[260px] w-full resize-none rounded-[1.5rem] border border-amber-100 bg-amber-50/60 p-4 text-[15px] leading-7 text-slate-700 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-amber-300 focus:ring-4 focus:ring-amber-200/40"
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-500">
                Keep quick mnemonics, grammar reminders, or examples you want to revisit while studying.
              </p>
              <button
                onClick={onSaveNotes}
                disabled={isSavingNote || !noteContent.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-200 transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.98]"
              >
                {isSavingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                {isSavingNote ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </aside>
      </section>
    </motion.div>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'violet' | 'sky' | 'amber' | 'emerald' | 'rose';
}) {
  const toneMap = {
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
  } as const;

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-sm">
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
        active
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
          : 'border border-violet-100 bg-white text-violet-600 hover:bg-violet-50'
      }`}
    >
      {label}
    </button>
  );
}

function WordCard({
  item,
  savedAt,
  onRemove,
  onOpenPassage,
}: {
  item: SavedWordEntry;
  savedAt: number;
  onRemove: (word: string) => Promise<boolean>;
  onOpenPassage: (text: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-violet-100/70 bg-white/95 shadow-[0_8px_30px_rgba(109,40,217,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_14px_34px_rgba(109,40,217,0.12)]">
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={`chinese break-words font-black tracking-wide text-slate-900 ${item.word.length > 15 ? 'text-2xl' : 'text-3xl'}`}>
                {item.word}
              </span>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">{item.explanation.hskLevel}</span>
              {savedAt > 0 && (
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">{formatDateTime(savedAt)}</span>
              )}
            </div>
            <p className="mt-2 text-base font-semibold text-violet-600">{item.explanation.pinyin}</p>
          </div>

          <button
            onClick={async () => {
              setRemoving(true);
              await onRemove(item.word);
              setRemoving(false);
            }}
            disabled={removing}
            className="rounded-full p-2 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Remove word"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>

        <p className="text-[15px] font-semibold leading-7 text-slate-700">{item.explanation.meaning}</p>

        <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50/90 p-4">
          <p className="chinese text-slate-800">{item.explanation.example}</p>
          <p className="mt-2 text-sm italic text-slate-500">{item.explanation.exampleMeaning}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            Ready to reopen in Reading
          </div>
          <button
            onClick={() => onOpenPassage(item.word)}
            className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-[0.98]"
          >
            <BookOpen className="h-4 w-4" />
            Open
          </button>
        </div>
      </div>
    </article>
  );
}

function PassageCard({
  item,
  onOpenPassage,
  onRemove,
}: {
  item: SavedPassageEntry;
  onOpenPassage: (text: string) => void;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [removing, setRemoving] = useState(false);

  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-sky-100/80 bg-white/95 shadow-[0_8px_30px_rgba(2,132,199,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_14px_34px_rgba(2,132,199,0.12)]">
      <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400" />
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                {item.source === 'create' ? 'AI Generated' : 'Reading'}
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">{formatDateTime(item.savedAt)}</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">Length {item.text.replace(/\s/g, '').length} characters</p>
          </div>

          <button
            onClick={async () => {
              setRemoving(true);
              await onRemove(item.id);
              setRemoving(false);
            }}
            disabled={removing}
            className="rounded-full p-2 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Remove passage"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>

        <p className="chinese text-[15px] leading-8 text-slate-700 line-clamp-5">{item.text}</p>

        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            Ready to reopen in Reading
          </div>
          <button
            onClick={() => onOpenPassage(item.text)}
            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-200 transition-all hover:bg-sky-700 active:scale-[0.98]"
          >
            <BookOpen className="h-4 w-4" />
            Open
          </button>
        </div>
      </div>
    </article>
  );
}

function SavedNoteCard({
  item,
  onRemove,
  onOpenPassage,
}: {
  item: SavedNoteEntry;
  onRemove: (id: string) => Promise<boolean>;
  onOpenPassage: (text: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-rose-100/80 bg-white/95 shadow-[0_8px_30px_rgba(244,63,94,0.07)]">
      <div className="h-1 w-full bg-gradient-to-r from-rose-400 via-amber-300 to-fuchsia-400" />
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Personal Note</span>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
              {item.savedAt > 0 ? formatDateTime(item.savedAt) : 'Saved'}
            </span>
          </div>
          <button
            onClick={async () => {
              setRemoving(true);
              await onRemove(item.id);
              setRemoving(false);
            }}
            disabled={removing}
            className="rounded-full p-2 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Remove note"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{item.content}</p>
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            Ready to reopen in Reading
          </div>
          <button
            onClick={() => onOpenPassage(item.content)}
            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-700 active:scale-[0.98]"
          >
            <BookOpen className="h-4 w-4" />
            Open
          </button>
        </div>
      </div>
    </article>
  );
}
