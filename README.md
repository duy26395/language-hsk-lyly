# Hán Ngữ Thông Minh (Chinese for Lyly) 🇨🇳✨

Ứng dụng web toàn diện hỗ trợ học và luyện tập tiếng Trung (HSK 1 - 6), tích hợp các mô hình AI tiên tiến (Google Gemini, OpenAI, Groq), luyện phát âm và phản xạ hội thoại thời gian thực, cùng hệ thống ghi nhớ từ vựng ngắt quãng (Spaced Repetition System - SRS).

---

## 🌟 Tính Năng Nổi Bật

- 🔍 **Tra Cứu Thông Minh (Smart Search):**
  - Tra từ vựng tiếng Trung kèm Pinyin, Hán tự, định nghĩa, ví dụ câu và phân tích ngữ pháp chuyên sâu bằng AI.
  - Tích hợp tra cứu chéo nhanh qua các từ điển và nền tảng phổ biến: Hanzii, YoHanzi, MDBG, Zdic, YouTube, Bilibili.

- 📖 **Đọc & Phân Tích Đoạn Văn (Read & Analyze):**
  - Tự động phân tách từ vựng trong bài đọc theo cấp độ HSK.
  - Bấm chọn từ để tra cứu tức thì, tra nghĩa ngữ cảnh và lưu nhanh vào Sổ tay.

- ✍️ **Sáng Tạo Đoạn Văn Bằng AI (AI Passage Generator):**
  - Tự động sinh đoạn văn học tập mạch lạc, tự nhiên dựa trên danh sách từ vựng đầu vào và cấp độ HSK chỉ định.

- 🗂️ **Sổ Tay Từ Vựng & Ôn Tập SRS (Notebook & Spaced Repetition):**
  - Lưu trữ và phân loại từ vựng đã học.
  - Thuật toán Spaced Repetition System (SRS) nhắc nhở ôn tập đúng thời điểm, tối ưu khả năng ghi nhớ dài hạn.
  - Đồng bộ cơ sở dữ liệu đám mây (Neon PostgreSQL) hoặc bộ nhớ cục bộ, hỗ trợ xuất và in ấn tài liệu học tập.

- 🎯 **Luyện Thi Trắc Nghiệm HSK (Quiz Wizard):**
  - Bộ câu hỏi tương tác theo cấp độ giúp kiểm tra phản xạ từ vựng, ngữ pháp và khả năng đọc hiểu.

- 🎙️ **Luyện Nói & Phản Xạ Âm Thanh (Speaking Practice):**
  - Giao tiếp hội thoại giọng nói 2 chiều thời gian thực qua WebSocket.
  - Nhận diện giọng nói chuẩn xác (Speech-to-Text) với Groq Whisper.
  - Tổng hợp giọng đọc tiếng Trung bản xứ, tự nhiên với Edge TTS (miễn phí) hoặc Azure Speech.

- 💬 **Trợ Lý Gia Sư AI (AI Chat Tutor):**
  - Trò chuyện, giải đáp thắc mắc ngữ pháp, sửa lỗi diễn đạt và gợi ý cách hành văn chuẩn bản xứ.

- 🔒 **Bảo Vệ Riêng Tư (Security Guard):**
  - Cơ chế khóa màn hình tương tác bảo vệ dữ liệu học tập cá nhân.

---

## 🛠️ Công Nghệ Sử Dụng

### Frontend
- **Framework & Tooling:** React 19, TypeScript, Vite 6.
- **Styling:** Tailwind CSS v4, Lucide React (Icons).
- **Animation:** Framer Motion.
- **Tài nguyên đồ họa:** Vector SVG nhiễu hạt nội bộ (`/noise.svg`), tối ưu tải trang và hỗ trợ ngoại tuyến.

### Backend & Database
- **Runtime:** Node.js, Express, TypeScript (`tsx`).
- **Realtime:** Socket.io, WebSocket (`ws`).
- **Database:** PostgreSQL serverless qua `@neondatabase/serverless` (Neon DB).
- **Bộ nhớ đệm & Giới hạn:** In-memory Explain Cache, Rate Limiting Middleware.

### AI & Speech Providers
- **Large Language Models:** Google Gemini (`@google/genai`), OpenAI GPT-4o, Groq Llama.
- **Speech-to-Text (STT):** Groq Whisper API.
- **Text-to-Speech (TTS):** Edge TTS Universal (mặc định không tốn phí), Azure Cognitive Speech Services.

---

## 📁 Cấu Trúc Thư Mục

