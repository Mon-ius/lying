#!/usr/bin/env python3
"""
Multi-Agent Lying/Deception Experiment System

Entry point for running experiments on lying aversion vs deception aversion
in economic organizations of AI agents.

Based on:
  Choi, Lee & Lim (2025): "The Anatomy of Honesty"
  Sobel (2020): "Lying and Deception in Games"

Usage:
  python main.py                           # Run default experiment
  python main.py --config config/default.yaml
  python main.py --n-agents 500 --c-l-mean -1.0 --c-d-mean 0.5
  python main.py --sweep c_l_mean --sweep-values "-2,-1,0,1,2"
  python main.py --environment BT --num-rounds 20
"""
from __future__ import annotations

import argparse
import sys
import json
import numpy as np
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.config import ExperimentConfig, PopulationConfig, GameConfig, DistributionSpec
from src.experiments import ExperimentRunner
from src.visualization import generate_all_plots, plot_parameter_sensitivity, plot_population_comparison


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Multi-agent lying/deception experiments",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                                    Run with defaults (200 agents, both BT & GL)
  %(prog)s --n-agents 500                     Scale up population
  %(prog)s --c-l-mean 0.5 --c-d-mean -0.5    Shift cost distributions
  %(prog)s --environment BT                   BT environment only
  %(prog)s --sweep c_l_mean -2,-1,0,1,2       Parameter sweep
  %(prog)s --config config/custom.yaml        Load custom config
        """,
    )

    # Config file
    p.add_argument("--config", type=str, default=None,
                   help="Path to YAML config file")

    # Population parameters
    p.add_argument("--n-agents", type=int, default=None,
                   help="Number of agents (default: 200)")
    p.add_argument("--c-l-mean", type=float, default=None,
                   help="Mean of lying cost log-normal distribution")
    p.add_argument("--c-l-sigma", type=float, default=None,
                   help="Sigma of lying cost log-normal distribution")
    p.add_argument("--c-d-mean", type=float, default=None,
                   help="Mean of deception cost log-normal distribution")
    p.add_argument("--c-d-sigma", type=float, default=None,
                   help="Sigma of deception cost log-normal distribution")
    p.add_argument("--alpha-a", type=float, default=None,
                   help="Shape parameter 'a' for risk aversion beta distribution")
    p.add_argument("--alpha-b", type=float, default=None,
                   help="Shape parameter 'b' for risk aversion beta distribution")
    p.add_argument("--beta-loc", type=float, default=None,
                   help="Mean of altruism normal distribution")
    p.add_argument("--beta-scale", type=float, default=None,
                   help="Std of altruism normal distribution")
    p.add_argument("--cost-correlation", type=float, default=None,
                   help="Correlation between c_l and c_d")

    # Explicit population composition
    p.add_argument("--risk-composition", type=str, default=None,
                   help="Explicit risk type proportions, e.g. 'risk_loving:0.15,risk_neutral:0.25,risk_averse:0.60'")
    p.add_argument("--altruism-composition", type=str, default=None,
                   help="Explicit altruism type proportions, e.g. 'altruistic:0.5,selfish:0.3,spiteful:0.2'")
    p.add_argument("--miscommunication-rate", type=float, default=None,
                   help="Probability of message corruption in transit (0-1)")

    # Game parameters
    p.add_argument("--environment", type=str, default=None,
                   choices=["BT", "GL", "both"],
                   help="Game environment (default: both)")
    p.add_argument("--x2-x1-ratio", type=float, default=None,
                   help="Ratio x2/x1 (default: 20)")
    p.add_argument("--num-rounds", type=int, default=None,
                   help="Number of rounds per experiment")
    p.add_argument("--behavioral-prob", type=float, default=None,
                   help="Prior probability of behavioral type")

    # Experiment parameters
    p.add_argument("--num-experiments", type=int, default=None,
                   help="Number of experiment replications")
    p.add_argument("--seed", type=int, default=None,
                   help="Random seed")
    p.add_argument("--output", type=str, default=None,
                   help="Output directory for plots")

    # Parameter sweep
    p.add_argument("--sweep", type=str, default=None,
                   help="Parameter to sweep (e.g., c_l_mean, c_d_mean, alpha_a)")
    p.add_argument("--sweep-values", type=str, default=None,
                   help="Comma-separated values for sweep")
    p.add_argument("--sweep-metric", type=str, default="equilibrium",
                   help="Metric to plot against swept parameter")

    # Display
    p.add_argument("--no-plots", action="store_true",
                   help="Skip plot generation")
    p.add_argument("--save-config", type=str, default=None,
                   help="Save final config to YAML file")
    p.add_argument("--verbose", action="store_true",
                   help="Print detailed output")

    return p.parse_args()


def _parse_composition(s: str) -> dict[str, float]:
    """Parse 'type1:0.3,type2:0.7' into {'type1': 0.3, 'type2': 0.7}."""
    result = {}
    for pair in s.split(","):
        pair = pair.strip()
        if ":" in pair:
            name, val = pair.split(":", 1)
            result[name.strip()] = float(val.strip())
    return result


def build_config(args: argparse.Namespace) -> ExperimentConfig:
    """Build config from args, with config file as base if provided."""
    if args.config:
        config = ExperimentConfig.load(args.config)
    else:
        config = ExperimentConfig()

    # Override population params
    if args.n_agents is not None:
        config.population.n_agents = args.n_agents
    if args.c_l_mean is not None:
        config.population.lying_cost.params["mean"] = args.c_l_mean
    if args.c_l_sigma is not None:
        config.population.lying_cost.params["sigma"] = args.c_l_sigma
    if args.c_d_mean is not None:
        config.population.deception_cost.params["mean"] = args.c_d_mean
    if args.c_d_sigma is not None:
        config.population.deception_cost.params["sigma"] = args.c_d_sigma
    if args.alpha_a is not None:
        config.population.risk_aversion.params["a"] = args.alpha_a
    if args.alpha_b is not None:
        config.population.risk_aversion.params["b"] = args.alpha_b
    if args.beta_loc is not None:
        config.population.altruism.params["loc"] = args.beta_loc
    if args.beta_scale is not None:
        config.population.altruism.params["scale"] = args.beta_scale
    if args.cost_correlation is not None:
        config.population.cost_correlation = args.cost_correlation

    # Explicit composition
    if args.risk_composition is not None:
        from src.config import TypeComposition
        comp = config.population.composition
        comp.risk_types = _parse_composition(args.risk_composition)
        config.population.composition = comp

    if args.altruism_composition is not None:
        from src.config import TypeComposition
        comp = config.population.composition
        comp.altruism_types = _parse_composition(args.altruism_composition)
        config.population.composition = comp

    if args.miscommunication_rate is not None:
        config.population.miscommunication_rate = args.miscommunication_rate
        config.game.miscommunication_rate = args.miscommunication_rate

    # Override game params
    if args.environment is not None:
        config.game.environment = args.environment
    if args.x2_x1_ratio is not None:
        config.game.x2 = args.x2_x1_ratio * config.game.x1
    if args.num_rounds is not None:
        config.game.num_rounds = args.num_rounds
    if args.behavioral_prob is not None:
        config.game.behavioral_prob = args.behavioral_prob

    # Experiment params
    if args.num_experiments is not None:
        config.num_experiments = args.num_experiments
    if args.seed is not None:
        config.seed = args.seed
    if args.output is not None:
        config.output_dir = args.output

    return config


def print_summary(result) -> None:
    """Print experiment summary to console."""
    from src.experiments import ExperimentResult
    r: ExperimentResult = result

    print("\n" + "=" * 70)
    print("EXPERIMENT RESULTS")
    print("=" * 70)

    print(f"\nPopulation: {r.population.n} agents")

    # Parameter statistics
    print("\n--- Utility Parameter Statistics ---")
    for key, label in [("c_l", "Lying cost"), ("c_d", "Deception cost"),
                        ("alpha", "Risk aversion"), ("beta", "Altruism")]:
        data = r.true_distributions[key]
        print(f"  {label:20s}: mean={np.mean(data):.3f}, "
              f"median={np.median(data):.3f}, std={np.std(data):.3f}, "
              f"range=[{np.min(data):.3f}, {np.max(data):.3f}]")

    # Population composition
    print("\n--- Population Composition ---")
    print("  Risk attitudes:")
    for k, v in r.risk_proportions.items():
        print(f"    {k:15s}: {v:.1%}")
    print("  Altruism:")
    for k, v in r.altruism_proportions.items():
        print(f"    {k:15s}: {v:.1%}")
    print("  Honesty preferences:")
    for k, v in r.honesty_proportions.items():
        print(f"    {k:20s}: {v:.1%}")

    # Behavioral classifications
    print("\n--- Behavioral Classification (Inferred from Strategies) ---")
    for k, v in r.classifications.items():
        print(f"  {k:20s}: {v:.1%}")

    # Welfare
    print("\n--- Welfare Metrics ---")
    for k, v in sorted(r.welfare.items()):
        print(f"  {k:35s}: {v:.4f}")

    # Strategy summary
    bt = r.org_result.bt_truth_probs
    gl = r.org_result.gl_lie_probs
    if len(bt) > 0:
        print(f"\n  BT avg truth-telling prob: {np.mean(bt):.3f} (equilibrium: 1.0)")
        print(f"  BT deviation rate: {np.mean(bt < 0.5):.1%}")
    if len(gl) > 0:
        print(f"  GL avg truth-telling prob: {np.mean(gl):.3f} (equilibrium: 0.0)")
        print(f"  GL deviation rate: {np.mean(gl > 0.5):.1%}")

    print("\n" + "=" * 70)


def main() -> None:
    args = parse_args()
    config = build_config(args)

    if args.save_config:
        config.save(args.save_config)
        print(f"Config saved to {args.save_config}")

    if args.sweep:
        # Parameter sweep mode
        if not args.sweep_values:
            print("Error: --sweep-values required for parameter sweep")
            sys.exit(1)

        values = [float(x.strip()) for x in args.sweep_values.split(",")]
        print(f"Running parameter sweep: {args.sweep} = {values}")

        runner = ExperimentRunner(config)
        sweep_result = runner.run_parameter_sweep(args.sweep, values)

        # Print sweep summary
        print(f"\n{'Parameter':>12s} | {'Equilibrium':>12s} | {'Lying Averse':>12s} | "
              f"{'Deception Averse':>16s} | {'Total Welfare':>14s}")
        print("-" * 80)
        for val, res in zip(values, sweep_result.results):
            eq = res.classifications.get("equilibrium", 0)
            la = res.classifications.get("lying_averse", 0) + res.classifications.get("lying_aversion", 0)
            da = res.classifications.get("deception_averse", 0) + res.classifications.get("deception_aversion", 0)

            welfare_keys = [k for k in res.welfare if "total_welfare" in k]
            tw = np.mean([res.welfare[k] for k in welfare_keys]) if welfare_keys else 0
            print(f"{val:12.2f} | {eq:11.1%} | {la:11.1%} | {da:15.1%} | {tw:14.4f}")

        if not args.no_plots:
            # Plot sensitivity
            param_vals, metric_vals = sweep_result.metric_vs_param(args.sweep_metric)
            plot_parameter_sensitivity(
                param_vals, metric_vals, args.sweep, args.sweep_metric,
                config.output_dir,
                f"sweep_{args.sweep}_{args.sweep_metric}.png",
            )

            # Also plot distributions for first and last
            if len(sweep_result.results) >= 2:
                plot_population_comparison(
                    sweep_result.results[0].true_distributions,
                    sweep_result.results[-1].true_distributions,
                    config.output_dir,
                    f"sweep_{args.sweep}_population_comparison.png",
                )

            print(f"\nSweep plots saved to {config.output_dir}/")

    else:
        # Single experiment mode
        print(f"Running experiment: {config.population.n_agents} agents, "
              f"environment={config.game.environment}, "
              f"{config.game.num_rounds} rounds, "
              f"seed={config.seed}")

        runner = ExperimentRunner(config)
        result = runner.run()

        print_summary(result)

        if not args.no_plots:
            generate_all_plots(result, config.output_dir)


if __name__ == "__main__":
    main()
