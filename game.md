# The Anatomy of Honesty -- Game Design Document

## Theoretical Foundation

This game visualizes and extends the reputation-building sender-receiver game from two academic papers:

- **Choi, Lee & Lim (2025)** -- "The Anatomy of Honesty: Lying Aversion vs. Deception Aversion"
- **Sobel (2020)** -- "Lying and Deception in Games" (*Journal of Political Economy*, 128(3), 907--947)

The core insight: **lying and deception are distinct concepts**. A sender can lie without deceiving (non-deceptive lying) and deceive without lying (deceptive truth-telling). This game lets players observe these phenomena emerge naturally from heterogeneous agents with different moral costs.

---

## Core Definitions (from the Papers)

### Lying (Sobel Def. 1 / Choi Def. 1)

> Message *m* is a **lie** given state *theta* if *m != theta*.
> Message *m* is a **truth** given state *theta* if *m = theta*.

Lying is purely locutionary -- it depends only on the literal relationship between the message and the state. It does not require a model of the audience's response.

### Deception (Sobel Def. 4 / Choi Def. 2)

> Message *m* is **deceptive with respect to the preference type** if there exists another message *m'* such that the receiver's posterior belief induced by *m'* is closer to the sender's true preference type than that induced by *m*.

Deception is illocutionary -- it requires a theory of mind about how the audience interprets messages. The sender must model the receiver's belief-updating process.

### The Key Separation

| | Deceptive | Non-deceptive |
|---|-----------|---------------|
| **Lie** (m != theta) | Common intuition | **GL equilibrium**: good type lies to reveal type |
| **Truth** (m = theta) | **BT equilibrium**: bad type tells truth to conceal type | Ordinary honesty |

---

## Game Environment

### Players

- **Sender (Expert)**: Privately observes the state *theta* in {0, 1} and sends message *m* in {0, 1}
- **Receiver (Public)**: Observes message *m* (not state *theta*), takes action *a* in [0, 1]
- **Nature**: Draws *theta* uniformly from {0, 1} each period

### Preference Types (tau in {Good, Bad})

- **Good type**: Preferences aligned with receiver. Both want *a* close to *theta*
- **Bad type**: Misaligned. Wants receiver to always choose *a = 1* regardless of *theta*

### Behavioral Type

A non-strategic sender (computer-controlled) with fixed rules:
- **In BT**: Always tells the truth (*m = theta*)
- **In GL**: Always sends *m = 1*

The receiver cannot distinguish strategic from behavioral senders. Prior probability of behavioral type: *p_b = 1/2*.

### Payoff Functions (Quadratic Loss)

```
U_Public(theta_1, theta_2, a_1, a_2) = -SUM x_i * (a_i - theta_i)^2
U_Good(theta_1, theta_2, a_1, a_2)  = -SUM x_i * (a_i - theta_i)^2    (aligned with public)
U_Bad(theta_1, theta_2, a_1, a_2)   = -SUM x_i * (a_i - 1)^2           (always wants a=1)
```

Where *x_2 / x_1 > 1* gives higher weight to period 2 (reputation incentive).

---

## Two Reputation-Building Environments

### BT: Bad-type Truth-telling

**Setup**: Strategic sender is the *bad type*. Behavioral type tells truth.

**Equilibrium** (Prop. 1): When *x_2/x_1* is large enough, the bad type tells the truth in period 1 to conceal her type and exploit the built reputation in period 2.

**Result**: When *theta_1 = 0*, the equilibrium message *m_1 = 0* is:
- (a) A **truth** (m = theta)
- (b) **Deceptive** with respect to preference type (mimics good type)
- (c) **Not deceptive** with respect to the state

**This is deceptive truth-telling.**

### GL: Good-type Lying

**Setup**: Strategic sender is the *good type*. Behavioral type always sends *m = 1*.

**Equilibrium** (Prop. 2): When *x_2/x_1* is large enough, the good type always sends *m_1 = 0* in period 1 to reveal her type and secure trust in period 2.

**Result**: When *theta_1 = 1*, the equilibrium message *m_1 = 0* is:
- (a) A **lie** (m != theta)
- (b) **Not deceptive** with respect to preference type (reveals true type)
- (c) **Not deceptive** with respect to the state

**This is non-deceptive lying.**

---

## Bayesian Belief System

### BT Environment

The receiver updates beliefs about the sender's type using Bayes' rule:

```
lambda(0,0) = 1 / (2 - v)     // m=0, theta=0: more likely good type
lambda(1,0) = 0               // m=1, theta=0: certainly bad type (behavioral never lies)
lambda(1,1) = 1/2              // m=1, theta=1: no information (both types send m=1)
```

Where *v = P(m=1 | theta=0)* is the strategic sender's lying probability.

Receiver actions: *a(0) = 0*, *a(1) = 1/(1 + v/2)*

### GL Environment

```
lambda(0,0) = 1               // m=0, theta=0: certainly good type (behavioral sends m=1)
lambda(0,1) = 1               // m=0, theta=1: certainly good type
lambda(1,0) = 0               // m=1, theta=0: certainly bad type
lambda(1,1) = (1-w) / (2-w)   // m=1, theta=1: depends on mixing
```

