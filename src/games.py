"""
Reputation-building sender-receiver games.

Implements the two environments from Choi et al. (2025) Section 2:

  BT (Bad-type Truth-telling):
    - Strategic sender is Bad type, behavioral type tells truth
    - Equilibrium: bad type tells truth in period 1 (deceptive truth-telling)
    - Deviation is driven by deception aversion (Proposition 3)

  GL (Good-type Lying):
    - Strategic sender is Good type, behavioral type always sends m=1
    - Equilibrium: good type lies in period 1 (non-deceptive lying)
    - Deviation is driven by lying aversion (Proposition 4)

Payoff structure (Choi et al. Section 2):
  U_P(theta_1, theta_2, a_1, a_2) = -sum x_i*(a_i - theta_i)^2  [public/receiver]
  U_G(theta_1, theta_2, a_1, a_2) = -sum x_i*(a_i - theta_i)^2  [good type]
  U_B(theta_1, theta_2, a_1, a_2) = -sum x_i*(a_i - 1)^2         [bad type]
"""
from __future__ import annotations

import numpy as np
from dataclasses import dataclass, field
from src.config import GameConfig
from src.beliefs import BeliefSystem
from src.agents import Agent


@dataclass
class RoundResult:
    """Result of a single round (2-period interaction)."""
    game_type: str              # "BT" or "GL"
    sender_id: int
    state_1: int                # period 1 state
    state_2: int                # period 2 state
    message_1: int              # period 1 message
    message_2: int              # period 2 message (deterministic in period 2)
    action_1: float             # receiver's period 1 action
    action_2: float             # receiver's period 2 action
    sender_payoff: float        # sender's total payoff
    receiver_payoff: float      # receiver's total payoff
    is_lie_p1: bool             # was period 1 message a lie?
    is_deceptive_p1: bool       # was period 1 message deceptive w.r.t. type?
    lying_cost_incurred: float
    deception_cost_incurred: float
    truth_telling_prob: float   # sender's strategy (prob of truth in key state)
    strategy_param: float       # v (BT) or w (GL) — mixing parameter


@dataclass
class MatchResult:
    """Result of a match between sender and receiver across multiple rounds."""
    sender_id: int
    game_type: str
    rounds: list[RoundResult] = field(default_factory=list)

    @property
    def avg_truth_prob(self) -> float:
        if not self.rounds:
            return 0.0
        return np.mean([r.truth_telling_prob for r in self.rounds])

    @property
    def avg_sender_payoff(self) -> float:
        return np.mean([r.sender_payoff for r in self.rounds])


