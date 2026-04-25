import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Loader2, Volume2, RotateCcw, User, GraduationCap } from 'lucide-react';
import { AIModel, chatWithTeacher, readAloud } from '../lib/ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SpeakingPageProps {
  selectedModel: AIModel;
  fadeVariants: any;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export default function SpeakingPage({ selectedModel, fadeVariants }: SpeakingPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hskLevel, setHskLevel] = useState('HSK 3');
  const [voiceError, setVoiceError] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setVoiceError('Voice input needs a browser that supports Speech Recognition, such as Chrome or Edge.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
        setVoiceError('');
      };

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setVoiceError('Microphone permission is blocked. Please allow microphone access and try again.');
        } else if (event?.error === 'no-speech') {
          setVoiceError('No speech detected. Try speaking closer to the microphone.');
        } else {
          setVoiceError('Voice input stopped. Please try again in Chrome or Edge if it keeps happening.');
        }
      };
      recognition.onend = () => setIsRecording(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const response = await chatWithTeacher(userMessage.content, messages, hskLevel, selectedModel);
    
    if (response) {
      const assistantMessage: Message = { role: 'assistant', content: response };
      setMessages([...newMessages, assistantMessage]);
      readAloud(response);
    }
    setLoading(false);
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setVoiceError('Voice input needs Chrome or Edge with microphone permission enabled.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        setVoiceError('');
        setIsRecording(true);
        recognitionRef.current.start();
      } catch {
        setIsRecording(false);
        setVoiceError('Voice input is already starting. Please wait a moment and try again.');
      }
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <motion.div key="speaking" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="max-w-4xl mx-auto h-full min-h-0 flex flex-col gap-3 p-4 md:gap-4 md:p-10 relative">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 print:hidden">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-slate-800 tracking-tight">Speaking Practice</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Talk to your AI Teacher and get instant feedback.</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <select 
            value={hskLevel}
            onChange={(e) => setHskLevel(e.target.value)}
            className="px-3 py-2 bg-white border border-violet-100 rounded-xl text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            {[1,2,3,4,5,6].map(l => <option key={l} value={`HSK ${l}`}>HSK {l}</option>)}
          </select>
          <button onClick={resetChat} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 bg-white/65 backdrop-blur-md rounded-[1.25rem] md:rounded-[2rem] border border-violet-50 shadow-inner overflow-hidden flex flex-col">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 md:p-6 flex flex-col gap-4 md:gap-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-8 md:py-20">
              <div className="w-14 h-14 md:w-20 md:h-20 bg-violet-100 rounded-full flex items-center justify-center mb-3 md:mb-4">
                <Mic className="w-7 h-7 md:w-10 md:h-10 text-violet-400" />
              </div>
              <p className="text-sm md:text-lg font-medium text-slate-500">Press the microphone or type to start chatting!</p>
              <p className="text-sm text-slate-400 mt-1">"Nǐ hǎo! Jīntiān nǐ xiǎng liáo shénme?"</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-fuchsia-100 text-fuchsia-600' : 'bg-violet-100 text-violet-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 md:w-6 md:h-6" /> : <GraduationCap className="w-4 h-4 md:w-6 md:h-6" />}
                </div>
                <div className={`max-w-[84%] md:max-w-[80%] rounded-2xl p-3 md:p-4 shadow-sm relative group ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-700 rounded-tl-none border border-violet-50'
                }`}>
                  <div className={`chinese text-sm md:text-lg leading-relaxed break-words ${msg.role === 'user' ? 'font-medium' : ''}`}>
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && (
                    <button 
                      onClick={() => readAloud(msg.content)}
                      className="absolute -right-10 top-2 p-2 text-slate-300 hover:text-violet-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-violet-400 animate-spin" />
              </div>
              <div className="bg-white/50 border border-violet-50 rounded-2xl rounded-tl-none p-4 w-16 h-12 flex items-center justify-center">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-violet-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-1.5 h-1.5 bg-violet-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 bg-violet-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-2.5 md:p-5 bg-white/90 border-t border-violet-50">
          <div className="flex items-center gap-2 md:gap-3">
            <button 
              type="button"
              onClick={toggleRecording}
              disabled={!recognitionRef.current}
              className={`flex h-10 w-10 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95 shadow-md ${
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-violet-100 text-violet-600 hover:bg-violet-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {isRecording ? <MicOff className="w-4 h-4 md:w-6 md:h-6" /> : <Mic className="w-4 h-4 md:w-6 md:h-6" />}
            </button>
            <div className="flex-1 relative">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isRecording ? "Listening..." : "Type or speak to the teacher..."}
                className="h-10 md:h-14 w-full bg-white border border-violet-100 rounded-2xl py-0 pl-4 md:pl-5 pr-11 md:pr-14 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all font-medium text-[13px] md:text-base text-slate-700 shadow-inner"
              />
              <button 
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="absolute right-1 md:right-2 top-1/2 flex h-8 w-8 md:h-10 md:w-10 -translate-y-1/2 items-center justify-center bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-violet-200"
              >
                <Send className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
          {voiceError && (
            <p className="text-[11px] text-red-500 mt-2 text-center font-semibold">
              {voiceError}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
