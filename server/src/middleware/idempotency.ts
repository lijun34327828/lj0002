import { Request, Response, NextFunction } from 'express';

const pendingRequests = new Map<string, { timestamp: number; response?: any }>();

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return next();
  }
  
  const existing = pendingRequests.get(idempotencyKey);
  
  if (existing) {
    if (existing.response) {
      return res.status(200).json(existing.response);
    }
    return res.status(409).json({ error: '请求正在处理中，请稍后重试' });
  }
  
  pendingRequests.set(idempotencyKey, { timestamp: Date.now() });
  
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      pendingRequests.set(idempotencyKey, {
        timestamp: Date.now(),
        response: body
      });
      setTimeout(() => {
        pendingRequests.delete(idempotencyKey);
      }, 24 * 60 * 60 * 1000);
    }
    return originalJson(body);
  };
  
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingRequests) {
    if (now - value.timestamp > 2 * 60 * 60 * 1000) {
      pendingRequests.delete(key);
    }
  }
}, 30 * 60 * 1000);
