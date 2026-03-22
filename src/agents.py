"""
Agent representation with parameterizable utility functions.

Each agent has four utility parameters:
  - c_l: lying cost (Choi et al. Assumption 1)
  - c_d: deception cost (Choi et al. Assumption 2)
  - alpha: risk aversion coefficient (CRRA)
  - beta: altruism / other-regarding preference

The augmented expected utility from Choi et al. Section 5:
  EU^a(m|theta) = EU(m|theta) - c_l * I{m != theta} - c_d * |lambda(m,theta) - lambda(m^n,theta)|
"""
from __future__ import annotations

import numpy as np
from dataclasses import dataclass, field
from src.config import PopulationConfig
from src.distributions import draw_population_params
from src.beliefs import BeliefSystem


@dataclass
class Agent:
    """An agent with utility function parameters.

    Parameters are drawn from population distributions and determine
    the agent's strategic behavior in sender-receiver games.
    """
    id: int
    c_l: float          # lying cost
    c_d: float          # deception cost
    alpha: float        # risk aversion (CRRA)
    beta: float         # altruism parameter

    # Classification (computed after behavioral observation)
    behavioral_type: str = ""  # "equilibrium", "lying_averse", "deception_averse", "inference_error"

    def material_utility(self, payoff: float) -> float:
        """CRRA utility function.

        u(x) = x^(1-alpha)/(1-alpha)  for alpha != 1
        u(x) = ln(x)                  for alpha = 1

        For negative payoffs (quadratic loss), we use the identity function
        since the original game uses quadratic loss directly.
        """
        if abs(self.alpha) < 1e-10:
            return payoff  # risk neutral
        if abs(self.alpha - 1.0) < 1e-10:
            return np.log(max(payoff, 1e-12)) if payoff > 0 else payoff
        if payoff >= 0:
            return payoff ** (1 - self.alpha) / (1 - self.alpha)
        # For losses, apply concave transformation to magnitude
        return -(-payoff) ** (1 - self.alpha) / (1 - self.alpha) if self.alpha < 1 else payoff

    def compute_lying_cost(self, message: int, state: int) -> float:
        """Assumption 1: lying cost c_l when m != theta, 0 otherwise."""
        return self.c_l if message != state else 0.0

    def compute_deception_cost(
        self, message: int, state: int,
        belief_system: BeliefSystem, strategy_param: float,
        game_type: str,
    ) -> float:
        """Assumption 2: c_d * |lambda(m, theta) - lambda(m^n, theta)|."""
        deception = belief_system.deception_measure(message, state, strategy_param, game_type)
        return self.c_d * deception

    def augmented_utility(
        self, message: int, state: int,
        material_eu: float,
        belief_system: BeliefSystem, strategy_param: float,
        game_type: str,
        other_payoff: float = 0.0,
    ) -> float:
        """Compute full augmented expected utility.

        EU^a(m|theta) = EU(m|theta) + beta*other_payoff
                        - c_l*I{m!=theta}
                        - c_d*|lambda(m,theta) - lambda(m^n,theta)|

        Args:
            message: Message sent (0 or 1).
            state: True state (0 or 1).
            material_eu: Material expected utility from sending this message.
            belief_system: Belief system for computing deception.
            strategy_param: Equilibrium strategy parameter (v for BT, w for GL).
            game_type: "BT" or "GL".
            other_payoff: Payoff to the other player (for altruism).
        """
        lying_cost = self.compute_lying_cost(message, state)
        deception_cost = self.compute_deception_cost(
            message, state, belief_system, strategy_param, game_type,
        )
        return (
            self.material_utility(material_eu)
            + self.beta * other_payoff
            - lying_cost
            - deception_cost
        )

    def optimal_strategy_bt(
        self, belief_system: BeliefSystem, x1: float, x2: float,
    ) -> float:
        """Compute optimal truth-telling probability in BT when theta=0.

        In BT, the strategic (bad) sender chooses Pr(m=0 | theta=0).
        Equilibrium predicts Pr(m=0|theta=0) = 1 (truth-telling).

        Returns:
            p_truth: probability of telling truth (sending m=0 when theta=0).
        """
        # At equilibrium v=0, compute payoffs for truth vs lie
        v_eq = 0.0  # equilibrium: no mixing

        # Material expected utilities (from Appendix A.1 with v=0)
        # EU_B(m=0|theta=0) = -x1*(0-1)^2 - x2*((2-v)/(3-2v) - 1)^2
        #                    = -x1 - x2*((2)/(3) - 1)^2  [v=0]
        #                    = -x1 - x2*(1/3)^2 = -x1 - x2/9
        # Actually let me derive from scratch for general v:
        # a_1(0) = 0, a_1(1) = 1/(1+v/2)
        # For bad type: U_B = -sum x_i*(a_i - 1)^2
        # Period 1 payoff for m=0: -x1*(a_1(0) - 1)^2 = -x1*(0-1)^2 = -x1
        # Period 1 payoff for m=1: -x1*(a_1(1) - 1)^2 = -x1*(1/(1+v/2) - 1)^2
        a1_0 = 0.0
        a1_1 = belief_system.bt_receiver_action(1, v_eq)

        eu_truth = -x1 * (a1_0 - 1) ** 2  # period 1 payoff for sending m=0

        # Period 2: after sending m=0, lambda(0,0) = 1/(2-v) [at v=0, = 1]
        # Receiver trusts sender is good type with high prob
        # Period 2 payoff depends on the reputation-building value
        lam_00 = belief_system.bt_lambda(0, 0, v_eq)
        # Expected period 2 action: a_2 = 1/(2-lambda) under the belief
        # For bad type, optimal is a=1, so closer to 1 is better
        a2_after_truth = 1 / (2 - lam_00) if (2 - lam_00) > 1e-12 else 0.5
        eu_truth_p2 = -x2 * (a2_after_truth - 1) ** 2

        eu_lie = -x1 * (a1_1 - 1) ** 2
        lam_10 = belief_system.bt_lambda(1, 0, v_eq)
        a2_after_lie = 1 / (2 - lam_10) if (2 - lam_10) > 1e-12 else 0.5
        eu_lie_p2 = -x2 * (a2_after_lie - 1) ** 2

        # Total material payoffs
        mat_truth = eu_truth + eu_truth_p2
        mat_lie = eu_lie + eu_lie_p2

        # Augmented utilities
        aug_truth = self.augmented_utility(
            0, 0, mat_truth, belief_system, v_eq, "BT",
        )
        aug_lie = self.augmented_utility(
            1, 0, mat_lie, belief_system, v_eq, "BT",
        )

        # Decision
        if aug_truth > aug_lie + 1e-10:
            return 1.0  # always truth
        elif aug_lie > aug_truth + 1e-10:
            return 0.0  # always lie
        else:
            # Indifference: mixed strategy
            # Solve for mixing probability (approximation)
            return 0.5

    def optimal_strategy_gl(
        self, belief_system: BeliefSystem, x1: float, x2: float,
    ) -> float:
        """Compute optimal lying probability in GL when theta=1.

        In GL, the strategic (good) sender chooses Pr(m=0 | theta=1).
        Equilibrium predicts Pr(m=0|theta=1) = 1 (lying to reveal type).

        Returns:
            p_lie: probability of lying (sending m=0 when theta=1).
        """
        w_eq = 1.0  # equilibrium: always lie

        a1_0 = belief_system.gl_receiver_action(0, w_eq)
        a1_1 = belief_system.gl_receiver_action(1, w_eq)

        # Good type: U_G = -sum x_i*(a_i - theta_i)^2
        # Period 1 payoff for m=0 when theta=1: -x1*(a_1(0) - 1)^2
        eu_lie = -x1 * (a1_0 - 1) ** 2

        # Period 2: after lying (m=0), lambda(0,1) = 1, sender is identified as good
        lam_01 = belief_system.gl_lambda(0, 1, w_eq)
        a2_after_lie = lam_01  # good type, receiver matches state
        eu_lie_p2 = -x2 * 0  # perfect reputation, minimal expected loss
        # More precisely: receiver knows type is good, plays optimally
        # Expected loss = 0 in period 2 when perfectly identified
        eu_lie_total = eu_lie + eu_lie_p2

        eu_truth = -x1 * (a1_1 - 1) ** 2
        lam_11 = belief_system.gl_lambda(1, 1, w_eq)
        # After truth (m=1 when theta=1), reputation is diluted
        # a_2 depends on mixed belief
        eu_truth_p2 = -x2 * (1 - lam_11) ** 2  # approximation of reputation loss
        eu_truth_total = eu_truth + eu_truth_p2

        aug_lie = self.augmented_utility(
            0, 1, eu_lie_total, belief_system, w_eq, "GL",
        )
        aug_truth = self.augmented_utility(
            1, 1, eu_truth_total, belief_system, w_eq, "GL",
        )

        if aug_lie > aug_truth + 1e-10:
            return 1.0  # always lie (equilibrium)
        elif aug_truth > aug_lie + 1e-10:
            return 0.0  # always truth (deviation)
        else:
            return 0.5

    def optimal_strategy(
        self, game_type: str, belief_system: BeliefSystem,
        x1: float, x2: float,
    ) -> float:
        """Compute optimal strategy for the relevant state.

        Returns:
            For BT: truth-telling probability when theta=0
            For GL: lying probability when theta=1
        """
        if game_type == "BT":
            return self.optimal_strategy_bt(belief_system, x1, x2)
        else:
            return self.optimal_strategy_gl(belief_system, x1, x2)


