import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Loader2, Volume2, RotateCcw, User, Bot } from 'lucide-react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { AIModel, chatWithTeacher, readAloud } from '../lib/ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SpeakingPageProps {
  selectedModel: AIModel;
  fadeVariants: any;
}

export default function SpeakingPage({ selectedModel, fadeVariants }: SpeakingPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hskLevel, setHskLevel] = useState('HSK 3');
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  const isPressingRef = useRef(false);
  const lastProcessedTranscriptRef = useRef('');
  const messagesRef = useRef<Message[]>([]);
  const loadingRef = useRef(false);
  const hskLevelRef = useRef(hskLevel);
  const selectedModelRef = useRef(selectedModel);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    hskLevelRef.current = hskLevel;
  }, [hskLevel]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    setIsRecording(listening);
  }, [listening]);

  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      setVoiceReady(false);
      setVoiceError('Trình duyệt này chưa hỗ trợ Speech Recognition. Hãy dùng Chrome hoặc Edge.');
      return;
    }
    if (isMicrophoneAvailable === false) {
      setVoiceReady(false);
      setVoiceError('Microphone đang bị chặn. Hãy Allow microphone rồi thử lại.');
      return;
    }
    setVoiceReady(true);
  }, [browserSupportsSpeechRecognition, isMicrophoneAvailable]);

  useEffect(() => {
    if (isPressingRef.current || listening) return;
    const finalTranscript = transcript.trim();
    if (!finalTranscript || loadingRef.current) return;
    if (lastProcessedTranscriptRef.current === finalTranscript) return;
    lastProcessedTranscriptRef.current = finalTranscript;
    void sendVoiceMessage(finalTranscript);
    resetTranscript();
  }, [listening, transcript, resetTranscript]);

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

  const sendVoiceMessage = async (inputText: string) => {
    const content = inputText.trim();
    if (!content || loadingRef.current) return;

    const userMessage: Message = { role: 'user', content };
    const baseMessages = messagesRef.current;
    const nextMessages = [...baseMessages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    let response = await chatWithTeacher(
      content,
      baseMessages,
      hskLevelRef.current,
      selectedModelRef.current,
    );

    if (!response && selectedModelRef.current !== 'qwen/qwen3-32b') {
      response = await chatWithTeacher(content, baseMessages, hskLevelRef.current, 'qwen/qwen3-32b');
    }

    if (response) {
      setMessages([...nextMessages, { role: 'assistant', content: response }]);
      readAloud(response);
      setVoiceError('');
    } else {
      setVoiceError('AI chưa phản hồi. Thử lại hoặc đổi model trong cài đặt.');
    }
    setLoading(false);
  };

  const startPressRecording = async () => {
    if (!voiceReady || !browserSupportsSpeechRecognition) {
      setVoiceError('Voice cần Chrome/Edge và quyền microphone đã bật.');
      return;
    }
    if (isPressingRef.current || isRecording || loadingRef.current) return;
    const hasMicrophone = await ensureMicrophoneAvailable();
    if (!hasMicrophone) return;
    try {
      setVoiceError('');
      isPressingRef.current = true;
      lastProcessedTranscriptRef.current = '';
      resetTranscript();
      await SpeechRecognition.startListening({ continuous: false, language: 'zh-CN' });
    } catch {
      isPressingRef.current = false;
      setIsRecording(false);
      setVoiceError('Voice input đang khởi động. Hãy chờ một chút rồi thử lại.');
    }
  };

  const stopPressRecording = () => {
    if (!isPressingRef.current) return;
    isPressingRef.current = false;
    void SpeechRecognition.stopListening();
  };

  const resetSession = () => {
    setMessages([]);
    setVoiceError('');
  };

  return (
    <motion.div
      key="speaking"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mx-auto h-full min-h-0 w-full max-w-4xl overflow-hidden flex flex-col gap-3 p-4 pb-2 md:gap-4 md:p-10 md:pb-6 relative"
    >
      <div className="flex justify-end print:hidden">
        <div className="flex shrink-0 gap-2">
          <select
            value={hskLevel}
            onChange={(e) => setHskLevel(e.target.value)}
            className="px-3 py-2 bg-white border border-violet-100 rounded-xl text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/20"
            aria-label="HSK level"
          >
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option key={level} value={`HSK ${level}`}>HSK {level}</option>
            ))}
          </select>
          <button
            onClick={resetSession}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            aria-label="Reset session"
          >
            <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white/65 backdrop-blur-md rounded-[1.25rem] md:rounded-[2rem] border border-violet-50 shadow-inner overflow-hidden flex flex-col">
        <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 md:p-4">
          <div className="space-y-2">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`group max-w-[86%] md:max-w-[80%] rounded-2xl px-3 py-2 text-left shadow-sm ${
                    message.role === 'user'
                      ? 'bg-slate-800 text-white rounded-br-md'
                      : 'bg-white text-slate-700 border border-violet-100 rounded-bl-md'
                  }`}
                >
                  <div className="flex items-end gap-1.5 h-8">
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <div
                        key={`${message.role}-${index}-bar-${bar}`}
                        className="w-1.5 rounded-full bg-slate-400"
                        style={{
                          height: `${13 + ((bar % 3) * 5)}px`,
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => readAloud(message.content)}
                    className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                      message.role === 'user'
                        ? 'text-white/75 hover:text-white hover:bg-white/10'
                        : 'text-violet-500 hover:text-violet-700 hover:bg-violet-50'
                    }`}
                    title="Nghe lại đoạn này"
                    aria-label={`Nghe lại đoạn ${index + 1}`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {message.role === 'user' && (
                  <div className="h-7 w-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-violet-100/80 bg-white/85 p-4 md:p-5">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                void startPressRecording();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                stopPressRecording();
              }}
              onPointerLeave={() => stopPressRecording()}
              onPointerCancel={() => stopPressRecording()}
              disabled={!voiceReady || loading}
              className={`flex h-20 w-20 md:h-24 md:w-24 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 shadow-lg ${
                isRecording
                  ? 'bg-red-500 text-white'
                  : 'bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {isRecording ? <MicOff className="w-8 h-8 md:w-10 md:h-10" /> : <Mic className="w-8 h-8 md:w-10 md:h-10" />}
            </button>

            {isRecording && (
              <div className="flex items-end gap-1.5 h-7" aria-label="Đang nghe giọng nói">
                {[0, 1, 2, 3, 4].map((bar) => (
                  <div
                    key={`recording-bar-${bar}`}
                    className="w-1.5 rounded-full bg-slate-500"
                    style={{
                      height: `${12 + ((bar % 3) * 5)}px`,
                    }}
                  />
                ))}
              </div>
            )}

            {loading && (
              <div className="inline-flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
              </div>
            )}
          </div>
        </div>
      </div>

      {voiceError && (
        <p className="text-[11px] text-red-500 mt-2 text-center font-semibold">
          {voiceError}
        </p>
      )}
    </motion.div>
  );
}
