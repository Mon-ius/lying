"""
Configuration dataclasses for experiment parameters.

All configurable parameters are exposed here, including:
- Population-level distribution specs for agent utility parameters (c_l, c_d, alpha, beta)
- Game parameters (period weights, rounds, environment type)
- Experiment-level settings (seed, number of experiments, output)
"""
from __future__ import annotations

import yaml
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any


@dataclass
class DistributionSpec:
    """Specification for a continuous probability distribution.

    Supports: normal, lognormal, beta, uniform, truncnorm, mixture.
    For mixture: params should contain 'components' (list of DistributionSpec dicts)
    and 'weights' (mixing probabilities).
    """
    dist_type: str = "lognormal"
    params: dict[str, Any] = field(default_factory=lambda: {"mean": 0.5, "sigma": 0.8})
    bounds: tuple[float, float] | None = (0.0, None)

    def to_dict(self) -> dict:
        d = {"dist_type": self.dist_type, "params": self.params}
        if self.bounds is not None:
            d["bounds"] = list(self.bounds)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> DistributionSpec:
        bounds = d.get("bounds")
        if bounds is not None:
            bounds = tuple(bounds)
        return cls(
            dist_type=d["dist_type"],
            params=d["params"],
            bounds=bounds,
        )


@dataclass
class TypeComposition:
    """Explicit type proportions for the population.

    When set, agents are allocated into discrete types with exact counts
    rather than being drawn from a continuous distribution. Each type group
    then draws its parameters from type-specific sub-distributions.

    Example:
      risk_types = {"risk_loving": 0.15, "risk_neutral": 0.25, "risk_averse": 0.60}
      This creates exactly 15 risk-loving, 25 risk-neutral, and 60 risk-averse
      agents in a population of 100.
    """
    # Risk attitude proportions: must sum to 1.0
    # risk_loving (alpha < 0), risk_neutral (alpha ~ 0), risk_averse (alpha > 0)
    risk_types: dict[str, float] = field(default_factory=lambda: {})

    # Altruism proportions: must sum to 1.0
    # altruistic (beta > 0), selfish (beta ~ 0), spiteful (beta < 0)
    altruism_types: dict[str, float] = field(default_factory=lambda: {})

    # Type-specific distribution parameters (alpha ranges for each risk type)
    risk_params: dict[str, dict[str, float]] = field(default_factory=lambda: {
        "risk_loving": {"loc": -0.5, "scale": 0.2},   # alpha ~ N(-0.5, 0.2)
        "risk_neutral": {"loc": 0.0, "scale": 0.05},   # alpha ~ N(0, 0.05)
        "risk_averse": {"loc": 0.8, "scale": 0.3},     # alpha ~ N(0.8, 0.3)
    })

    altruism_params: dict[str, dict[str, float]] = field(default_factory=lambda: {
        "altruistic": {"loc": 0.4, "scale": 0.15},
        "selfish": {"loc": 0.0, "scale": 0.03},
        "spiteful": {"loc": -0.3, "scale": 0.15},
    })


