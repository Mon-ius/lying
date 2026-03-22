"""
Bayesian belief updating for reputation-building games.

Implements the belief formation process from Choi et al. (2025) Section 2:
  - Interim belief: Pr(theta | m) — receiver updates about state given message
  - Posterior type belief: lambda(m, theta) = Pr(tau=G | m, theta) — after state revealed
  - Second-order beliefs: sender's belief about receiver's type belief

Definitions follow Sobel (2020):
  - Lying (Def 1): m is a lie given theta if m != theta
  - Deception w.r.t. preference type (Def 2): m is deceptive if there exists m'
    such that the posterior induced by m' is closer to the true type
"""
from __future__ import annotations

import numpy as np


class BeliefSystem:
    """Bayesian belief computation for BT and GL environments.

    Computes equilibrium beliefs as functions of the sender's strategy parameter
    (v in BT, w in GL) and the game configuration.
    """

    def __init__(self, behavioral_prob: float = 0.5):
        """
        Args:
            behavioral_prob: Prior probability sender is behavioral type (p_b).
        """
        self.p_b = behavioral_prob

    # ---- BT Environment (Bad-type Truth-telling) ----
    # Strategic = Bad type, Behavioral = truth-teller (good-type strategy)
    # Equilibrium: strategic tells truth in period 1 to conceal bad type

    def bt_receiver_action(self, message: int, v: float) -> float:
        """Receiver's optimal action in BT given message and strategy v.

        v = Pr(strategic sends m=1 | theta=0), i.e., lying probability.
        In equilibrium, v=0 (strategic tells truth when theta=0).

        Returns: a_1(m) = E[theta | m]
        """
        if message == 0:
            # m=0 is only sent when theta=0 (both types)
            # Pr(theta=1|m=0) = 0 since neither type sends m=0 when theta=1
            return 0.0
        else:
            # m=1: Pr(theta=1|m=1) = Pr(m=1|theta=1) / Pr(m=1)
            # Pr(m=1|theta=1) = 1 (both types send 1 when theta=1)
            # Pr(m=1|theta=0) = p_b*0 + (1-p_b)*v = (1-p_b)*v
            # Pr(m=1) = 1*0.5 + (1-p_b)*v*0.5
            pr_m1 = 0.5 + (1 - self.p_b) * v * 0.5
            if pr_m1 < 1e-12:
                return 1.0
            return 0.5 / pr_m1

    def bt_lambda(self, message: int, state: int, v: float) -> float:
        """Posterior type belief lambda(m, theta) in BT environment.

        lambda(m, theta) = Pr(sender is behavioral/good | m, theta)

        From Appendix A.1:
          lambda(0, 0) = 1/(2-v)   [truth when theta=0, suggests good type]
          lambda(1, 0) = 0          [lie when theta=0, reveals bad type]
          lambda(1, 1) = 1/2        [both types send 1 when theta=1]
          lambda(0, 1) = arbitrary  [off-path]
        """
        if message == 0 and state == 0:
            # Pr(behavioral | m=0, theta=0) = p_b / (p_b + (1-p_b)*(1-v))
            denom = self.p_b + (1 - self.p_b) * (1 - v)
            return self.p_b / denom if denom > 1e-12 else 0.5
        elif message == 1 and state == 0:
            # Only strategic (bad) type sends m=1 when theta=0
            return 0.0
        elif message == 1 and state == 1:
            # Both types send m=1 when theta=1
            return self.p_b
        else:
            # m=0, theta=1: off-path (never observed in equilibrium)
            return self.p_b  # convention: use prior

    def bt_deception_measure(self, message: int, state: int, v: float) -> float:
        """Deception measure in BT: |lambda(m, theta) - lambda(m^n, theta)|.

        m^n is the non-deceptive message (the one whose posterior is closest to truth).
        In BT, sender is Bad type (tau=B), so truth = Pr(tau=G) should be 0.
        Non-deceptive message is the one with lower lambda.
        """
        if state == 0:
            lam_0 = self.bt_lambda(0, 0, v)
            lam_1 = self.bt_lambda(1, 0, v)
            # True type is Bad, so truth = 0. Non-deceptive = min lambda
            lam_n = min(lam_0, lam_1)
            lam_m = self.bt_lambda(message, 0, v)
            return abs(lam_m - lam_n)
        else:
            # theta=1: both messages lead to same type inference or off-path
            return 0.0

    # ---- GL Environment (Good-type Lying) ----
    # Strategic = Good type, Behavioral = always sends m=1 (bad-type strategy)
    # Equilibrium: strategic lies (sends m=0 when theta=1) to reveal good type

    def gl_receiver_action(self, message: int, w: float) -> float:
        """Receiver's optimal action in GL given message and strategy w.

        w = Pr(strategic sends m=0 | theta=1), i.e., lying probability.
        In equilibrium, w=1 (strategic always lies when theta=1).

        Returns: a_1(m) = E[theta | m]
        """
        if message == 0:
            # m=0: strategic sends 0 when theta=0 (always) and when theta=1 (prob w)
            # behavioral never sends 0
            # Pr(theta=1|m=0) = (1-p_b)*w*0.5 / ((1-p_b)*1*0.5 + (1-p_b)*w*0.5)
            # = w/(1+w)
            pr_m0_theta1 = (1 - self.p_b) * w * 0.5
            pr_m0_theta0 = (1 - self.p_b) * 1 * 0.5
            pr_m0 = pr_m0_theta0 + pr_m0_theta1
            if pr_m0 < 1e-12:
                return 0.0
            return pr_m0_theta1 / pr_m0
        else:
            # m=1: behavioral always sends 1, strategic sends 1 when theta=1 with prob (1-w)
            # and sends 1 when theta=0 never (strategic sends 0 when theta=0)
            pr_m1_theta0 = self.p_b * 0.5  # only behavioral
            pr_m1_theta1 = self.p_b * 0.5 + (1 - self.p_b) * (1 - w) * 0.5
            pr_m1 = pr_m1_theta0 + pr_m1_theta1
            if pr_m1 < 1e-12:
                return 0.5
            return pr_m1_theta1 / pr_m1

    def gl_lambda(self, message: int, state: int, w: float) -> float:
        """Posterior type belief lambda(m, theta) in GL environment.

        lambda(m, theta) = Pr(sender is good/strategic | m, theta)
        In GL, strategic IS the good type.

        From Appendix A.2:
          lambda(0, 0) = 1          [only strategic sends 0 when theta=0]
          lambda(0, 1) = 1          [only strategic sends 0 when theta=1]
          lambda(1, 0) = 0          [off-path for strategic; only behavioral]
          lambda(1, 1) = (1-w)/(2-w)  [mixed: behavioral + strategic with prob 1-w]
        """
        if message == 0:
            # Only strategic type sends m=0 (behavioral always sends 1)
            return 1.0
        elif message == 1 and state == 0:
            # m=1 when theta=0: only behavioral sends this (strategic sends 0)
            return 0.0
        else:
            # m=1, theta=1: both behavioral (always) and strategic (prob 1-w)
            pr_strategic = (1 - self.p_b) * (1 - w)
            pr_behavioral = self.p_b
            total = pr_strategic + pr_behavioral
            if total < 1e-12:
                return 0.5
            return pr_strategic / total

    def gl_deception_measure(self, message: int, state: int, w: float) -> float:
        """Deception measure in GL: |lambda(m, theta) - lambda(m^n, theta)|.

        In GL, sender is Good type (tau=G), so truth = Pr(tau=G) should be 1.
        Non-deceptive message is the one with higher lambda (closer to 1).
        """
        if state == 1:
            lam_0 = self.gl_lambda(0, 1, w)
            lam_1 = self.gl_lambda(1, 1, w)
            # True type is Good, so truth = 1. Non-deceptive = max lambda
            lam_n = max(lam_0, lam_1)
            lam_m = self.gl_lambda(message, 1, w)
            return abs(lam_m - lam_n)
        else:
            return 0.0

    # ---- Unified interface ----

    def receiver_action(self, message: int, strategy_param: float, game_type: str) -> float:
        if game_type == "BT":
            return self.bt_receiver_action(message, strategy_param)
        else:
            return self.gl_receiver_action(message, strategy_param)

    def type_belief(self, message: int, state: int, strategy_param: float, game_type: str) -> float:
        if game_type == "BT":
            return self.bt_lambda(message, state, strategy_param)
        else:
            return self.gl_lambda(message, state, strategy_param)

    def deception_measure(self, message: int, state: int, strategy_param: float, game_type: str) -> float:
        if game_type == "BT":
            return self.bt_deception_measure(message, state, strategy_param)
        else:
            return self.gl_deception_measure(message, state, strategy_param)

    def is_lie(self, message: int, state: int) -> bool:
        """Sobel (2020) Definition 1: m is a lie given theta if m != theta."""
        return message != state
