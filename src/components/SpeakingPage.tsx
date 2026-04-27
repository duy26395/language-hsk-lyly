import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, RotateCcw, User, Bot } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { AIModel } from '../lib/ai';
import { AudioPlayer, AudioRecorder, speakToTeacher, textToSpeech } from '../lib/voice';

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
  const [ttsVoice, setTtsVoice] = useState('zh-CN-XiaoxiaoNeural');
  const [voiceError, setVoiceError] = useState('');

  const recorderRef = useRef<AudioRecorder | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioPlayerRef = useRef(new AudioPlayer());
  const audioQueueRef = useRef<{ audio: string; mimeType?: string }[]>([]);
  const isPlayingRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isPressingRef = useRef(false);
  const isDisposedRef = useRef(false);

  const stopAllAudio = () => {
    audioQueueRef.current = [];
    audioPlayerRef.current.stop();
    window.speechSynthesis?.cancel();
    isPlayingRef.current = false;
  };

  useEffect(() => {
    // Setup Socket.io
    const socket = io();
    socketRef.current = socket;

    socket.on('user_text', (data) => {
      setMessages(prev => [...prev, { role: 'user', content: data.text }]);
    });

    socket.on('llm_text_chunk', (data) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: last.content + data.chunk }];
        }
        return [...prev, { role: 'assistant', content: data.chunk }];
      });
    });

    socket.on('audio_chunk', (data) => {
      audioQueueRef.current.push({ audio: data.audio, mimeType: data.mimeType });
      processAudioQueue();
    });

    socket.on('pipeline_complete', () => {
      setLoading(false);
    });

    socket.on('error', (data) => {
      setVoiceError(data.message);
      setLoading(false);
    });

    return () => {
      stopAllAudio();
      socket.disconnect();
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
      setIsRecording(true);
      await recorderRef.current?.start();
    } catch (error) {
      isPressingRef.current = false;
      setIsRecording(false);
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
        return;
      }
      void processAudioInput(audioBlob);
    } catch (error) {
      setVoiceError('Không thể thu âm, vui lòng thử lại.');
    }
  };

  const processAudioInput = async (audioBlob: Blob) => {
    if (loading) return;
    setLoading(true);
    setVoiceError('');
    stopAllAudio();

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
      );

      socketRef.current?.emit('speak', {
        audio: base64,
        history: messages,
        hskLevel,
        ttsVoice,
        fileName: audioBlob.type.includes('webm') ? 'audio.webm' : 'audio.wav'
      });

      if (!socketRef.current?.connected) {
        const result = await speakToTeacher(audioBlob, messages, hskLevel, ttsVoice);
        if (isDisposedRef.current) return;
        if (!result) {
          setVoiceError('Không xử lý được âm thanh. Vui lòng thử lại.');
          setLoading(false);
          return;
        }
        setMessages(prev => [
          ...prev,
          { role: 'user', content: result.userText },
          { role: 'assistant', content: result.assistantText },
        ]);
        await audioPlayerRef.current.playBase64(result.audio, result.mimeType);
        if (isDisposedRef.current) return;
        setLoading(false);
      }
    } catch (e: any) {
      console.error(e);
      setVoiceError('Lỗi kết nối real-time.');
      setLoading(false);
    }
  };

  const handleReadAloud = async (text: string) => {
    try {
      setVoiceError('');
      // Try to get high quality TTS from backend
      const ttsResult = await textToSpeech(text, ttsVoice);
      if (isDisposedRef.current) return;
      if (ttsResult) {
        stopAllAudio();
        await audioPlayerRef.current.playBase64(ttsResult.audio, ttsResult.mimeType);
      } else {
        // Fallback to browser TTS
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
    }
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
          <select
            value={ttsVoice}
            onChange={(e) => setTtsVoice(e.target.value)}
            className="px-3 py-2 bg-white border border-violet-100 rounded-xl text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/20"
            aria-label="TTS Voice"
          >
            <option value="zh-CN-XiaoxiaoNeural">Nữ - Nhẹ nhàng</option>
            <option value="zh-CN-YunxiNeural">Nam - Rõ ràng</option>
            <option value="zh-CN-YunjianNeural">Nam - Kể chuyện</option>
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
                  <p className="text-sm md:text-base mb-1">{message.content}</p>
                  <button
                    type="button"
                    onClick={() => handleReadAloud(message.content)}
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
            
            {loading && (
              <div className="flex items-start gap-2 justify-start">
                <div className="h-7 w-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white text-slate-700 border border-violet-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5 h-6">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
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
                void stopPressRecording();
              }}
              onPointerLeave={() => void stopPressRecording()}
              onPointerCancel={() => void stopPressRecording()}
              disabled={loading}
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
                    className="w-1.5 rounded-full bg-red-400 animate-pulse"
                    style={{
                      height: `${12 + ((bar % 3) * 5)}px`,
                      animationDuration: `${0.5 + (bar % 3) * 0.2}s`
                    }}
                  />
                ))}
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
