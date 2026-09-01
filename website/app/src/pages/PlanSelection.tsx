import { useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Chip, List, ListItem, ListItemIcon, ListItemText, CircularProgress } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { selectPlan, createCheckoutSession } from '../api';
import { useAuth } from '../hooks/useAuth';

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '$0',
    period: '',
    description: 'Try it with your next meeting — no credit card needed.',
    features: [
      '1 hour/month of recording (~2 meetings)',
      'Repo-aware task extraction',
      'All meeting platforms (Zoom, Meet, Teams, Slack)',
      'All Claude models',
      'Dashboard access',
    ],
    cta: 'Get started free',
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '$30',
    period: ' / mo',
    description: 'For developers and teams with regular standups, planning, or review meetings.',
    features: [
      '15 hours/month of recording (~30 meetings)',
      'Everything in Free',
      'GitHub issue analysis & implementation plans',
      'Multi-language transcription (12 languages)',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    featured: true,
  },
];

export function PlanSelection() {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (planId: 'free' | 'pro') => {
    setLoading(planId);
    try {
      if (planId === 'free') {
        await selectPlan('free');
        await refreshUser();
      } else {
        const { url } = await createCheckoutSession();
        if (url) {
          window.location.href = url;
        }
      }
    } catch (err) {
      console.error('Plan selection failed:', err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Typography variant="h4" sx={{ mb: 1, textAlign: 'center', fontWeight: 700 }}>
        Start turning meetings into code
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
        Paste a meeting link. The bot joins, transcribes, scans your repos, and extracts structured coding tasks.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
        No API keys needed · No credit card for free plan · Cancel anytime
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 800, mb: 3 }}>
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            sx={{
              width: 340,
              position: 'relative',
              border: plan.featured ? '2px solid' : undefined,
              borderColor: plan.featured ? 'primary.main' : undefined,
            }}
          >
            {plan.featured && (
              <Chip
                label="Popular"
                color="primary"
                size="small"
                sx={{ position: 'absolute', top: 12, right: 12 }}
              />
            )}
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6">{plan.name}</Typography>
              <Box sx={{ my: 2 }}>
                <Typography component="span" variant="h3" sx={{ fontWeight: 700 }}>
                  {plan.price}
                </Typography>
                {plan.period && (
                  <Typography component="span" variant="body1" color="text.secondary">
                    {plan.period}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {plan.description}
              </Typography>

              <List dense disablePadding>
                {plan.features.map((feature) => (
                  <ListItem key={feature} disablePadding sx={{ py: 0.3 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <CheckIcon sx={{ fontSize: 18, color: 'success.main' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={feature}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>

              <Button
                variant={plan.featured ? 'contained' : 'outlined'}
                fullWidth
                size="large"
                sx={{ mt: 3 }}
                onClick={() => handleSelect(plan.id)}
                disabled={loading !== null}
              >
                {loading === plan.id ? <CircularProgress size={24} /> : plan.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Social proof + trust signals */}
      <Box sx={{ textAlign: 'center', maxWidth: 560 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
          &ldquo;We used to spend 20 minutes after every standup writing tickets. Now I paste the link and the tasks are ready.&rdquo;
          &nbsp;&mdash; <strong>Marcus R.</strong>, Engineering Lead
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Secure checkout via Stripe &nbsp;&middot;&nbsp; Cancel anytime &nbsp;&middot;&nbsp; Instant activation
        </Typography>
      </Box>
    </Box>
  );
}
