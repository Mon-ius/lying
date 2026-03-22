"""
Multi-agent economic organization.

Extends the two-player sender-receiver framework to N agents:
  - Agents are matched into sender-receiver pairs
  - Each pair plays BT and/or GL games over multiple rounds
  - Reputation is tracked across interactions
  - Aggregate statistics computed across the organization

This models an economic organization where AI agents communicate
private information, building and leveraging reputations.
"""
from __future__ import annotations

import numpy as np
from dataclasses import dataclass, field
from src.config import GameConfig, PopulationConfig
from src.agents import Agent, AgentPopulation
from src.games import ReputationGame, MatchResult, RoundResult
from src.beliefs import BeliefSystem


@dataclass
class OrganizationResult:
    """Aggregated results from running the organization experiment."""
    bt_matches: list[MatchResult] = field(default_factory=list)
    gl_matches: list[MatchResult] = field(default_factory=list)

    # Per-agent aggregated strategies
    bt_strategies: dict[int, float] = field(default_factory=dict)  # agent_id -> avg truth prob
    gl_strategies: dict[int, float] = field(default_factory=dict)  # agent_id -> avg lie prob

    # Reputation scores
    reputation_scores: dict[int, float] = field(default_factory=dict)

    @property
    def bt_truth_probs(self) -> np.ndarray:
        return np.array(list(self.bt_strategies.values()))

    @property
    def gl_lie_probs(self) -> np.ndarray:
        return np.array(list(self.gl_strategies.values()))

    def bt_strategy_array(self) -> np.ndarray:
        """All individual truth-telling probabilities from BT rounds."""
        probs = []
        for match in self.bt_matches:
            for r in match.rounds:
                if r.state_1 == 0:
                    probs.append(r.truth_telling_prob)
        return np.array(probs) if probs else np.array([])

    def gl_strategy_array(self) -> np.ndarray:
        """All individual lying probabilities from GL rounds."""
        probs = []
        for match in self.gl_matches:
            for r in match.rounds:
                if r.state_1 == 1:
                    probs.append(1.0 - r.truth_telling_prob)
        return np.array(probs) if probs else np.array([])


class EconomicOrganization:
    """Multi-agent organization with sender-receiver communication games."""

    def __init__(
        self, population: AgentPopulation, game_config: GameConfig,
        rng: np.random.Generator,
    ):
        self.population = population
        self.config = game_config
        self.rng = rng
        self.game = ReputationGame(game_config)
        self.belief_system = BeliefSystem(game_config.behavioral_prob)

        # Reputation tracking: average type belief across interactions
        self._reputation: dict[int, list[float]] = {a.id: [] for a in population.agents}

    def form_pairs(self) -> list[tuple[Agent, Agent]]:
        """Form sender-receiver pairs.

        Returns list of (sender, receiver) tuples.
        Each agent acts as sender once per pairing round.
        """
        agents = list(self.population.agents)
        self.rng.shuffle(agents)
        pairs = []
        for i in range(0, len(agents) - 1, 2):
            pairs.append((agents[i], agents[i + 1]))
        return pairs

    def run(self) -> OrganizationResult:
        """Run the full organizational experiment.

        Each agent plays as sender in both BT and GL environments
        across multiple rounds.
        """
        result = OrganizationResult()
        game_types = []
        if self.config.environment in ("BT", "both"):
            game_types.append("BT")
        if self.config.environment in ("GL", "both"):
            game_types.append("GL")

        for game_type in game_types:
            for agent in self.population.agents:
                match = self.game.play_match(
                    agent, game_type, self.config.num_rounds, self.rng,
                )

                if game_type == "BT":
                    result.bt_matches.append(match)
                    result.bt_strategies[agent.id] = match.avg_truth_prob
                else:
                    result.gl_matches.append(match)
                    result.gl_strategies[agent.id] = match.avg_truth_prob

                # Update reputation
                for r in match.rounds:
                    belief = self.belief_system.type_belief(
                        r.message_1, r.state_1, r.strategy_param, game_type,
                    )
                    self._reputation[agent.id].append(belief)

        # Compute average reputation scores
        for agent_id, beliefs in self._reputation.items():
            if beliefs:
                result.reputation_scores[agent_id] = float(np.mean(beliefs))
            else:
                result.reputation_scores[agent_id] = 0.5

        return result

    def compute_stage1_strategies(
        self, result: OrganizationResult,
    ) -> dict[str, np.ndarray]:
        """Extract stage 1 and stage 2 strategies for clustering analysis.

        Returns dict with keys like 'bt_s1', 'bt_s2', 'gl_s1', 'gl_s2'.
        Each value is array of shape (n_agents,) with average strategy
        across rounds.
        """
        strategies = {}
        n = self.population.n

        for game_type, matches in [("bt", result.bt_matches), ("gl", result.gl_matches)]:
            if not matches:
                continue

            s1 = np.zeros(n)
            s2 = np.zeros(n)
            counts = np.zeros(n)

            for match in matches:
                agent_id = match.sender_id
                for r in match.rounds:
                    if game_type == "bt" and r.state_1 == 0:
                        # Prob of m=1 when theta=0 (key decision)
                        s1[agent_id] += (1 - r.truth_telling_prob)
                        counts[agent_id] += 1
                    elif game_type == "gl" and r.state_1 == 1:
                        # Prob of m=1 when theta=1 (key decision)
                        s1[agent_id] += r.truth_telling_prob
                        counts[agent_id] += 1

                # Stage 2 strategy is myopic, but we record it
                for r in match.rounds:
                    if r.state_2 == 0:
                        s2[agent_id] += (1 if r.message_2 == 1 else 0)
                    else:
                        s2[agent_id] += (1 if r.message_2 == 1 else 0)

            mask = counts > 0
            s1[mask] /= counts[mask]
            s2[mask] /= counts[mask]

            strategies[f"{game_type}_s1"] = s1
            strategies[f"{game_type}_s2"] = s2

        return strategies

    def welfare_analysis(self, result: OrganizationResult) -> dict[str, float]:
        """Compute welfare metrics for the organization."""
        metrics = {}

        for game_type, matches in [("BT", result.bt_matches), ("GL", result.gl_matches)]:
            if not matches:
                continue

            sender_payoffs = []
            receiver_payoffs = []
            lying_costs = []
            deception_costs = []

            for match in matches:
                for r in match.rounds:
                    sender_payoffs.append(r.sender_payoff)
                    receiver_payoffs.append(r.receiver_payoff)
                    lying_costs.append(r.lying_cost_incurred)
                    deception_costs.append(r.deception_cost_incurred)

            prefix = game_type.lower()
            metrics[f"{prefix}_avg_sender_payoff"] = float(np.mean(sender_payoffs))
            metrics[f"{prefix}_avg_receiver_payoff"] = float(np.mean(receiver_payoffs))
            metrics[f"{prefix}_avg_total_welfare"] = float(
                np.mean(sender_payoffs) + np.mean(receiver_payoffs)
            )
            metrics[f"{prefix}_avg_lying_cost"] = float(np.mean(lying_costs))
            metrics[f"{prefix}_avg_deception_cost"] = float(np.mean(deception_costs))
            metrics[f"{prefix}_lie_rate"] = float(np.mean([
                r.is_lie_p1 for m in matches for r in m.rounds
            ]))
            metrics[f"{prefix}_deception_rate"] = float(np.mean([
                r.is_deceptive_p1 for m in matches for r in m.rounds
            ]))

        return metrics
