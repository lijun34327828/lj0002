import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { getDb } from './db';

import authRoutes from './routes/authRoutes';
import questionRoutes from './routes/questionRoutes';
import examRoutes from './routes/examRoutes';
import resultRoutes from './routes/resultRoutes';

const app = express();

app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: ['x-total-count']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

app.get('/api/health', (req, res) => {
  const db = getDb();
  const dbStatus = db.open ? 'connected' : 'disconnected';
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    version: '1.0.0'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/results', resultRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  
  if (err.status === 400) {
    return res.status(400).json({ error: err.message || '请求参数错误' });
  }
  
  if (err.status === 401) {
    return res.status(401).json({ error: err.message || '未授权' });
  }
  
  if (err.status === 403) {
    return res.status(403).json({ error: err.message || '权限不足' });
  }
  
  if (err.status === 404) {
    return res.status(404).json({ error: err.message || '资源不存在' });
  }
  
  res.status(500).json({ error: '服务器内部错误' });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'API端点不存在' });
});

export function startServer(port: number = config.port): Promise<void> {
  return new Promise((resolve) => {
    getDb();
    
    app.listen(port, () => {
      console.log(`
╔═══════════════════════════════════════════════╗
║     在线考试平台 - 后端服务已启动             ║
║     端口: ${port}                              ║
║     数据库: SQLite                            ║
║     状态: 运行中                               ║
╚═══════════════════════════════════════════════╝
      `);
      resolve();
    });
  });
}

if (require.main === module) {
  startServer().catch(console.error);
}

export default app;
