"""
Experiment orchestration.

Runs multi-agent organizational experiments with configurable parameters:
  - Experiment I: Replicate Choi et al. (2025) Experiment I (BT and GL games)
  - Experiment II: With belief elicitation for preference vs inference channel separation
  - Organizational: Full N-agent experiment with reputation dynamics
  - Parameter sweep: Vary population distribution parameters and observe outcomes
"""
from __future__ import annotations

import numpy as np
from dataclasses import dataclass, field
from src.config import ExperimentConfig, PopulationConfig, DistributionSpec
from src.agents import AgentPopulation
from src.organization import EconomicOrganization, OrganizationResult
from src.inference import BehavioralInference, InferredParams
from src.beliefs import BeliefSystem


@dataclass
class ExperimentResult:
    """Complete results from an experiment run."""
    config: ExperimentConfig
    org_result: OrganizationResult
    population: AgentPopulation
    inferred: list[InferredParams]
    classifications: dict[str, float]
    welfare: dict[str, float]
    true_distributions: dict[str, np.ndarray]

    # Population-level statistics
    risk_proportions: dict[str, float] = field(default_factory=dict)
    altruism_proportions: dict[str, float] = field(default_factory=dict)
    honesty_proportions: dict[str, float] = field(default_factory=dict)


@dataclass
class SweepResult:
    """Results from a parameter sweep."""
    param_name: str
    param_values: list[float]
    results: list[ExperimentResult]

    def metric_vs_param(self, metric_key: str) -> tuple[np.ndarray, np.ndarray]:
        """Extract a metric as a function of the swept parameter."""
        values = np.array(self.param_values)
        metrics = []
        for r in self.results:
            if metric_key in r.welfare:
                metrics.append(r.welfare[metric_key])
            elif metric_key in r.classifications:
                metrics.append(r.classifications[metric_key])
            else:
                metrics.append(0.0)
        return values, np.array(metrics)


class ExperimentRunner:
    """Orchestrates experiments with configurable parameters."""

    def __init__(self, config: ExperimentConfig):
        self.config = config

    def _run_single(self, config: ExperimentConfig | None = None) -> ExperimentResult:
        """Run a single experiment with the given configuration."""
        cfg = config or self.config
        rng = np.random.default_rng(cfg.seed)

        # Create population
        population = AgentPopulation(cfg.population, rng)

        # Run organization
        org = EconomicOrganization(population, cfg.game, rng)
        org_result = org.run()

        # Behavioral inference
        inferrer = BehavioralInference(
            cfg.game.x1, cfg.game.x2, cfg.game.behavioral_prob,
        )
        inferred = inferrer.infer_population(population, org_result)
        classifications = inferrer.compute_classification_proportions(inferred)

        # Welfare analysis
        welfare = org.welfare_analysis(org_result)

        # True distributions
        true_dist = population.param_arrays()

        # Population composition
        risk_prop = population.classify_by_risk()
        altruism_prop = population.classify_by_altruism()
        honesty_prop = population.classify_by_honesty_preference()

        return ExperimentResult(
            config=cfg,
            org_result=org_result,
            population=population,
            inferred=inferred,
            classifications=classifications,
            welfare=welfare,
            true_distributions=true_dist,
            risk_proportions=risk_prop,
            altruism_proportions=altruism_prop,
            honesty_proportions=honesty_prop,
        )

    def run(self) -> ExperimentResult:
        """Run the configured experiment."""
        return self._run_single()

    def run_multiple(self, n: int | None = None) -> list[ExperimentResult]:
        """Run multiple independent experiments with different seeds."""
        n = n or self.config.num_experiments
        results = []
        for i in range(n):
            cfg = ExperimentConfig(
                population=self.config.population,
                game=self.config.game,
                num_experiments=1,
                seed=self.config.seed + i,
                output_dir=self.config.output_dir,
            )
            results.append(self._run_single(cfg))
        return results

    def run_parameter_sweep(
        self,
        param_name: str,
        values: list[float],
    ) -> SweepResult:
        """Sweep over a population distribution parameter.

        Args:
            param_name: One of:
              - "c_l_mean": shift the mean of lying cost distribution
              - "c_d_mean": shift the mean of deception cost distribution
              - "alpha_a": shape parameter 'a' for risk aversion beta distribution
              - "beta_loc": location of altruism normal distribution
              - "cost_correlation": correlation between c_l and c_d
              - "x2_x1_ratio": relative importance of period 2
              - "n_agents": number of agents
            values: List of values to sweep over.

        Returns:
            SweepResult with one ExperimentResult per parameter value.
        """
        results = []

        for val in values:
            cfg = self._modify_config(param_name, val)
            result = self._run_single(cfg)
            results.append(result)

        return SweepResult(
            param_name=param_name,
            param_values=values,
            results=results,
        )

    def _modify_config(self, param_name: str, value: float) -> ExperimentConfig:
        """Create a modified config with one parameter changed."""
        import copy
        cfg = copy.deepcopy(self.config)

        if param_name == "c_l_mean":
            cfg.population.lying_cost.params["mean"] = value
        elif param_name == "c_d_mean":
            cfg.population.deception_cost.params["mean"] = value
        elif param_name == "c_l_sigma":
            cfg.population.lying_cost.params["sigma"] = value
        elif param_name == "c_d_sigma":
            cfg.population.deception_cost.params["sigma"] = value
        elif param_name == "alpha_a":
            cfg.population.risk_aversion.params["a"] = value
        elif param_name == "alpha_b":
            cfg.population.risk_aversion.params["b"] = value
        elif param_name == "beta_loc":
            cfg.population.altruism.params["loc"] = value
        elif param_name == "beta_scale":
            cfg.population.altruism.params["scale"] = value
        elif param_name == "cost_correlation":
            cfg.population.cost_correlation = value
        elif param_name == "x2_x1_ratio":
            cfg.game.x2 = value * cfg.game.x1
        elif param_name == "n_agents":
            cfg.population.n_agents = int(value)
        elif param_name == "behavioral_prob":
            cfg.game.behavioral_prob = value
        elif param_name == "num_rounds":
            cfg.game.num_rounds = int(value)
        else:
            raise ValueError(f"Unknown parameter: {param_name}")

        return cfg

    @staticmethod
    def aggregate_results(results: list[ExperimentResult]) -> dict[str, dict[str, float]]:
        """Aggregate statistics across multiple experiment runs."""
        if not results:
            return {}

        # Aggregate classifications
        all_class = {}
        for r in results:
            for k, v in r.classifications.items():
                all_class.setdefault(k, []).append(v)

        class_stats = {}
        for k, vals in all_class.items():
            class_stats[k] = {
                "mean": float(np.mean(vals)),
                "std": float(np.std(vals)),
            }

        # Aggregate welfare
        all_welfare = {}
        for r in results:
            for k, v in r.welfare.items():
                all_welfare.setdefault(k, []).append(v)

        welfare_stats = {}
        for k, vals in all_welfare.items():
            welfare_stats[k] = {
                "mean": float(np.mean(vals)),
                "std": float(np.std(vals)),
            }

        return {"classifications": class_stats, "welfare": welfare_stats}
