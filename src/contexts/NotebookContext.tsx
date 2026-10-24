import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  SavedNoteEntry,
  SavedPassageEntry,
  SavedWordEntry,
  WordExplanation,
  ReviewGrade,
} from '../types';
import { createInitialReview, scheduleReview } from '../hooks/useSRS';

interface NotebookContextType {
  noteContent: string;
  setNoteContent: (value: string) => void;
  savedNotes: SavedNoteEntry[];
  savedWords: SavedWordEntry[];
  savedPassages: SavedPassageEntry[];
  isSyncing: boolean;
  isSavingNote: boolean;
  notebookToast: {
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null;
  setNotebookToast: (toast: { type: 'success' | 'error'; title: string; message: string } | null) => void;
  lastSynced: number | null;
  saveToServer: (
    words: SavedWordEntry[],
    passages?: SavedPassageEntry[],
    notes?: SavedNoteEntry[],
    options?: { showToast?: boolean; successMessage?: string; errorMessage?: string },
  ) => Promise<boolean>;
  addWord: (word: string, explanation: WordExplanation) => Promise<boolean>;
  removeWord: (word: string) => Promise<boolean>;
  savePassage: (text: string, source?: 'read' | 'create') => Promise<boolean>;
  removePassage: (id: string) => Promise<boolean>;
  saveNotes: () => Promise<void>;
  removeNote: (id: string) => Promise<boolean>;
  reviewWord: (word: string, grade: ReviewGrade) => void;
}

const NotebookContext = createContext<NotebookContextType | undefined>(undefined);

const normalizeSavedWord = (item: SavedWordEntry): SavedWordEntry => ({
  ...item,
  savedAt: item.savedAt,
  review: {
    ...createInitialReview(),
    ...item.review,
  },
});

export const NotebookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const addWord = async (word: string, explanation: WordExplanation) => {
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

  const removeWord = async (word: string) => {
    const nextWords = savedWords.filter((w) => w.word !== word);
    setSavedWords(nextWords);
    return await saveToServer(nextWords, savedPassages, savedNotes, {
      successMessage: 'Word removed from notebook.',
      errorMessage: 'Could not remove word. Please try again.',
    });
  };

  const savePassage = async (text: string, source: 'read' | 'create' = 'read') => {
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

  const removePassage = async (id: string) => {
    const nextPassages = savedPassages.filter((p) => p.id !== id);
    setSavedPassages(nextPassages);
    return await saveToServer(savedWords, nextPassages, savedNotes, {
      successMessage: 'Passage removed from notebook.',
      errorMessage: 'Could not remove passage. Please try again.',
    });
  };

  const saveNotes = async () => {
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

  const removeNote = async (id: string) => {
    const nextNotes = savedNotes.filter((item) => item.id !== id);
    setSavedNotes(nextNotes);
    return await saveToServer(savedWords, savedPassages, nextNotes, {
      successMessage: 'Note removed from notebook.',
      errorMessage: 'Could not remove note. Please try again.',
    });
  };

  const reviewWord = (word: string, grade: ReviewGrade) => {
    setSavedWords((items) =>
      items.map((item) =>
        item.word === word
          ? { ...item, review: scheduleReview(item.review, grade) }
          : item,
      ),
    );
  };

  return (
    <NotebookContext.Provider
      value={{
        noteContent,
        setNoteContent,
        savedNotes,
        savedWords,
        savedPassages,
        isSyncing,
        isSavingNote,
        notebookToast,
        setNotebookToast,
        lastSynced,
        saveToServer,
        addWord,
        removeWord,
        savePassage,
        removePassage,
        saveNotes,
        removeNote,
        reviewWord,
      }}
    >
      {children}
    </NotebookContext.Provider>
  );
};

export const useNotebook = () => {
  const context = useContext(NotebookContext);
  if (!context) {
    throw new Error('useNotebook must be used within a NotebookProvider');
  }
  return context;
};