class ReputationGame:
    """Base class for reputation-building games."""

    def __init__(self, config: GameConfig):
        self.config = config
        self.x1 = config.x1
        self.x2 = config.x2
        self.belief_system = BeliefSystem(config.behavioral_prob)

    def play_round(
        self, sender: Agent, game_type: str, rng: np.random.Generator,
    ) -> RoundResult:
        """Play one round (2-period interaction).

        Args:
            sender: The strategic sender agent.
            game_type: "BT" or "GL".
            rng: Random generator.

        Returns:
            RoundResult with all game data.
        """
        # Draw states
        state_1 = rng.integers(0, 2)
        state_2 = rng.integers(0, 2)

        # Sender's optimal strategy
        strategy = sender.optimal_strategy(
            game_type, self.belief_system, self.x1, self.x2,
        )

        # Determine the decision-relevant state and message
        if game_type == "BT":
            # Decision point is theta=0: strategy = Pr(truth | theta=0)
            if state_1 == 0:
                # Choose message based on strategy (truth-telling prob)
                tell_truth = rng.random() < strategy
                message_1 = 0 if tell_truth else 1
                v = 1 - strategy  # v = Pr(m=1 | theta=0) = 1 - p_truth
            else:
                # theta=1: always send m=1 (no decision)
                message_1 = 1
                v = 1 - strategy
        else:  # GL
            # Decision point is theta=1: strategy = Pr(lie | theta=1)
            if state_1 == 1:
                tell_lie = rng.random() < strategy
                message_1 = 0 if tell_lie else 1
                w = strategy  # w = Pr(m=0 | theta=1)
            else:
                # theta=0: always send m=0 (truth)
                message_1 = 0
                w = strategy

        strategy_param = v if game_type == "BT" else w

        # --- Miscommunication: message noise ---
        # With probability miscommunication_rate, the received message is flipped.
        # This models information noise / misunderstanding between agents.
        sent_message_1 = message_1
        miscomm_rate = self.config.miscommunication_rate
        if miscomm_rate > 0 and rng.random() < miscomm_rate:
            message_1 = 1 - message_1  # flip: 0->1 or 1->0

        # Receiver's period 1 action
        action_1 = self.belief_system.receiver_action(message_1, strategy_param, game_type)

        # Type belief after period 1
        type_belief = self.belief_system.type_belief(message_1, state_1, strategy_param, game_type)

        # Period 2: sender plays myopically, receiver uses reputation
        if game_type == "BT":
            # Bad type always sends m=1 in period 2 (myopic optimal)
            message_2 = 1
            # Receiver's action based on type belief and period 2 message
            # With reputation lambda, receiver weighs behavioral (truth-teller) vs strategic (liar)
            action_2 = type_belief * state_2 + (1 - type_belief) * 1
            action_2 = min(max(action_2, 0), 1)
        else:
            # Good type tells truth in period 2 (myopic optimal)
            message_2 = state_2
            # Receiver trusts good type more
            action_2 = type_belief * state_2 + (1 - type_belief) * 0.5
            action_2 = min(max(action_2, 0), 1)

        # Compute payoffs
        if game_type == "BT":
            # Bad type: wants a_i = 1 always
            sender_payoff = -self.x1 * (action_1 - 1) ** 2 - self.x2 * (action_2 - 1) ** 2
        else:
            # Good type: wants a_i = theta_i
            sender_payoff = -self.x1 * (action_1 - state_1) ** 2 - self.x2 * (action_2 - state_2) ** 2

        receiver_payoff = -self.x1 * (action_1 - state_1) ** 2 - self.x2 * (action_2 - state_2) ** 2

        # Lying and deception — use the SENT message for sender's moral cost,
        # since the sender chose to lie/deceive regardless of transmission noise
        is_lie = self.belief_system.is_lie(sent_message_1, state_1)
        deception = self.belief_system.deception_measure(sent_message_1, state_1, strategy_param, game_type)
        is_deceptive = deception > 1e-6

        lying_cost = sender.compute_lying_cost(sent_message_1, state_1)
        deception_cost = sender.c_d * deception

        # Truth-telling probability for the key state
        if game_type == "BT":
            truth_prob = strategy if state_1 == 0 else 1.0
        else:
            truth_prob = (1 - strategy) if state_1 == 1 else 1.0

        return RoundResult(
            game_type=game_type,
            sender_id=sender.id,
            state_1=state_1,
            state_2=state_2,
            message_1=message_1,
            message_2=message_2,
            action_1=action_1,
            action_2=action_2,
            sender_payoff=sender_payoff,
            receiver_payoff=receiver_payoff,
            is_lie_p1=is_lie,
            is_deceptive_p1=is_deceptive,
            lying_cost_incurred=lying_cost,
            deception_cost_incurred=deception_cost,
            truth_telling_prob=truth_prob,
            strategy_param=strategy_param,
        )

    def play_match(
        self, sender: Agent, game_type: str, num_rounds: int,
        rng: np.random.Generator,
    ) -> MatchResult:
        """Play multiple rounds of the game with the same sender."""
        match = MatchResult(sender_id=sender.id, game_type=game_type)
        for _ in range(num_rounds):
            result = self.play_round(sender, game_type, rng)
            match.rounds.append(result)
        return match


class BTGame(ReputationGame):
    """Bad-type Truth-telling environment.

    Proposition 1 (Deceptive truth-telling):
      When x2/x1 is large enough, the bad type tells truth in period 1
      to pretend to be the good type.
      When theta=0, the equilibrium message m=0 is:
        (a) a truth, (b) deceptive w.r.t. preference type, (c) not deceptive w.r.t. state

    Proposition 3 (Less reputation building by deception cost):
      - Full reputation building if c_l > c_bar(c_d)
      - Partial if c_lower(c_d) < c_l < c_bar(c_d)
      - No reputation building if c_l < c_lower(c_d)
    """

    def compute_equilibrium_thresholds(self) -> dict[str, float]:
        """Compute the (c_l, c_d) thresholds for equilibrium behavior.

        Returns approximate thresholds based on the model parameters.
        """
        ratio = self.x2 / self.x1
        # These are approximations based on the equilibrium analysis
        # The exact thresholds depend on the specific game parameters
        # From the paper with x2/x1 = 20:
        rep_value = ratio / (ratio + 1)  # approximate reputation value
        return {
            "c_l_lower": 0.0,
            "c_l_upper": rep_value * 0.5,  # approximate
            "rep_value": rep_value,
        }


class GLGame(ReputationGame):
    """Good-type Lying environment.

    Proposition 2 (Non-deceptive lying):
      When x2/x1 is large enough, the good type lies in period 1
      to reveal her type.
      When theta=1, the equilibrium message m=0 is:
        (a) a lie, (b) not deceptive w.r.t. preference type, (c) not deceptive w.r.t. state

    Proposition 4 (Less reputation building by lying cost):
      - Full reputation building if c_l < c_star(c_d)
      - Partial if c_star(c_d) < c_l < c_star_upper(c_d)
      - No reputation building if c_l > c_star_upper(c_d)
    """

    def compute_equilibrium_thresholds(self) -> dict[str, float]:
        ratio = self.x2 / self.x1
        rep_value = ratio / (ratio + 1)
        return {
            "c_l_lower": rep_value * 0.3,
            "c_l_upper": rep_value * 0.7,
            "rep_value": rep_value,
        }
