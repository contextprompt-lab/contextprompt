import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import {
  findUserByGoogleId,
  createUser,
  getUserById,
  updateUserPlan,
  createSession,
  deleteSession,
  resetUsageIfNeeded,
  getSession as getSessionDb,
  getDb,
} from '../db.js';
import { parseCookies } from '../middleware/auth.js';

export const authRouter = Router();

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || 'http://localhost:3847';
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }
  return { clientId, clientSecret, appUrl };
}

function setSessionCookie(res: import('express').Response, sessionId: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie',
    `session_id=${sessionId}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`
  );
}

function clearSessionCookie(res: import('express').Response) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie',
    `session_id=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`
  );
}

// Initiate Google OAuth flow
authRouter.get('/google', (req, res) => {
  try {
    const { clientId, appUrl } = getGoogleConfig();
    const state = randomBytes(16).toString('hex');

    // Store state in a short-lived cookie for CSRF protection
    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie',
      `oauth_state=${state}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=600`
    );

    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Google OAuth callback
authRouter.get('/google/callback', async (req, res) => {
  try {
    const { clientId, clientSecret, appUrl } = getGoogleConfig();
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code || !state) {
      res.status(400).send('Missing code or state parameter');
      return;
    }

    // Validate state
    const cookies = parseCookies(req.headers.cookie);
    if (cookies['oauth_state'] !== state) {
      res.status(400).send('Invalid state parameter');
      return;
    }

    // Exchange code for tokens
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      res.status(400).send(`Token exchange failed: ${err}`);
      return;
    }

    const tokenData = await tokenRes.json() as { id_token?: string };
    if (!tokenData.id_token) {
      res.status(400).send('No id_token in response');
      return;
    }

    // Decode ID token payload (trusted — received directly from Google over HTTPS)
    const payload = JSON.parse(
      Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString()
    ) as { sub: string; email: string; name: string; picture?: string };

    // Upsert user
    let user = findUserByGoogleId(payload.sub);
    if (!user) {
      const userId = createUser(payload.sub, payload.email, payload.name, payload.picture ?? null);
      user = getUserById(userId)!;

      // Auto-set admin for configured email
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && user.email === adminEmail) {
        const { getDb } = await import('../db.js');
        getDb().prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
        user = getUserById(user.id)!;
      }
    }

    // Create session
    const sessionId = createSession(user.id);
    setSessionCookie(res, sessionId);

    // Clear oauth_state cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.append('Set-Cookie',
      `oauth_state=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`
    );

    res.redirect('/app/');
  } catch (err) {
    res.status(500).send(`Authentication failed: ${(err as Error).message}`);
  }
});

// Get current user
authRouter.get('/me', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['session_id'];

  if (!sessionId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const result = getSessionDb(sessionId);
  if (!result) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  const user = result.user;
  resetUsageIfNeeded(user.id);

  // Auto-promote admin if configured and not yet flagged
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email === adminEmail && !user.is_admin) {
    getDb().prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
  }

  const fresh = getUserById(user.id)!;

  // Calculate usage limits
  const limitSeconds = fresh.plan === 'pro' ? 54000 : 3600; // 15h or 1h
  const periodLabel = 'month';

  res.json({
    id: fresh.id,
    email: fresh.email,
    name: fresh.name,
    picture: fresh.picture,
    plan: fresh.plan,
    is_admin: Boolean(fresh.is_admin),
    usage: {
      recording_seconds_used: fresh.recording_seconds_used,
      recording_seconds_limit: limitSeconds,
      period: periodLabel,
      reset_at: fresh.usage_reset_at,
    },
  });
});

// Logout
authRouter.post('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['session_id'];

  if (sessionId) {
    deleteSession(sessionId);
  }

  clearSessionCookie(res);
  res.json({ ok: true });
});

// Select plan (first-time only, for free plan)
authRouter.post('/plan', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['session_id'];

  if (!sessionId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const result = getSessionDb(sessionId);
  if (!result) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  const { plan } = req.body as { plan?: string };
  if (plan !== 'free') {
    res.status(400).json({ error: 'Use Stripe checkout for pro plan' });
    return;
  }

  if (result.user.plan !== 'none') {
    res.status(400).json({ error: 'Plan already selected' });
    return;
  }

  updateUserPlan(result.user.id, 'free');
  res.json({ ok: true, plan: 'free' });
});
