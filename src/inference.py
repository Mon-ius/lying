"""
Behavioral inference of utility function parameters.

Recovers agent utility parameters (c_l, c_d) from observed strategic behavior
using the revealed preference approach from Choi et al. (2025) Section 5.

Key idea: The equilibrium characterization (Propositions 3 & 4) maps regions
in (c_l, c_d)-space to observable strategy profiles:
  - Full reputation building ↔ equilibrium play
  - No reputation building ↔ deviation from equilibrium
  - Partial reputation building ↔ mixed strategy

Combined with second-order beliefs (Experiment II), we can separate the
preference channel (lying/deception aversion) from the inference channel
(erroneous beliefs about receiver behavior).
"""
from __future__ import annotations

import numpy as np
from scipy import optimize
from dataclasses import dataclass
from src.agents import Agent, AgentPopulation
from src.beliefs import BeliefSystem
from src.organization import OrganizationResult


@dataclass
class InferredParams:
    """Inferred utility parameters for a single agent."""
    agent_id: int
    c_l_lower: float    # lower bound on c_l
    c_l_upper: float    # upper bound on c_l
    c_d_lower: float    # lower bound on c_d
    c_d_upper: float    # upper bound on c_d
    classification: str  # "equilibrium", "lying_averse", "deception_averse", "inference_error"
    confidence: float    # confidence in classification [0, 1]