```text
├── public/                 # Static assets (noise.svg, icons, v.v.)
├── scripts/
│   └── dev.mjs             # Script khởi chạy đồng thời Frontend & Backend
├── server/
│   ├── cache/              # Bộ nhớ đệm AI explanation
│   ├── constants/          # Cấu hình hằng số server
│   ├── middleware/         # Rate limiting, logging, bảo mật
│   ├── routes/             # Express API routes (ai, vocabulary, voice)
│   ├── services/
│   │   ├── ai/             # Router & provider handlers (Gemini, OpenAI, Groq)
│   │   ├── db.ts           # Kết nối và migration Neon PostgreSQL
│   │   ├── tts-provider.ts # Xử lý phát âm TTS
│   │   └── voice-pipeline.ts # Pipeline xử lý âm thanh realtime
│   ├── app.ts              # Cấu hình Express app
│   └── index.ts            # Entry point backend server & Socket.io
├── src/
│   ├── components/         # Các components & màn hình chính
│   ├── contexts/           # React Context (NotebookContext, v.v.)
│   ├── hooks/              # Custom hooks (useSRS, useNotebook, useVoiceNotice, ...)
│   ├── lib/                # Client utilities (ai client, voice helper, cache)
│   ├── types/              # Định nghĩa kiểu dữ liệu TypeScript
│   ├── App.tsx             # Main component điều hướng tab
│   └── main.tsx            # Entry point React
├── .env.example            # Mẫu cấu hình biến môi trường
├── package.json            # Quản lý dependencies và scripts
├── tsconfig.json           # Cấu hình TypeScript
└── vite.config.ts          # Cấu hình Vite & Tailwind v4
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu Cầu Hệ Thống
- [Node.js](https://nodejs.org/) phiên bản 18 trở lên.
- Quản lý gói `npm` (hoặc `pnpm`, `yarn`).

### 2. Cài Đặt Dependencies
Clone dự án về máy và cài đặt các thư viện cần thiết:
```bash
git clone <repository-url>
cd language-hsk-lyly
npm install
```

### 3. Cấu Hình Biến Môi Trường
Tạo file `.env` tại thư mục gốc của dự án (sao chép từ `.env.example`):
```bash
cp .env.example .env
```

Cập nhật các khóa API và kết nối cần thiết trong `.env`:
```env
# AI Providers
GEMINI_API_KEY="your_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"
GROQ_API_KEY="your_groq_api_key"

# Text-to-Speech (Mặc định dùng "edge", không yêu cầu key)
CHINESE_TTS_PROVIDER="edge"
# Nếu dùng Azure TTS:
# AZURE_SPEECH_KEY="your_azure_speech_key"
# AZURE_SPEECH_REGION="eastasia"

# Database (Neon PostgreSQL serverless pooled connection)
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# Server Port (Mặc định: 3001)
PORT=3001
```

> [!NOTE]
> Mọi API Key đều được giữ an toàn trên Express Backend và **không bị lộ** ra phía client bundle. Client giao tiếp an toàn thông qua proxy `/api/*` và WebSocket.

### 4. Khởi Chạy Môi Trường Phát Triển
Chạy lệnh sau để khởi động đồng thời cả Client (Vite) và Server (Express):
```bash
npm run dev
```

- **Frontend:** `http://localhost:3000` (hoặc port được cấu hình)
- **Backend API:** `http://localhost:3001`

---

## 📜 Các Lệnh Tiện Ích (Scripts)

| Lệnh | Mô tả |
| :--- | :--- |
| `npm run dev` | Khởi chạy đồng bộ Frontend (Vite) và Backend (Express tsx watch) |
| `npm run dev:client` | Khởi chạy độc lập Client Vite |
| `npm run dev:server` | Khởi chạy độc lập Backend Express Server |
| `npm run lint` | Kiểm tra lỗi type toàn dự án bằng `tsc --noEmit` |
| `npm run build` | Đóng gói sản phẩm Frontend cho môi trường production |
| `npm run start` | Khởi chạy server production |
| `npm run clean` | Dọn dẹp thư mục bản build `dist/` |

---

## 🛡️ Thiết Kế Kiến Trúc & Hiệu Năng

- **Bảo mật tuyệt đối:** Các khóa AI (Gemini, OpenAI, Groq) và URL cơ sở dữ liệu được quản lý tập trung ở tầng backend, ngăn chặn hoàn toàn nguy cơ rò rỉ secret key.
- **Explain Caching:** Tích hợp bộ đệm giải thích từ vựng giúp giảm thiểu số lượng request tới AI LLM, tiết kiệm chi phí và tăng tốc độ phản hồi cho người học.
- **Tài nguyên độc lập:** Asset nhiễu hạt nền SVG được lưu trữ trực tiếp trong thư mục `public/`, không phụ thuộc vào dịch vụ bên ngoài, loại bỏ hoàn toàn các lỗi mạng bên thứ ba (như HTTP 402).
- **Hỗ trợ học tập mượt mà:** UI áp dụng Framer Motion và hiệu ứng chuyển trang mềm mại, tối ưu cho trải nghiệm tập trung khi học ngoại ngữ.
