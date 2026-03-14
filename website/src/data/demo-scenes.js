/**
 * Each scene is a pair: transcript lines (left pane) and output blocks (right pane).
 * Transcript lines type character-by-character.
 * Output blocks appear as groups after corresponding transcript lines finish.
 */

export const scenes = [
  {
    name: 'auth-refactor',
    input: [
      {
        text: '[02:14] Sarah: The auth middleware needs to move to JWT\n         before the compliance deadline next month.',
        speaker: 1,
      },
      {
        text: '[02:31] Mike:  Which files are we talking about? The session\n         store is used in like three places.',
        speaker: 2,
      },
      {
        text: '[02:45] Sarah: Yeah, the main auth.ts and whatever imports\n         the session types. Let\'s also add a refresh\n         endpoint while we\'re at it.',
        speaker: 1,
      },
    ],
    output: [
      {
        // appears after input[1]
        afterInput: 1,
        html: `<span class="output-heading">T1: Replace session tokens with JWT</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/middleware/auth.ts
  src/types/session.ts
<span class="output-label">Steps:</span>
  1. Remove express-session dependency
  2. Install jsonwebtoken
  3. Replace session checks with JWT verify`,
      },
      {
        afterInput: 2,
        html: `<span class="output-heading">T2: Add token refresh endpoint</span>
<span class="output-meta"><span class="badge badge--med">medium</span> review <span class="output-dep">depends on T1</span></span>
<span class="output-label">Files:</span>
  src/routes/auth.ts
<span class="output-label">Steps:</span>
  1. Create POST /auth/refresh route
  2. Validate refresh token, issue new JWT`,
      },
    ],
  },
  {
    name: 'ui-changes',
    input: [
      {
        text: '[00:12] Alex:  The calendar month has arrows \u2014 we should\n         not need that. Just stay in the current month.',
        speaker: 1,
      },
      {
        text: '[00:31] Alex:  And the AI chat modal doesn\'t have a way\n         to close it. Add a close button top right.',
        speaker: 1,
      },
      {
        text: '[01:05] Alex:  For the loading screen \u2014 the background\n         image needs more blur. White blur, not\n         dark blue.',
        speaker: 1,
      },
    ],
    output: [
      {
        afterInput: 0,
        html: `<span class="output-heading">T1: Remove month navigation arrows</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/components/ui/Calendar.tsx
<span class="output-label">Steps:</span>
  1. Remove left/right arrow buttons from JSX
  2. Keep state initialized to current month`,
      },
      {
        afterInput: 1,
        html: `<span class="output-heading">T2: Add close button to AI chat modal</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/screens/profile/ChatScreen.tsx
  src/components/icons/CommonIcons.tsx
<span class="output-label">Steps:</span>
  1. Add XIcon button in top-right header
  2. Wire onPress to onClose() prop`,
      },
      {
        afterInput: 2,
        html: `<span class="output-heading">T3: Increase blur + white overlay</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/screens/logPhoto/AnalyzingScreen.tsx
<span class="output-label">Steps:</span>
  1. Increase blurRadius to 20
  2. Change overlay to rgba(255,255,255,0.5)`,
      },
    ],
  },
  {
    name: 'api-design',
    input: [
      {
        text: '[05:22] Priya: The search endpoint is too slow. We need\n         to paginate and add caching headers.',
        speaker: 1,
      },
      {
        text: '[05:40] James: Should we also add rate limiting? We\'ve\n         been getting hammered by that one client.',
        speaker: 2,
      },
      {
        text: '[05:55] Priya: Yeah, add rate limiting. And move the\n         search logic into its own service file,\n         the controller is getting too big.',
        speaker: 1,
      },
    ],
    output: [
      {
        afterInput: 0,
        html: `<span class="output-heading">T1: Add pagination + caching to search</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/routes/search.ts
  src/services/search.ts
<span class="output-label">Steps:</span>
  1. Add limit/offset query params
  2. Set Cache-Control headers on response`,
      },
      {
        afterInput: 2,
        html: `<span class="output-heading">T2: Add rate limiting middleware</span>
<span class="output-meta"><span class="badge badge--med">medium</span> review</span>
<span class="output-label">Files:</span>
  src/middleware/rate-limit.ts
<span class="output-label">Steps:</span>
  1. Create sliding window rate limiter
  2. Apply to /search route (100 req/min)`,
      },
      {
        afterInput: 2,
        html: `<span class="output-heading">T3: Extract search service from controller</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/services/search.ts (new)
  src/routes/search.ts
<span class="output-label">Steps:</span>
  1. Move query building + filtering to service
  2. Update route to call service methods`,
      },
    ],
  },
];
