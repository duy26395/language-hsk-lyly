import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { aiRouter } from './routes/ai';
import { voiceRouter } from './routes/voice';
import { vocabularyRouter } from './routes/vocabulary';

const app = express();

// Trust the first hop (reverse proxy / load balancer) so that req.ip
// reflects the real client IP rather than the proxy IP.
// Required for rate limiting to work correctly on Netlify / Railway.
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));

// Global rate limiting on API namespace
app.use('/api', rateLimitMiddleware);

// API Health Check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Modular Routes registration
app.use('/api', aiRouter);
app.use('/api', voiceRouter);
app.use('/api', vocabularyRouter);

// Serve static files - local dev only
// On Netlify, redirects/rewrites in netlify.toml will handle functions routing
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

// SPA routing fallback locally
app.get(/^(?!\/api).+/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (!error) return;
    // If build distribution doesn't exist yet, return 404 for non-API
    res.status(404).send('Not found');
  });
});

export { app };
