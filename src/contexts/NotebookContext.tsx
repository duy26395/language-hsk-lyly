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

function getInitialWords(): SavedWordEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('chinese-saved-words');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeSavedWord) : [];
  } catch {
    return [];
  }
}

function getInitialPassages(): SavedPassageEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('chinese-saved-passages');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInitialNotes(): SavedNoteEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('chinese-saved-notes-list');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInitialNoteContent(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('chinese-notes') || '';
}

export const NotebookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // PERF: Lazy initialisation directly from localStorage.
  // The UI is interactive immediately on first render (0ms load time)
  // instead of waiting for a 2-4 second Netlify cold start to load data.
  const [noteContent, setNoteContent] = useState<string>(getInitialNoteContent);
  const [savedNotes, setSavedNotes] = useState<SavedNoteEntry[]>(getInitialNotes);
  const [savedWords, setSavedWords] = useState<SavedWordEntry[]>(getInitialWords);
  const [savedPassages, setSavedPassages] = useState<SavedPassageEntry[]>(getInitialPassages);

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
          localStorage.setItem('chinese-saved-notes-list', JSON.stringify(data.notes));
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
        setTimeout(() => setIsSyncing(false), 800);
      }
    })();

    pendingVocabularySaveRef.current.set(requestKey, savePromise);
    return await savePromise;
  };

  // Background fetch to sync from server without blocking UI
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const res = await fetch('/api/vocabulary');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (Array.isArray(data.notes) && data.notes.length > 0) {
          setSavedNotes(data.notes as SavedNoteEntry[]);
          localStorage.setItem('chinese-saved-notes-list', JSON.stringify(data.notes));
        }
        if (Array.isArray(data.words) && data.words.length > 0) {
          setSavedWords(data.words.map(normalizeSavedWord));
          localStorage.setItem('chinese-saved-words', JSON.stringify(data.words));
        }
        if (Array.isArray(data.passages) && data.passages.length > 0) {
          setSavedPassages(data.passages as SavedPassageEntry[]);
          localStorage.setItem('chinese-saved-passages', JSON.stringify(data.passages));
        }
      } catch (e) {
        // Fallback: localStorage already populated the state, no UI breakage
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('chinese-notes', noteContent);
  }, [noteContent]);

  useEffect(() => {
    if (!notebookToast) return;

    const timeoutId = window.setTimeout(() => {
      setNotebookToast(null);
    }, 3000);

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
    // Optimistic update: instantly visible to the user
    setSavedWords(nextWords);
    setNotebookToast({
      type: 'success',
      title: 'Word saved',
      message: `"${word}" added to your notebook.`,
    });

    // Background sync to server
    void saveToServer(nextWords, savedPassages, savedNotes, {
      showToast: false,
    });
    return true;
  };

  const removeWord = async (word: string) => {
    const nextWords = savedWords.filter((w) => w.word !== word);
    setSavedWords(nextWords);
    setNotebookToast({
      type: 'success',
      title: 'Word removed',
      message: `"${word}" removed from notebook.`,
    });

    void saveToServer(nextWords, savedPassages, savedNotes, {
      showToast: false,
    });
    return true;
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
    setNotebookToast({
      type: 'success',
      title: 'Passage saved',
      message: 'Passage saved to your notebook.',
    });

    void saveToServer(savedWords, nextPassages, savedNotes, {
      showToast: false,
    });
    return true;
  };

  const removePassage = async (id: string) => {
    const nextPassages = savedPassages.filter((p) => p.id !== id);
    setSavedPassages(nextPassages);
    void saveToServer(savedWords, nextPassages, savedNotes, {
      showToast: false,
    });
    return true;
  };

  const saveNotes = async () => {
    const trimmed = noteContent.trim();
    if (!trimmed) return;
    setIsSavingNote(true);
    const now = Date.now();
    const nextNotes: SavedNoteEntry[] = [
      { id: now.toString(), content: trimmed, savedAt: now },
      ...savedNotes,
    ];
    setSavedNotes(nextNotes);
    localStorage.setItem('chinese-saved-notes-list', JSON.stringify(nextNotes));
    setNoteContent('');
    localStorage.removeItem('chinese-notes');
    setNotebookToast({
      type: 'success',
      title: 'Note saved',
      message: 'Note saved successfully.',
    });
    setIsSavingNote(false);

    void saveToServer(savedWords, savedPassages, nextNotes, {
      showToast: false,
    });
  };

  const removeNote = async (id: string) => {
    const nextNotes = savedNotes.filter((item) => item.id !== id);
    setSavedNotes(nextNotes);
    localStorage.setItem('chinese-saved-notes-list', JSON.stringify(nextNotes));
    void saveToServer(savedWords, savedPassages, nextNotes, {
      showToast: false,
    });
    return true;
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
