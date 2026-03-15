import { Router, raw } from 'express';
import Stripe from 'stripe';
import {
  getUserById,
  updateUserPlan,
  updateUserStripe,
  findUserByStripeCustomerId,
} from '../db.js';
import { getSession } from '../db.js';
import { parseCookies } from '../middleware/auth.js';

export const stripeRouter = Router();
export const stripeWebhookRouter = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key);
}

// Create Stripe Checkout session for Pro plan
stripeRouter.post('/checkout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['session_id'];

  if (!sessionId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const sessionResult = getSession(sessionId);
  if (!sessionResult) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  const user = sessionResult.user;
  const appUrl = process.env.APP_URL || 'http://localhost:3847';
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });
    return;
  }

  const stripe = getStripe();

  stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/app/?checkout=success`,
    cancel_url: `${appUrl}/app/?checkout=cancel`,
    client_reference_id: String(user.id),
    customer_email: user.stripe_customer_id ? undefined : user.email,
    customer: user.stripe_customer_id || undefined,
    metadata: { user_id: String(user.id) },
  }).then(session => {
    res.json({ url: session.url });
  }).catch(err => {
    res.status(500).json({ error: (err as Error).message });
  });
});

// Create Stripe billing portal session
stripeRouter.post('/portal', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['session_id'];

  if (!sessionId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const sessionResult = getSession(sessionId);
  if (!sessionResult) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  const user = sessionResult.user;
  if (!user.stripe_customer_id) {
    res.status(400).json({ error: 'No active subscription' });
    return;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3847';
  const stripe = getStripe();

  stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${appUrl}/app/settings`,
  }).then(session => {
    res.json({ url: session.url });
  }).catch(err => {
    res.status(500).json({ error: (err as Error).message });
  });
});

// Stripe webhook handler (must receive raw body for signature verification)
stripeWebhookRouter.post('/', raw({ type: 'application/json' }), (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' });
    return;
  }

  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
    return;
  }

  // Acknowledge immediately
  res.json({ received: true });

  // Process event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id, 10) : null;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (userId) {
        updateUserPlan(userId, 'pro');
        if (customerId && subscriptionId) {
          updateUserStripe(userId, customerId, subscriptionId);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const user = findUserByStripeCustomerId(customerId);
      if (user) {
        updateUserPlan(user.id, 'free');
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Could notify user or flag account — for now just log
      break;
    }
  }
});
