import type { Request, Response, NextFunction } from 'express';
import { getSession, deleteExpiredSessions } from '../db.js';
import type { UserRow } from '../db.js';

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
      userId?: number;
    }
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = rest.join('=');
  }
  return cookies;
}

// Clean up expired sessions periodically (every 6 hours)
let lastCleanup = 0;
function maybeCleanupSessions() {
  const now = Date.now();
  if (now - lastCleanup > 6 * 60 * 60 * 1000) {
    lastCleanup = now;
    deleteExpiredSessions();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  maybeCleanupSessions();

  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['session_id'];

  if (!sessionId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const result = getSession(sessionId);
  if (!result) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  req.user = result.user;
  req.userId = result.user.id;
  next();
}

export function requirePro(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.plan !== 'pro') {
    res.status(403).json({ error: 'Pro plan required' });
    return;
  }
  next();
}
