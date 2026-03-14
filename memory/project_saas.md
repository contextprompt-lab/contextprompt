---
name: contextprompt is a SaaS product
description: contextprompt is being built as a SaaS product, not a personal/local tool — all features should be designed for deployed multi-user use
type: project
---

contextprompt is a SaaS product, not a personal CLI tool.

**Why:** The user has always intended this to be a deployed product for other developers. Local-only features (like filesystem browsing) don't work in this context.

**How to apply:** Design features for a deployed/hosted environment. Repos should be connected via GitHub OAuth, not local paths. All new features should work when running on Railway (or similar PaaS), not just locally.