@dataclass
class PopulationConfig:
    """Configuration for the agent population.

    Two modes of operation:
    1. Continuous distributions: each parameter drawn from a continuous distribution
       (default; like typical behavioral economics papers)
    2. Explicit composition: set exact type proportions via `composition`
       (e.g., 15% risk-loving, 25% risk-neutral, 60% risk-averse)

    When `composition` has non-empty risk_types or altruism_types,
    agents are allocated to types deterministically, then parameters
    are drawn from type-specific sub-distributions.
    """
    n_agents: int = 200

    # Lying cost distribution: c_l >= 0
    lying_cost: DistributionSpec = field(
        default_factory=lambda: DistributionSpec(
            dist_type="lognormal",
            params={"mean": -0.5, "sigma": 1.0},
            bounds=(0.0, None),
        )
    )

    # Deception cost distribution: c_d >= 0
    deception_cost: DistributionSpec = field(
        default_factory=lambda: DistributionSpec(
            dist_type="lognormal",
            params={"mean": -0.3, "sigma": 1.0},
            bounds=(0.0, None),
        )
    )

    # Risk aversion (CRRA coefficient): alpha
    # alpha<0: risk loving, alpha~0: risk neutral, alpha>0: risk averse
    risk_aversion: DistributionSpec = field(
        default_factory=lambda: DistributionSpec(
            dist_type="beta",
            params={"a": 2.0, "b": 5.0},
            bounds=(0.0, 2.0),
        )
    )

    # Altruism parameter: beta in [-1, 1]
    # beta>0: altruistic, beta=0: selfish, beta<0: spiteful
    altruism: DistributionSpec = field(
        default_factory=lambda: DistributionSpec(
            dist_type="normal",
            params={"loc": 0.1, "scale": 0.3},
            bounds=(-1.0, 1.0),
        )
    )

    # Correlation between c_l and c_d (copula parameter)
    cost_correlation: float = 0.0

    # Explicit type composition (overrides continuous distributions when non-empty)
    composition: TypeComposition = field(default_factory=TypeComposition)

    # Miscommunication rate: probability that a message is corrupted in transit
    # Models information noise / misunderstanding between agents
    # At this rate, the received message is flipped (0->1 or 1->0)
    miscommunication_rate: float = 0.0


@dataclass
class GameConfig:
    """Configuration for the reputation-building game.

    Based on the two-period sender-receiver game from Choi et al. (2025).
    """
    # Environment type: "BT" (bad-type truth-telling), "GL" (good-type lying), or "both"
    environment: str = "both"

    # Period weights: x2/x1 ratio determines reputation-building incentives
    # Paper uses x2/x1 = 20 to ensure unique equilibrium
    x1: float = 1.0
    x2: float = 20.0

    # Number of rounds per experiment
    num_rounds: int = 10

    # Prior probability that the sender is the behavioral type
    behavioral_prob: float = 0.5

    # Matching method for multi-agent: "random", "round_robin"
    matching: str = "random"

    # Miscommunication rate: probability that a message is corrupted in transit
    # (inherited from PopulationConfig if set there; game-level override)
    miscommunication_rate: float = 0.0


@dataclass
class ExperimentConfig:
    """Top-level experiment configuration."""
    population: PopulationConfig = field(default_factory=PopulationConfig)
    game: GameConfig = field(default_factory=GameConfig)

    # Number of independent experiment replications
    num_experiments: int = 1

    # Random seed for reproducibility
    seed: int = 42

    # Output directory for plots and data
    output_dir: str = "output"

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            yaml.dump(asdict(self), f, default_flow_style=False, sort_keys=False)

    @classmethod
    def load(cls, path: str | Path) -> ExperimentConfig:
        with open(path) as f:
            d = yaml.safe_load(f)
        pop_d = d.get("population", {})
        pop = PopulationConfig(
            n_agents=pop_d.get("n_agents", 200),
            lying_cost=DistributionSpec.from_dict(pop_d["lying_cost"]) if "lying_cost" in pop_d else DistributionSpec(),
            deception_cost=DistributionSpec.from_dict(pop_d["deception_cost"]) if "deception_cost" in pop_d else DistributionSpec(),
            risk_aversion=DistributionSpec.from_dict(pop_d["risk_aversion"]) if "risk_aversion" in pop_d else DistributionSpec(),
            altruism=DistributionSpec.from_dict(pop_d["altruism"]) if "altruism" in pop_d else DistributionSpec(),
            cost_correlation=pop_d.get("cost_correlation", 0.0),
        )
        game_d = d.get("game", {})
        game = GameConfig(**{k: v for k, v in game_d.items() if k in GameConfig.__dataclass_fields__})
        return cls(
            population=pop,
            game=game,
            num_experiments=d.get("num_experiments", 1),
            seed=d.get("seed", 42),
            output_dir=d.get("output_dir", "output"),
        )
