import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Languages, Loader2, Mic, MicOff, RotateCcw, User, Bot, Volume2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { AIModel, summarizeConversation, translateToVietnamese } from '../lib/ai';
import { AudioPlayer, AudioRecorder, speakToTeacher, textToSpeech, type TeacherFeedback } from '../lib/voice';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  feedback?: TeacherFeedback;
}

interface SpeakingPageProps {
  selectedModel: AIModel;
  fadeVariants: any;
}

type PipelineStatus = 'idle' | 'recording' | 'recognizing' | 'thinking' | 'speaking';

const pipelineStatusText: Record<Exclude<PipelineStatus, 'idle'>, string> = {
  recording: 'Đang nghe...',
  recognizing: 'Đang nhận diện giọng nói...',
  thinking: 'Đang chuẩn bị phản hồi...',
  speaking: 'Đang phát âm thanh...',
};

function canUseRealtimeVoice() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export default function SpeakingPage({ selectedModel, fadeVariants }: SpeakingPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hskLevel, setHskLevel] = useState('HSK 3');
  const [ttsVoice, setTtsVoice] = useState('zh-CN-XiaoxiaoNeural');
  const [voiceError, setVoiceError] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [readingKey, setReadingKey] = useState<string | null>(null);
  const [conversationSummary, setConversationSummary] = useState('');

  const recorderRef = useRef<AudioRecorder | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioPlayerRef = useRef(new AudioPlayer());
  const audioQueueRef = useRef<{ audio: string; mimeType?: string }[]>([]);
  const isPlayingRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isPressingRef = useRef(false);
  const isDisposedRef = useRef(false);
  const realtimeEnabledRef = useRef(canUseRealtimeVoice());
  const summarizedCountRef = useRef(0);

  const stopAllAudio = () => {
    audioQueueRef.current = [];
    audioPlayerRef.current.stop();
    window.speechSynthesis?.cancel();
    isPlayingRef.current = false;
  };

  useEffect(() => {
    if (!realtimeEnabledRef.current) {
      return;
    }

    const socket = io({
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('processing_stt', () => {
      setPipelineStatus('recognizing');
    });

    socket.on('user_text', (data) => {
      setMessages((prev) => [...prev, { role: 'user', content: data.text }]);
    });

    socket.on('processing_llm', () => {
      setPipelineStatus('thinking');
    });

    socket.on('llm_text_chunk', (data) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: last.content + data.chunk }];
        }
        return [...prev, { role: 'assistant', content: data.chunk }];
      });
    });

    socket.on('audio_chunk', (data) => {
      setPipelineStatus('speaking');
      audioQueueRef.current.push({ audio: data.audio, mimeType: data.mimeType });
      void processAudioQueue();
    });

    socket.on('tts_error', () => {
      setVoiceError('Không thể phát một đoạn âm thanh. Bạn vẫn có thể đọc phản hồi trên màn hình.');
    });

    socket.on('pipeline_complete', () => {
      setLoading(false);
      setPipelineStatus('idle');
    });

    socket.on('error', (data) => {
      setVoiceError(data.message);
      setLoading(false);
      setPipelineStatus('idle');
    });

    return () => {
      stopAllAudio();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const processAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    try {
      while (audioQueueRef.current.length > 0) {
        const audio = audioQueueRef.current.shift();
        if (audio) {
          await audioPlayerRef.current.playBase64(audio.audio, audio.mimeType);
        }
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setVoiceError('Không thể phát âm thanh lúc này.');
    } finally {
      isPlayingRef.current = false;
    }
  };

  useEffect(() => {
    recorderRef.current = new AudioRecorder();
    window.addEventListener('pagehide', stopAllAudio);

    return () => {
      isDisposedRef.current = true;
      window.removeEventListener('pagehide', stopAllAudio);
      recorderRef.current?.cancel();
      stopAllAudio();
    };
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const ensureMicrophoneAvailable = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Trình duyệt này không hỗ trợ microphone. Hãy dùng Chrome hoặc Edge.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error: any) {
      if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setVoiceError('Không tìm thấy microphone. Hãy kiểm tra thiết bị input.');
      } else if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setVoiceError('Microphone đang bị chặn. Hãy Allow microphone rồi thử lại.');
      } else {
        setVoiceError('Không mở được microphone. Hãy kiểm tra cài đặt trình duyệt.');
      }
      return false;
    }
  };

  const startPressRecording = async () => {
    if (isPressingRef.current || isRecording || loading) return;
    const hasMicrophone = await ensureMicrophoneAvailable();
    if (!hasMicrophone) return;

    try {
      setVoiceError('');
      isPressingRef.current = true;
      setPipelineStatus('recording');
      setIsRecording(true);
      await recorderRef.current?.start();
    } catch {
      isPressingRef.current = false;
      setIsRecording(false);
      setPipelineStatus('idle');
      setVoiceError('Lỗi khởi động Voice input. Vui lòng thử lại.');
    }
  };

  const stopPressRecording = async () => {
    if (!isPressingRef.current || !recorderRef.current?.isRecording) {
      isPressingRef.current = false;
      setIsRecording(false);
      return;
    }

    isPressingRef.current = false;
    setIsRecording(false);

    try {
      const audioBlob = await recorderRef.current.stop();
      if (audioBlob.size < 1000) {
        setVoiceError('Âm thanh quá ngắn, vui lòng nói rõ hơn.');
        setPipelineStatus('idle');
        return;
      }
      void processAudioInput(audioBlob);
    } catch {
      setPipelineStatus('idle');
      setVoiceError('Không thể thu âm, vui lòng thử lại.');
    }
  };

  const processAudioInput = async (audioBlob: Blob) => {
    if (loading) return;
    setLoading(true);
    setPipelineStatus('recognizing');
    setVoiceError('');
    stopAllAudio();

    try {
      let summaryForRequest = conversationSummary;
      let summarizedCountForRequest = summarizedCountRef.current;

      if (messages.length - summarizedCountForRequest > 12) {
        const nextSummarizedCount = Math.max(summarizedCountForRequest, messages.length - 10);
        const messagesToSummarize = messages
          .slice(summarizedCountForRequest, nextSummarizedCount)
          .map(({ role, content }) => ({ role, content }));
        const nextSummary = await summarizeConversation(messagesToSummarize, conversationSummary, selectedModel);
        if (nextSummary) {
          summaryForRequest = nextSummary;
          summarizedCountForRequest = nextSummarizedCount;
          summarizedCountRef.current = nextSummarizedCount;
          setConversationSummary(nextSummary);
        }
      }

      const conversationHistory = messages
        .slice(Math.max(summarizedCountForRequest, messages.length - 12))
        .map(({ role, content }) => ({ role, content }));

      if (realtimeEnabledRef.current && socketRef.current?.connected) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
        );

        socketRef.current.emit('speak', {
          audio: base64,
          history: conversationHistory,
          hskLevel,
          ttsVoice,
          summary: summaryForRequest,
          fileName: audioBlob.type.includes('webm') ? 'audio.webm' : 'audio.wav',
        });
        return;
      }

      const result = await speakToTeacher(audioBlob, conversationHistory, hskLevel, ttsVoice, summaryForRequest);
      if (isDisposedRef.current) return;
      if (!result) {
        setVoiceError('Không xử lý được âm thanh. Vui lòng thử lại.');
        setLoading(false);
        setPipelineStatus('idle');
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: result.userText },
        { role: 'assistant', content: result.assistantText, feedback: result.feedback },
      ]);
      setPipelineStatus('speaking');
      await audioPlayerRef.current.playBase64(result.audio, result.mimeType);
      if (isDisposedRef.current) return;
      setLoading(false);
      setPipelineStatus('idle');
    } catch (e) {
      console.error(e);
      setVoiceError(
        realtimeEnabledRef.current
          ? 'Lỗi kết nối real-time.'
          : 'Không xử lý được âm thanh. Vui lòng thử lại.',
      );
      setLoading(false);
      setPipelineStatus('idle');
    }
  };

  const handleReadAloud = async (messageKey: string, text: string) => {
    if (readingKey) return;
    setReadingKey(messageKey);
    try {
      setVoiceError('');
      const ttsResult = await textToSpeech(text, ttsVoice);
      if (isDisposedRef.current) return;
      if (ttsResult) {
        stopAllAudio();
        await audioPlayerRef.current.playBase64(ttsResult.audio, ttsResult.mimeType);
      } else {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.error(e);
      setVoiceError('Không thể phát âm thanh lúc này.');
    } finally {
      setReadingKey((current) => (current === messageKey ? null : current));
    }
  };

  const handleTranslate = async (messageKey: string, text: string) => {
    if (translations[messageKey]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[messageKey];
        return next;
      });
      return;
    }

    if (translatingKey === messageKey) {
      return;
    }

    setTranslatingKey(messageKey);
    try {
      const translated = await translateToVietnamese(text, selectedModel);
      if (translated) {
        setTranslations((prev) => ({ ...prev, [messageKey]: translated }));
      }
    } catch (error) {
      console.error('Translate error:', error);
    } finally {
      setTranslatingKey((current) => (current === messageKey ? null : current));
    }
  };

  const resetSession = () => {
    stopAllAudio();
    setMessages([]);
    setTranslations({});
    setVoiceError('');
    setPipelineStatus('idle');
    setConversationSummary('');
    summarizedCountRef.current = 0;
  };

  const statusText = isRecording
    ? pipelineStatusText.recording
    : pipelineStatus === 'idle'
      ? 'Nhấn giữ micro để luyện nói'
      : pipelineStatusText[pipelineStatus];

  return (
    <motion.div
      key="speaking"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-3 overflow-hidden p-3 pb-2 sm:p-4 md:gap-4 md:p-10 md:pb-6"
    >
      <div className="flex justify-end print:hidden">
        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end">
          <select
            value={hskLevel}
            onChange={(e) => setHskLevel(e.target.value)}
            className="w-full rounded-xl border border-violet-100 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/20 sm:w-auto sm:px-3 md:text-sm"
            aria-label="HSK level"
          >
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option key={level} value={`HSK ${level}`}>
                HSK {level}
              </option>
            ))}
          </select>
          <select
            value={ttsVoice}
            onChange={(e) => setTtsVoice(e.target.value)}
            className="w-full rounded-xl border border-violet-100 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/20 sm:w-auto sm:px-3 md:text-sm"
            aria-label="TTS Voice"
          >
            <option value="zh-CN-XiaoxiaoNeural">Nữ - Nhẹ nhàng</option>
            <option value="zh-CN-YunxiNeural">Nam - Rõ ràng</option>
            <option value="zh-CN-YunjianNeural">Nam - Kể chuyện</option>
          </select>
          <button
            onClick={resetSession}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            aria-label="Reset session"
          >
            <RotateCcw className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-white/50 glass shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] backdrop-blur-3xl md:rounded-[2rem] relative">


        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
          <Mic size={120} />
        </div>

        <div ref={chatScrollRef} className="no-scrollbar flex-1 min-h-0 overflow-y-auto p-3 md:p-4">

          <div className="min-w-0 space-y-2">
            {messages.map((message, index) => {
              const messageKey = `${message.role}-${index}-${message.content}`;
              const translation = translations[messageKey];
              const isTranslating = translatingKey === messageKey;
              const feedback = message.role === 'assistant' ? message.feedback : undefined;
              const hasFeedback = Boolean(
                feedback?.correction ||
                feedback?.betterSentence ||
                feedback?.vocabTips?.length ||
                feedback?.followUpQuestion,
              );

              return (
                <div
                  key={messageKey}
                  className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`group max-w-[86%] break-words rounded-2xl px-3 py-2 text-left shadow-xl md:max-w-[80%] transition-all hover:shadow-2xl ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 text-white'
                        : 'rounded-bl-md border border-white/60 glass bg-white/60 text-slate-700'
                    }`}
                  >

                    <p className="mb-1 text-sm md:text-base">{message.content}</p>
                    {translation && (
                      <div
                        className={`mb-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${
                          message.role === 'user'
                            ? 'bg-white/10 text-white/85'
                            : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <span className="font-semibold">Dịch:</span> {translation}
                      </div>
                    )}
                    {hasFeedback && (
                      <div className="mt-2 space-y-1.5 border-t border-violet-100 pt-2 text-xs leading-relaxed text-slate-600">
                        {feedback?.correction && (
                          <p>
                            <span className="font-bold text-violet-600">Sửa nhẹ:</span> {feedback.correction}
                          </p>
                        )}
                        {feedback?.betterSentence && (
                          <p>
                            <span className="font-bold text-violet-600">Tự nhiên hơn:</span>{' '}
                            <span lang="zh-CN">{feedback.betterSentence}</span>
                          </p>
                        )}
                        {feedback?.vocabTips?.length ? (
                          <div>
                            <span className="font-bold text-violet-600">Từ đáng nhớ:</span>
                            <ul className="mt-1 list-disc space-y-1 pl-4">
                              {feedback.vocabTips.map((tip, tipIndex) => (
                                <li key={`${messageKey}-tip-${tipIndex}`}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {feedback?.followUpQuestion && !message.content.includes(feedback.followUpQuestion) && (
                          <p>
                            <span className="font-bold text-violet-600">Câu hỏi tiếp:</span>{' '}
                            <span lang="zh-CN">{feedback.followUpQuestion}</span>
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleReadAloud(messageKey, message.content)}
                        disabled={readingKey === messageKey}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                          message.role === 'user'
                            ? 'text-white/75 hover:bg-white/10 hover:text-white'
                            : 'text-violet-500 hover:bg-violet-50 hover:text-violet-700'
                        }`}
                        title="Nghe lại đoạn này"
                        aria-label={`Nghe lại đoạn ${index + 1}`}
                      >
                        {readingKey === messageKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
                      {message.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => void handleTranslate(messageKey, message.content)}
                          disabled={isTranslating}
                          className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-100 disabled:cursor-default disabled:opacity-70"
                          title="Dịch sang tiếng Việt"
                        >
                          {isTranslating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Languages className="h-3.5 w-3.5" />
                          )}
                          {translation ? 'Ẩn dịch' : isTranslating ? 'Đang dịch' : 'Dịch'}
                        </button>
                      )}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start justify-start gap-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-bl-md border border-violet-100 bg-white px-4 py-3 text-slate-700 shadow-sm">
                  <p className="mb-2 text-xs font-bold text-violet-600">{statusText}</p>
                  <div className="flex h-6 items-center gap-1.5">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/50 bg-white/40 p-4 md:p-5 backdrop-blur-md">



          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                void startPressRecording();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                void stopPressRecording();
              }}
              onPointerCancel={() => void stopPressRecording()}
              disabled={loading}
              className={`flex h-20 w-20 shrink-0 touch-none select-none items-center justify-center rounded-full shadow-lg transition-all active:scale-95 md:h-24 md:w-24 ${
                isRecording
                  ? 'bg-red-500 text-white'
                  : 'bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin md:h-10 md:w-10" />
              ) : isRecording ? (
                <MicOff className="h-8 w-8 md:h-10 md:w-10" />
              ) : (
                <Mic className="h-8 w-8 md:h-10 md:w-10" />
              )}
            </button>

            {isRecording && (
              <div className="flex h-7 items-end gap-1.5" aria-label="Đang nghe giọng nói">
                {[0, 1, 2, 3, 4].map((bar) => (
                  <div
                    key={`recording-bar-${bar}`}
                    className="w-1.5 animate-pulse rounded-full bg-red-400"
                    style={{
                      height: `${12 + (bar % 3) * 5}px`,
                      animationDuration: `${0.5 + (bar % 3) * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            )}
            <p className="min-h-5 text-center text-xs font-semibold text-slate-500">{statusText}</p>
          </div>
        </div>
      </div>

      {voiceError && <p className="mt-2 text-center text-[11px] font-semibold text-red-500">{voiceError}</p>}
    </motion.div>
  );
}