Where *w = P(m=0 | theta=1)* is the strategic sender's lying probability.

### Deception Measure (Sobel Def. 4, adapted)

```
D_BT(m, theta) = |lambda(m, theta) - min(lambda(0, theta), lambda(1, theta))|
D_GL(m, theta) = |lambda(m, theta) - max(lambda(0, theta), lambda(1, theta))|
```

This measures how far the induced belief is from the closest-to-truth belief achievable by any message.

---

## Augmented Utility with Moral Costs (Choi Section 5)

Each agent has intrinsic moral costs that modify their expected utility:

```
EU^a(m | theta) = EU(m | theta) - c_l * I{m != theta} - c_d * |lambda(m,theta) - lambda(m^n, theta)|
```

Where:
- **c_l >= 0**: Lying cost -- penalty for sending a literally false message
- **c_d >= 0**: Deception cost -- penalty proportional to belief distortion
- **I{m != theta}**: Indicator for lying (binary)
- **|lambda(m,theta) - lambda(m^n, theta)|**: Deception measure (continuous)

### Equilibrium Characterization with Costs

**Proposition 3 (BT -- Less Reputation Building by Deception Cost)**:
- *c_l > c_bar(c_d)*: Full reputation-building (tell truth = deceive)
- *c_l* in between: Partial reputation-building (mixed strategy)
- *c_l < c_underbar(c_d)*: No reputation-building (refuse to deceive)

**Proposition 4 (GL -- Less Reputation Building by Lying Cost)**:
- *c_l < c_star(c_d)*: Full reputation-building (lie = non-deceptive)
- *c_l* in between: Partial reputation-building (mixed strategy)
- *c_l > c_star_star(c_d)*: No reputation-building (refuse to lie)

---

## Agent Population Model

### Heterogeneous Parameters

Each agent *i* draws:
- **c_l ~ LogNormal(mu_l, 1)**: Lying cost (higher = more averse to literal lies)
- **c_d ~ LogNormal(mu_d, 1)**: Deception cost (higher = more averse to belief manipulation)
- **alpha ~ Normal(loc, scale)**: Risk attitude (CRRA parameter)
  - Risk-loving: alpha < 0 (loc = -0.5)
  - Risk-neutral: alpha ~ 0 (loc = 0)
  - Risk-averse: alpha > 0 (loc = 0.8)
- **beta ~ Normal(0.1, 0.3)**: Altruism weight, clipped to [-1, 1]

### Classification (Choi Figure 5)

After playing both BT and GL environments, each agent is classified by cross-environment behavior:

| Classification | BT Behavior | GL Behavior | Interpretation |
|---|---|---|---|
| **Equilibrium** | Truth-tell (tp > 0.5) | Lie (tp < 0.5) | Follows equilibrium in both; no moral override |
| **Lying-averse** | Truth-tell (tp > 0.5) | Truth-tell (tp >= 0.5) | Refuses to lie even when non-deceptive |
| **Deception-averse** | Lie (tp <= 0.5) | Lie (tp < 0.5) | Refuses to deceive even by telling truth |
| **Inference error** | Lie (tp <= 0.5) | Truth-tell (tp >= 0.5) | Deviates in both; misunderstands incentives |

Experimental data (Choi Table 2):
- BT: 31% equilibrium, 53% deception-averse, 16% inference error
- GL: 16% equilibrium, 47% lying-averse, 37% inference error

---

## Multi-Period Extension

The game supports N-period play with geometric period weights:

```
weights = [1, ratio^(1/(N-1)), ratio^(2/(N-1)), ..., ratio]
```

Each period:
1. Nature draws *theta_t* uniformly from {0, 1}
2. Sender computes strategy using augmented utility given current belief *lambda*
3. Sender sends message *m_t* (possibly mixed)
4. Channel noise: message flipped with probability *epsilon* (miscommunication)
5. Receiver updates belief, takes action *a_t*
6. State revealed; receiver updates type belief *lambda(m, theta)*
7. Belief *lambda* carries forward to next period

---

## Game Visualization Phases

### Phase 1: Population Hub

All agents spawn in the village. Each agent displays:
- Numbered name (e.g., "1.Alice")
- Risk type label (risk-loving / neutral / averse)
- Skin tone and shirt color coded by risk type

### Phase 2: Strategy Oracle

Agents move to the oracle building to receive their optimal strategies computed from their individual *(c_l, c_d, alpha, beta)* parameters.

### Phase 3: BT Arena

Agents enter the BT Arena. The arena uses a **stage + queue layout**:

```
+----------------------------------+
| BT Arena                         |
| +--- Action Stage --------------+|
| |  [Active Agent]               ||
| |  [5-Step Decision Card]       ||
| +--- Queue ---------------------+|
| |  A  B  C  D  E  F  G         ||
| |  H  I  J  K  L               ||
| +-------------------------------+|
+----------------------------------+
```

**Every agent** performs on the action stage sequentially. The queue shows waiting agents at full opacity (no dimming). The active agent walks from queue to stage, performs the 5-step protocol, then returns to queue.

