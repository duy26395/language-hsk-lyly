import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app';
import { runSpeakPipelineStream } from './services/voice-pipeline';
import { normalizeChineseVoice } from './services/tts-provider';

const port = Number(process.env.PORT || 3001);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // For development, update in production
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('speak', async (data) => {
    try {
      const { audio, history, hskLevel, ttsVoice, fileName } = data;
      if (typeof audio !== 'string' || !audio) {
        socket.emit('error', { message: 'Audio is required.' });
        return;
      }

      const audioBuffer = Buffer.from(audio, 'base64');
      if (audioBuffer.byteLength === 0 || audioBuffer.byteLength > 8 * 1024 * 1024) {
        socket.emit('error', { message: 'Audio is empty or too large.' });
        return;
      }

      const safeHistory = Array.isArray(history)
        ? history
          .filter((item: any) => item?.role && item?.content)
          .slice(-12)
        : [];
      const safeHskLevel = typeof hskLevel === 'string' && /^HSK [1-6]$/.test(hskLevel)
        ? hskLevel
        : 'HSK 3';
      const safeFileName = typeof fileName === 'string' && /\.(webm|wav|mp3|ogg|m4a|flac)$/i.test(fileName)
        ? fileName
        : 'audio.webm';
      
      await runSpeakPipelineStream(
        audioBuffer, 
        safeHistory, 
        safeHskLevel, 
        safeFileName, 
        normalizeChineseVoice(ttsVoice),
        (event, payload) => {
          socket.emit(event, payload);
        }
      );
    } catch (error) {
      console.error('Socket speak error:', error);
      socket.emit('error', { message: 'Failed to process voice.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

httpServer.listen(port, () => {
  console.log(`Real-time API server is running on http://localhost:${port}`);
});
