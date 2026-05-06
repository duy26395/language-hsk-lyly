import { useEffect, useRef, useState } from 'react';
import QuizWizard from './components/QuizWizard';
import StudyDeck, {
  ReviewGrade,
  SavedNoteEntry,
  SavedPassageEntry,
  SavedWordEntry,
  WordReview,
} from './components/StudyDeck';
import { WordExplanation, AIModel } from './lib/ai';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Mic, ShieldCheck, Smartphone, X } from 'lucide-react';

import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ReadPage from './components/ReadPage';
import CreatePage from './components/CreatePage';
import NotebookPage from './components/NotebookPage';
import SearchPage from './components/SearchPage';
import SpeakingPage from './components/SpeakingPage';
import AIChatPage from './components/AIChatPage';

const softEase = [0.22, 1, 0.36, 1] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const createInitialReview = (): WordReview => ({
  dueAt: Date.now(),
  intervalDays: 0,
  ease: 2.5,
  lapses: 0,
  streak: 0,
});

const normalizeSavedWord = (item: SavedWordEntry): SavedWordEntry => ({
  ...item,
  savedAt: item.savedAt,
  review: {
    ...createInitialReview(),
    ...item.review,
  },
});

const scheduleReview = (
  currentReview: WordReview | undefined,
  grade: ReviewGrade,
): WordReview => {
  const now = Date.now();
  const review = { ...createInitialReview(), ...currentReview };
  const ease = review.ease || 2.5;
  let nextEase = ease;
  let intervalDays = review.intervalDays || 0;
  let streak = review.streak || 0;
  let lapses = review.lapses || 0;
  let dueAt = now;

  if (grade === 'again') {
    nextEase = Math.max(1.3, ease - 0.2);
    intervalDays = 0;
    streak = 0;
    lapses += 1;
    dueAt = now + 10 * 60 * 1000;
  }

  if (grade === 'hard') {
    nextEase = Math.max(1.3, ease - 0.05);
    intervalDays = Math.max(1, Math.ceil(Math.max(1, intervalDays) * 1.2));
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  if (grade === 'good') {
    intervalDays = intervalDays <= 0 ? 1 : Math.ceil(intervalDays * nextEase);
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  if (grade === 'easy') {
    nextEase = Math.min(3.2, ease + 0.15);
    intervalDays = intervalDays <= 0 ? 3 : Math.ceil(intervalDays * (nextEase + 0.7));
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  return {
    dueAt,
    intervalDays,
    ease: nextEase,
    lapses,
    streak,
    lastReviewedAt: now,
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'search' | 'read' | 'create' | 'study' | 'quiz' | 'notebook' | 'speaking' | 'chat'
  >('search');
  const [selectedModel, setSelectedModel] = useState<AIModel>('qwen/qwen3-32b');
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceNotice, setShowVoiceNotice] = useState(false);

  const [readInput, setReadInput] = useState('');
  const [readText, setReadText] = useState('');
  const [createWords, setCreateWords] = useState('');
  const [hskLevel, setHskLevel] = useState('HSK 3');
  const [createdText, setCreatedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [noteContent, setNoteContent] = useState('');
  const [savedNotes, setSavedNotes] = useState<SavedNoteEntry[]>([]);
  const [savedWords, setSavedWords] = useState<SavedWordEntry[]>([]);
  const [savedPassages, setSavedPassages] = useState<SavedPassageEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [notebookToast, setNotebookToast] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const pendingVocabularySaveRef = useRef(new Map<string, Promise<boolean>>());

  const saveToServer = async (
    words: SavedWordEntry[],
    passages?: SavedPassageEntry[],
    notes?: SavedNoteEntry[],
    options: { showToast?: boolean; successMessage?: string; errorMessage?: string } = {},
  ) => {
    const requestBody = {
      words,
      passages: passages ?? [],
      ...(notes ? { notes } : {}),
    };
    const requestKey = JSON.stringify(requestBody);
    const pendingSave = pendingVocabularySaveRef.current.get(requestKey);
    if (pendingSave) {
      return pendingSave;
    }

    const savePromise = (async () => {
      setIsSyncing(true);
      const showToast = options.showToast ?? true;
      try {
        const response = await fetch('/api/vocabulary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Sync failed');
        }
        if (Array.isArray(data.notes) && response.ok) {
          setSavedNotes(data.notes as SavedNoteEntry[]);
        }
        setLastSynced(Date.now());
        if (showToast) {
          setNotebookToast({
            type: 'success',
            title: 'Saved',
            message: options.successMessage ?? 'Notebook saved successfully.',
          });
        }
        return true;
      } catch (error) {
        console.error('Sync to server failed', error);
        if (showToast) {
          setNotebookToast({
            type: 'error',
            title: 'Save failed',
            message: options.errorMessage ?? 'Could not save notebook. Please try again.',
          });
        }
        return false;
      } finally {
        pendingVocabularySaveRef.current.delete(requestKey);
        setTimeout(() => setIsSyncing(false), 1000);
      }
    })();

    pendingVocabularySaveRef.current.set(requestKey, savePromise);
    return await savePromise;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/vocabulary');
        const data = await res.json();
        if (Array.isArray(data.notes) && data.notes.length > 0) {
          setSavedNotes(data.notes as SavedNoteEntry[]);
        }
        const savedNotesDraft = localStorage.getItem('chinese-notes');
        if (savedNotesDraft) {
          setNoteContent(savedNotesDraft);
        }
        if (data.words && data.words.length > 0) {
          setSavedWords(data.words.map(normalizeSavedWord));
        } else {
          const savedWordsStr = localStorage.getItem('chinese-saved-words');
          if (savedWordsStr) {
            try {
              const parsed = JSON.parse(savedWordsStr) as SavedWordEntry[];
              setSavedWords(parsed.map(normalizeSavedWord));
            } catch {}
          }
        }
        if (data.passages && data.passages.length > 0) {
          setSavedPassages(data.passages as SavedPassageEntry[]);
          return;
        }
      } catch {
        const savedNotesDraft = localStorage.getItem('chinese-notes');
        if (savedNotesDraft) setNoteContent(savedNotesDraft);
        const savedWordsStr = localStorage.getItem('chinese-saved-words');
        if (savedWordsStr) {
          try {
            const parsed = JSON.parse(savedWordsStr) as SavedWordEntry[];
            setSavedWords(parsed.map(normalizeSavedWord));
          } catch {}
        }
      }

      const savedPassagesStr = localStorage.getItem('chinese-saved-passages');
      if (savedPassagesStr) {
        try {
          setSavedPassages(JSON.parse(savedPassagesStr) as SavedPassageEntry[]);
        } catch {}
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem('chinese-notes', noteContent);
  }, [noteContent]);

  useEffect(() => {
    if (!notebookToast) return;

    const timeoutId = window.setTimeout(() => {
      setNotebookToast(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [notebookToast]);

  useEffect(() => {
    localStorage.setItem('chinese-saved-words', JSON.stringify(savedWords));
    localStorage.setItem('chinese-saved-passages', JSON.stringify(savedPassages));
  }, [savedWords, savedPassages]);

  useEffect(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, [activeTab]);

  useEffect(() => {
    if (localStorage.getItem('voice-mobile-notice-seen') !== 'true') {
      const timeoutId = window.setTimeout(() => setShowVoiceNotice(true), 350);
      return () => window.clearTimeout(timeoutId);
    }
  }, []);

  const handleSetActiveTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
  };

  const closeVoiceNotice = () => {
    localStorage.setItem('voice-mobile-notice-seen', 'true');
    setShowVoiceNotice(false);
  };

  const openSpeakingPage = () => {
    localStorage.setItem('voice-mobile-notice-seen', 'true');
    setShowVoiceNotice(false);
    setActiveTab('speaking');
  };

  const handleAddToNotebook = async (word: string, explanation: WordExplanation) => {
    if (savedWords.find((w) => w.word === word)) {
      setNotebookToast({
        type: 'success',
        title: 'Already saved',
        message: 'This word is already in your notebook.',
      });
      return true;
    }

    const nextWords = [
      ...savedWords,
      { word, explanation, review: createInitialReview(), savedAt: Date.now() },
    ];
    setSavedWords(nextWords);
    return await saveToServer(nextWords, savedPassages, savedNotes, {
      successMessage: 'Word saved to notebook.',
      errorMessage: 'Could not save word. Please try again.',
    });
  };

  const handleRemoveWord = async (word: string) => {
    const nextWords = savedWords.filter((w) => w.word !== word);
    setSavedWords(nextWords);
    return await saveToServer(nextWords, savedPassages, savedNotes, {
      successMessage: 'Word removed from notebook.',
      errorMessage: 'Could not remove word. Please try again.',
    });
  };

  const handleSavePassage = async (text: string, source: 'read' | 'create' = 'read') => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (savedPassages.find((p) => p.text === trimmed)) {
      setNotebookToast({
        type: 'success',
        title: 'Already saved',
        message: 'This passage is already in your notebook.',
      });
      return true;
    }
    const nextPassages = [
      { id: Date.now().toString(), text: trimmed, savedAt: Date.now(), source },
      ...savedPassages,
    ];
    setSavedPassages(nextPassages);
    return await saveToServer(savedWords, nextPassages, savedNotes, {
      successMessage: 'Passage saved to notebook.',
      errorMessage: 'Could not save passage. Please try again.',
    });
  };

  const handleRemovePassage = async (id: string) => {
    const nextPassages = savedPassages.filter((p) => p.id !== id);
    setSavedPassages(nextPassages);
    return await saveToServer(savedWords, nextPassages, savedNotes, {
      successMessage: 'Passage removed from notebook.',
      errorMessage: 'Could not remove passage. Please try again.',
    });
  };

  const handleSaveNotes = async () => {
    const trimmed = noteContent.trim();
    if (!trimmed) return;
    setIsSavingNote(true);
    setNotebookToast(null);
    const now = Date.now();
    const nextNotes: SavedNoteEntry[] = [
      { id: now.toString(), content: trimmed, savedAt: now },
      ...savedNotes,
    ];
    const saved = await saveToServer(savedWords, savedPassages, nextNotes, {
      successMessage: 'Note saved successfully.',
      errorMessage: 'Could not save note. Please try again.',
    });
    if (saved) {
      setNoteContent('');
      localStorage.removeItem('chinese-notes');
    }
    setIsSavingNote(false);
  };

  const handleRemoveSavedNote = async (id: string) => {
    const nextNotes = savedNotes.filter((item) => item.id !== id);
    setSavedNotes(nextNotes);
    return await saveToServer(savedWords, savedPassages, nextNotes, {
      successMessage: 'Note removed from notebook.',
      errorMessage: 'Could not remove note. Please try again.',
    });
  };

  const handleReviewWord = (word: string, grade: ReviewGrade) => {
    setSavedWords((items) =>
      items.map((item) =>
        item.word === word
          ? { ...item, review: scheduleReview(item.review, grade) }
          : item,
      ),
    );
  };

  const fadeVariants: Variants = {
    hidden: { opacity: 0, y: 18, scale: 0.985, filter: 'blur(6px)' },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.45, ease: softEase },
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.99,
      filter: 'blur(4px)',
      transition: { duration: 0.22, ease: 'easeInOut' },
    },
  };

  return (
    <div className="relative flex h-dvh min-h-dvh w-full min-w-0 flex-col overflow-hidden bg-[#fbfaff] font-sans text-slate-800 md:flex-row">
      <div className="app-background" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/20" />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
      />

      <SettingsModal
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
      />

      <main className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-transparent scroll-smooth">
        <AnimatePresence mode="wait">
          {activeTab === 'search' && (
            <SearchPage
              selectedModel={selectedModel}
              onAddToNotebook={handleAddToNotebook}
              fadeVariants={fadeVariants}
            />
          )}

          {activeTab === 'read' && (
            <ReadPage
              readInput={readInput}
              setReadInput={setReadInput}
              readText={readText}
              setReadText={setReadText}
              selectedModel={selectedModel}
              onAddToNotebook={handleAddToNotebook}
              onSavePassage={(text) => handleSavePassage(text, 'read')}
              fadeVariants={fadeVariants}
            />
          )}

          {activeTab === 'speaking' && (
            <SpeakingPage selectedModel={selectedModel} fadeVariants={fadeVariants} />
          )}

          {activeTab === 'chat' && (
            <AIChatPage selectedModel={selectedModel} fadeVariants={fadeVariants} />
          )}

          {activeTab === 'create' && (
            <CreatePage
              createWords={createWords}
              setCreateWords={setCreateWords}
              hskLevel={hskLevel}
              setHskLevel={setHskLevel}
              createdText={createdText}
              setCreatedText={setCreatedText}
              isGenerating={isGenerating}
              setIsGenerating={setIsGenerating}
              selectedModel={selectedModel}
              onAddToNotebook={handleAddToNotebook}
              onSavePassage={(text) => handleSavePassage(text, 'create')}
              onOpenReading={(text) => {
                setReadInput(text);
                setReadText(text);
                handleSetActiveTab('read');
              }}
              fadeVariants={fadeVariants}
            />
          )}

          {activeTab === 'study' && (
            <motion.div
              key="study"
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10"
            >
              <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">
                    Daily Study
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Review saved words with lightweight spaced repetition.
                  </p>
                </div>
              </div>
              <StudyDeck
                words={savedWords}
                onReview={handleReviewWord}
                onOpenNotebook={() => setActiveTab('notebook')}
                onOpenReading={() => setActiveTab('read')}
              />
            </motion.div>
          )}

          {activeTab === 'quiz' && (
            <motion.div
              key="quiz"
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10"
            >
              <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">
                  HSK Practice
                </h1>
              </div>
              <QuizWizard selectedModel={selectedModel} />
            </motion.div>
          )}

          {activeTab === 'notebook' && (
            <NotebookPage
              noteContent={noteContent}
              setNoteContent={setNoteContent}
              savedNotes={savedNotes}
              handleRemoveSavedNote={handleRemoveSavedNote}
              savedWords={savedWords}
              handleRemoveWord={handleRemoveWord}
              savedPassages={savedPassages}
              handleRemovePassage={handleRemovePassage}
              onOpenPassage={(text) => {
                setReadInput(text);
                setReadText(text);
                setActiveTab('read');
              }}
              isSyncing={isSyncing}
              isSavingNote={isSavingNote}
              notebookToast={notebookToast}
              lastSynced={lastSynced}
              saveToServer={saveToServer}
              onSaveNotes={handleSaveNotes}
              handlePrint={() => window.print()}
              fadeVariants={fadeVariants}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showVoiceNotice && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 pb-10 pt-5 backdrop-blur-md sm:items-center sm:py-6 md:pb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeVoiceNotice}
          >
            <motion.div
              className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-white/70 bg-white p-4 shadow-2xl sm:rounded-[2rem] sm:p-6"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 sm:h-12 sm:w-12">
                    <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold leading-snug text-slate-800 sm:text-xl">
                      Bật voice trên mobile
                    </h2>
                    <p className="text-sm text-slate-500">
                      Một vài lưu ý trước khi luyện nói.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeVoiceNotice}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3 rounded-2xl bg-violet-50/80 p-3 sm:p-4">
                  <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <p className="text-sm leading-relaxed text-slate-700">
                    Voice input dùng Web Speech API, nên trên mobile nên mở bằng Chrome
                    hoặc Edge để ổn định hơn.
                  </p>
                </div>
                <div className="flex gap-3 rounded-2xl bg-emerald-50 p-3 sm:p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-relaxed text-slate-700">
                    Khi trình duyệt hỏi quyền, hãy chọn Allow microphone. Nếu từng chặn
                    quyền, cần bật lại trong site settings.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeVoiceNotice}
                  className="rounded-2xl border border-violet-100 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-violet-50 sm:px-5"
                >
                  Để sau
                </button>
                <button
                  type="button"
                  onClick={openSpeakingPage}
                  className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-colors hover:bg-violet-700 sm:px-5"
                >
                  Đã hiểu, vào luyện nói
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          body { background-color: white !important; }
          .format-avoid-break { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