class AgentPopulation:
    """A population of agents with heterogeneous utility parameters."""

    def __init__(self, config: PopulationConfig, rng: np.random.Generator):
        params = draw_population_params(config, rng)
        self.agents: list[Agent] = []
        for i in range(config.n_agents):
            self.agents.append(Agent(
                id=i,
                c_l=float(params["c_l"][i]),
                c_d=float(params["c_d"][i]),
                alpha=float(params["alpha"][i]),
                beta=float(params["beta"][i]),
            ))
        self.config = config

    @property
    def n(self) -> int:
        return len(self.agents)

    @property
    def c_l_array(self) -> np.ndarray:
        return np.array([a.c_l for a in self.agents])

    @property
    def c_d_array(self) -> np.ndarray:
        return np.array([a.c_d for a in self.agents])

    @property
    def alpha_array(self) -> np.ndarray:
        return np.array([a.alpha for a in self.agents])

    @property
    def beta_array(self) -> np.ndarray:
        return np.array([a.beta for a in self.agents])

    def param_arrays(self) -> dict[str, np.ndarray]:
        return {
            "c_l": self.c_l_array,
            "c_d": self.c_d_array,
            "alpha": self.alpha_array,
            "beta": self.beta_array,
        }

    def classify_by_risk(self, threshold: float = 0.5) -> dict[str, float]:
        """Classify agents by risk attitude. Returns proportions."""
        alphas = self.alpha_array
        risk_averse = np.mean(alphas > threshold)
        risk_neutral = np.mean(np.abs(alphas) <= threshold)
        risk_seeking = np.mean(alphas < -threshold)
        return {
            "risk_averse": float(risk_averse),
            "risk_neutral": float(risk_neutral),
            "risk_seeking": float(risk_seeking),
        }

    def classify_by_altruism(self, threshold: float = 0.05) -> dict[str, float]:
        """Classify agents by altruism. Returns proportions."""
        betas = self.beta_array
        return {
            "altruistic": float(np.mean(betas > threshold)),
            "selfish": float(np.mean(np.abs(betas) <= threshold)),
            "spiteful": float(np.mean(betas < -threshold)),
        }

    def classify_by_honesty_preference(self) -> dict[str, float]:
        """Classify by relative strength of lying vs deception aversion.

        Based on Choi et al. Section 5 equilibrium characterization:
        - High c_l / c_d: primarily lying-averse
        - High c_d / c_l: primarily deception-averse
        - Both low: strategic / self-interested
        - Both high: fully honest
        """
        c_l = self.c_l_array
        c_d = self.c_d_array
        median_cl = np.median(c_l)
        median_cd = np.median(c_d)

        lying_averse = np.mean((c_l > median_cl) & (c_d <= median_cd))
        deception_averse = np.mean((c_d > median_cd) & (c_l <= median_cl))
        both_averse = np.mean((c_l > median_cl) & (c_d > median_cd))
        strategic = np.mean((c_l <= median_cl) & (c_d <= median_cd))

        return {
            "lying_averse": float(lying_averse),
            "deception_averse": float(deception_averse),
            "fully_honest": float(both_averse),
            "strategic": float(strategic),
        }
