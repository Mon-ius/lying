---
name: Lying game project overview
description: Multi-agent game theory visualization — lying vs deception in sender-receiver games (Choi/Sobel papers)
type: project
---

Browser-based visualization of reputation-building sender-receiver games from Choi, Lee & Lim (2025) and Sobel (2020).

**Why:** Demonstrates that lying and deception are distinct — agents can lie without deceiving (GL equilibrium) and deceive without lying (BT equilibrium).

**Key files:**
- `js/engine.js` — simulation engine: Bayesian belief updates, moral costs, strategy computation
- `js/game-world.js` — 2D canvas: sprites, arena stage/queue layout, 5-step decision protocol, camera
- `js/charts.js` / `js/ai-charts.js` — Chart.js visualizations (strategy distributions, belief trajectories)
- `js/app.js` — UI controller, parameter panel, run orchestration
- `js/i18n.js` — en/zh/ko translations
- `js/modes.js` — chart/game view switching
- `game.md` — comprehensive design document with math, equilibrium conditions, agent model

**Architecture:** Static HTML/JS/CSS, no build step. Canvas-based game view with phased animation (Village → Oracle → BT Arena → GL Arena → Classification Hall). Agents drawn as sprites with decision cards.

**How to apply:** Read `game.md` for theoretical grounding before modifying engine logic. The arena animation sequentially walks each agent through a 5-step decision protocol on stage.
