import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, ShieldCheck, Smartphone, X } from 'lucide-react';

interface VoiceNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export default function VoiceNoticeModal({ isOpen, onClose, onAccept }: VoiceNoticeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 pb-10 pt-5 backdrop-blur-md sm:items-center sm:py-6 md:pb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
                onClick={onClose}
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
                onClick={onClose}
                className="rounded-2xl border border-violet-100 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-violet-50 sm:px-5"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-colors hover:bg-violet-700 sm:px-5"
              >
                Đã hiểu, vào luyện nói
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