#### 5-Step Decision Protocol (per agent)

Each decision is visualized as a 5-node flow diagram:

| Step | Icon | Description |
|------|------|-------------|
| 1. Nature | dice | Nature draws state *theta* in {0, 1} |
| 2. Message | speech | Sender observes *theta*, computes strategy, sends *m* |
| 3. Channel | shuffle | Miscommunication check: *m* may flip with probability *epsilon* |
| 4. Receiver | brain | Receiver updates belief *lambda*, takes action *a* |
| 5. Payoff | money | Payoff computed including moral costs *(c_l, c_d)* |

Tags displayed: LIE/TRUTH (red/green), DECEPTIVE (purple), MISCOMM (orange).

### Phase 4: GL Arena

Same format as BT Arena but in the GL environment. Key visual difference: in GL, lies are non-deceptive (LIE tag without DECEPTIVE tag is the equilibrium behavior).

### Phase 5: Classification Hall

All agents move to the Classification Hall. Each agent receives their classification label and color:
- Blue: Equilibrium
- Green: Lying-averse
- Red: Deception-averse
- Orange: Inference error

Summary statistics displayed:
- Classification distribution (count + percentage)
- Average welfare
- Total decisions count

---

## Current Limitation: detailCount Cap

### Problem

In `_playArena()`, the number of agents who get the full stage animation is capped:

```js
const detailCount = Math.min(totalAgents, Math.max(3, Math.min(8, Math.ceil(n / 4))));
```

For 20 agents: `min(20, max(3, min(8, 5))) = 5`. Only 5 agents perform on stage; the remaining 15 are fast-forwarded with a summary log entry. This makes the game feel incomplete and contradicts the paper's emphasis on observing *every* agent's individual behavior.

### Solution: Animate All Agents

All agents should perform on the action stage. To keep the experience manageable:

1. **Adaptive speed**: Auto-increase animation speed as agent count grows
2. **Batch pacing**: For large populations (>30), reduce per-step wait times proportionally
3. **Skip-ahead button**: Let users fast-forward to a specific agent or skip remaining
4. **Smart camera**: Camera zooms into stage during decisions, pulls back to show queue between agents

Suggested timing scale:

| Agents | Per-step wait | Total per agent | Total arena time |
|--------|-------------|----------------|-----------------|
| <= 10 | 500ms | ~3s | ~30s |
| 11-30 | 300ms | ~2s | ~60s |
| 31-60 | 150ms | ~1s | ~60s |
| 61-100 | 80ms | ~0.5s | ~50s |
| > 100 | 40ms | ~0.3s | ~30s |

---

## Configurable Parameters

| Parameter | Default | Range | Paper Reference |
|---|---|---|---|
| Agent count (n) | 20 | 2-128 | Monte Carlo population |
| Risk composition | 33/34/33 | 0-100% each | alpha distribution |
| Lying cost mean (mu_l) | 0 | -3 to 3 | Choi Assumption 1 |
| Deception cost mean (mu_d) | 0 | -3 to 3 | Choi Assumption 2 |
| Game environment | Both | BT / GL / Both | Choi Section 2 |
| Rounds per agent | 1 | 1-20 | Experimental rounds |
| x2/x1 ratio | 20 | 1-100 | Choi Section 3.1; >= 36/5 for unique BT eq. |
| Behavioral prior (p_b) | 0.5 | 0-1 | Choi Section 2 |
| Miscommunication (epsilon) | 0 | 0-0.5 | Choi Section 2 |
| Periods per game | 2 | 1-10 | N-period extension |

---

## Output Visualizations

### Chart View

1. **Sender Strategy Distribution**: Histogram of truth-telling probabilities (replicates Choi Figure 2)
2. **Strategy vs. Costs Scatter**: Agent strategies plotted against (c_l, c_d) pairs
3. **Belief Trajectory**: Lambda evolution across periods
4. **Classification Pie/Bar**: Distribution across 4 categories
5. **Payoff Distribution**: Histogram of sender and receiver payoffs

### Game View

Real-time 2D canvas animation showing:
- Agent sprites with names, risk labels, classification colors
- Building cards (Village, Oracle, BT Arena, GL Arena, Hall)
- Stage/queue arena layout with sequential agent decisions
- 5-step decision card with flow diagram
- Camera system with auto-follow and manual zoom/pan
- Foldable game log with phase/period grouping

---

## References

1. Choi, S., Lee, C., & Lim, W. (2025). The Anatomy of Honesty: Lying Aversion vs. Deception Aversion. Working Paper.
2. Sobel, J. (2020). Lying and Deception in Games. *Journal of Political Economy*, 128(3), 907-947.
3. Kartik, N. (2009). Strategic Communication with Lying Costs. *Review of Economic Studies*, 76(4), 1359-1395.
4. Benabou, R. & Laroque, G. (1992). Using Privileged Information to Manipulate Markets. *QJE*, 107(3), 921-958.
5. Crawford, V. & Sobel, J. (1982). Strategic Information Transmission. *Econometrica*, 50(6), 1431-1451.