class BehavioralInference:
    """Infer utility function parameters from observed behavior.

    Uses the equilibrium characterization to recover (c_l, c_d) bounds
    from the observed strategies in BT and GL environments.
    """

    def __init__(self, x1: float = 1.0, x2: float = 20.0, behavioral_prob: float = 0.5):
        self.x1 = x1
        self.x2 = x2
        self.beliefs = BeliefSystem(behavioral_prob)
        self._compute_thresholds()

    def _compute_thresholds(self) -> None:
        """Pre-compute the equilibrium thresholds T_BT and T_GL.

        From Section 4.2:
          BT: reputation building worthwhile iff lambda^S(0,0) - lambda^S(1,0) > T_BT
          GL: reputation building worthwhile iff lambda^S(0,1) - lambda^S(1,1) > T_GL

        Conservative thresholds (any receiver action):
          T_BT ≤ 0.2, T_GL ≤ 0.4
        """
        # Using equilibrium receiver actions
        self.T_BT_eq = 0.2    # exact value from paper with equilibrium actions
        self.T_GL_eq = 0.0    # exact value from paper with equilibrium actions
        # Conservative (most robust)
        self.T_BT = 0.2
        self.T_GL = 0.4

        # Material gain from reputation building
        # BT: EU(m=0|theta=0) - EU(m=1|theta=0) = material gain from truth-telling
        # GL: EU(m=0|theta=1) - EU(m=1|theta=1) = material gain from lying
        ratio = self.x2 / self.x1
        self.rep_value_bt = ratio * (1 / 9)  # approximate reputation value in BT
        self.rep_value_gl = ratio * (1 / 4)  # approximate reputation value in GL

    def classify_individual(
        self,
        bt_strategy: float | None,
        gl_strategy: float | None,
        bt_belief_diff: float | None = None,
        gl_belief_diff: float | None = None,
    ) -> str:
        """Classify an agent based on observed strategies and beliefs.

        Classification follows Figure 5 in Choi et al.:

        BT environment:
          - Truth-telling + belief diff > T_BT → Equilibrium Prediction
          - Truth-telling + belief diff ≤ T_BT → Lying Aversion
          - Lying + belief diff > T_BT → Deception Aversion
          - Lying + belief diff ≤ T_BT → Inference Error

        GL environment:
          - Lying + belief diff > T_GL → Lying Aversion (equilibrium deviation)
          - Lying + belief diff ≤ T_GL → Inference Error
          - Truth-telling + belief diff > T_GL → Equilibrium Prediction
          - Truth-telling + belief diff ≤ T_GL → Noise
        """
        # If we have both environments, combine evidence
        bt_class = None
        gl_class = None

        if bt_strategy is not None:
            bt_truth = bt_strategy > 0.5  # truth-telling in BT
            if bt_belief_diff is not None:
                high_belief = bt_belief_diff > self.T_BT
                if bt_truth and high_belief:
                    bt_class = "equilibrium"
                elif bt_truth and not high_belief:
                    bt_class = "lying_averse"
                elif not bt_truth and high_belief:
                    bt_class = "deception_averse"
                else:
                    bt_class = "inference_error"
            else:
                bt_class = "equilibrium" if bt_truth else "deception_averse"

        if gl_strategy is not None:
            # gl_strategy is truth-telling prob; equilibrium predicts lying (low truth prob)
            gl_truth = gl_strategy > 0.5
            if gl_belief_diff is not None:
                high_belief = gl_belief_diff > self.T_GL
                if not gl_truth and high_belief:
                    gl_class = "equilibrium"  # lying with high belief = equilibrium
                elif gl_truth and high_belief:
                    gl_class = "lying_averse"
                elif not gl_truth and not high_belief:
                    gl_class = "noise"
                else:
                    gl_class = "inference_error"
            else:
                gl_class = "equilibrium" if not gl_truth else "lying_averse"

        # Combine
        if bt_class and gl_class:
            if bt_class == "deception_averse" or gl_class == "lying_averse":
                if bt_class == "deception_averse" and gl_class == "lying_averse":
                    return "fully_honest"
                return bt_class if bt_class != "equilibrium" else gl_class
            if bt_class == "equilibrium" and gl_class == "equilibrium":
                return "equilibrium"
            if "inference_error" in (bt_class, gl_class):
                return "inference_error"
            return bt_class

        return bt_class or gl_class or "unknown"

    def infer_cost_bounds(
        self,
        bt_strategy: float | None,
        gl_strategy: float | None,
    ) -> tuple[tuple[float, float], tuple[float, float]]:
        """Infer bounds on (c_l, c_d) from observed strategies.

        Uses Propositions 3 and 4:
          BT: high truth-telling → c_l high relative to c_d (or both low)
                 low truth-telling → c_d low, can afford deception cost
          GL: high lying → c_l low relative to c_d
                 low lying → c_l high, aversion to lying dominates

        Returns:
            ((c_l_lower, c_l_upper), (c_d_lower, c_d_upper))
        """
        c_l_lo, c_l_hi = 0.0, 10.0
        c_d_lo, c_d_hi = 0.0, 10.0

        if bt_strategy is not None:
            if bt_strategy > 0.9:
                # Full truth-telling in BT: c_l must dominate deception gain
                # OR deception cost is low enough that equilibrium is free
                c_l_lo = max(c_l_lo, 0.0)
            elif bt_strategy < 0.1:
                # Full deviation (lying) in BT: deception aversion dominates
                # c_d must be high enough to justify the lying cost
                c_d_lo = max(c_d_lo, self.rep_value_bt * 0.5)
            else:
                # Partial: agent is near indifference
                pass

        if gl_strategy is not None:
            truth_prob_gl = gl_strategy  # truth-telling prob
            if truth_prob_gl < 0.1:
                # Full lying in GL (equilibrium): c_l is low
                c_l_hi = min(c_l_hi, self.rep_value_gl)
            elif truth_prob_gl > 0.9:
                # Full truth in GL (deviation): c_l is high
                c_l_lo = max(c_l_lo, self.rep_value_gl * 0.5)

        return (c_l_lo, c_l_hi), (c_d_lo, c_d_hi)

    def infer_population(
        self,
        population: AgentPopulation,
        result: OrganizationResult,
    ) -> list[InferredParams]:
        """Infer parameters for all agents in the population."""
        inferred = []

        for agent in population.agents:
            bt_strat = result.bt_strategies.get(agent.id)
            gl_strat = result.gl_strategies.get(agent.id)

            classification = self.classify_individual(bt_strat, gl_strat)
            (cl_lo, cl_hi), (cd_lo, cd_hi) = self.infer_cost_bounds(bt_strat, gl_strat)

            # Confidence based on how extreme the strategy is
            confidences = []
            if bt_strat is not None:
                confidences.append(abs(bt_strat - 0.5) * 2)
            if gl_strat is not None:
                confidences.append(abs(gl_strat - 0.5) * 2)
            confidence = float(np.mean(confidences)) if confidences else 0.0

            inferred.append(InferredParams(
                agent_id=agent.id,
                c_l_lower=cl_lo,
                c_l_upper=cl_hi,
                c_d_lower=cd_lo,
                c_d_upper=cd_hi,
                classification=classification,
                confidence=confidence,
            ))

        return inferred

    def compute_classification_proportions(
        self, inferred: list[InferredParams],
    ) -> dict[str, float]:
        """Compute the proportion of each classification type."""
        n = len(inferred)
        if n == 0:
            return {}
        counts: dict[str, int] = {}
        for ip in inferred:
            counts[ip.classification] = counts.get(ip.classification, 0) + 1
        return {k: v / n for k, v in sorted(counts.items())}

    def compare_true_vs_inferred(
        self,
        population: AgentPopulation,
        inferred: list[InferredParams],
    ) -> dict[str, float]:
        """Compare true parameters to inferred bounds.

        Returns accuracy metrics for the inference procedure.
        """
        n = len(inferred)
        cl_in_bounds = 0
        cd_in_bounds = 0

        for ip in inferred:
            agent = population.agents[ip.agent_id]
            if ip.c_l_lower <= agent.c_l <= ip.c_l_upper:
                cl_in_bounds += 1
            if ip.c_d_lower <= agent.c_d <= ip.c_d_upper:
                cd_in_bounds += 1

        return {
            "c_l_coverage": cl_in_bounds / n if n > 0 else 0,
            "c_d_coverage": cd_in_bounds / n if n > 0 else 0,
        }
