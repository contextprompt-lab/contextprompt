import { Router } from 'express';
import { Resend } from 'resend';
import { logger } from '../../utils/logger.js';

export const supportRouter = Router();

// Simple in-memory rate limiter: max 5 requests per IP per 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(ip, recent);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  return false;
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, 30 * 60 * 1000).unref();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

supportRouter.post('/contact', (req, res) => {
  const { email, message } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }
  if (message.length > 5000) {
    res.status(400).json({ error: 'Message must be under 5000 characters' });
    return;
  }

  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!apiKey || !supportEmail) {
    logger.error('RESEND_API_KEY or SUPPORT_EMAIL not configured');
    res.status(500).json({ error: 'Support is not configured' });
    return;
  }

  const resend = new Resend(apiKey);

  resend.emails
    .send({
      from: 'contextprompt <support@contextprompt.com>',
      to: supportEmail,
      replyTo: email,
      subject: `[Support] New message from ${email}`,
      text: `From: ${email}\n\n${message.trim()}`,
    })
    .then(() => {
      res.json({ ok: true });
    })
    .catch((err) => {
      logger.error('Failed to send support email:', err);
      res.status(500).json({ error: 'Failed to send message. Please try again.' });
    });
});
