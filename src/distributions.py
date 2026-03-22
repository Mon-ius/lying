"""
Population-level distribution management.

Draws agent utility parameters from configurable continuous distributions.
Supports adjustment of population composition via parameter shifts/scales,
enabling analysis of how group-level utility distributions affect outcomes.

Supported distributions:
  - normal, lognormal, beta, uniform, truncnorm
  - mixture (weighted combination of component distributions)
"""
from __future__ import annotations

import numpy as np
from scipy import stats
from src.config import DistributionSpec, PopulationConfig, TypeComposition


def draw_samples(spec: DistributionSpec, n: int, rng: np.random.Generator) -> np.ndarray:
    """Draw n samples from the specified distribution.

    Args:
        spec: Distribution specification.
        n: Number of samples.
        rng: NumPy random generator.

    Returns:
        Array of n samples, clipped to bounds if specified.
    """
    dt = spec.dist_type
    p = spec.params

    if dt == "normal":
        samples = rng.normal(loc=p.get("loc", 0), scale=p.get("scale", 1), size=n)

    elif dt == "lognormal":
        samples = rng.lognormal(mean=p.get("mean", 0), sigma=p.get("sigma", 1), size=n)

    elif dt == "beta":
        a, b = p.get("a", 2), p.get("b", 2)
        raw = rng.beta(a, b, size=n)
        lo = spec.bounds[0] if spec.bounds else 0.0
        hi = spec.bounds[1] if spec.bounds and spec.bounds[1] is not None else 1.0
        samples = lo + raw * (hi - lo)
        return samples  # already in bounds

    elif dt == "uniform":
        lo = p.get("low", 0.0)
        hi = p.get("high", 1.0)
        samples = rng.uniform(lo, hi, size=n)

    elif dt == "truncnorm":
        loc = p.get("loc", 0)
        scale = p.get("scale", 1)
        lo = spec.bounds[0] if spec.bounds and spec.bounds[0] is not None else -np.inf
        hi = spec.bounds[1] if spec.bounds and spec.bounds[1] is not None else np.inf
        a_std = (lo - loc) / scale
        b_std = (hi - loc) / scale
        samples = stats.truncnorm.rvs(a_std, b_std, loc=loc, scale=scale, size=n, random_state=rng)

    elif dt == "mixture":
        components = p["components"]
        weights = np.array(p["weights"], dtype=float)
        weights /= weights.sum()
        counts = rng.multinomial(n, weights)
        parts = []
        for comp_dict, count in zip(components, counts):
            if count > 0:
                comp_spec = DistributionSpec.from_dict(comp_dict)
                parts.append(draw_samples(comp_spec, int(count), rng))
        samples = np.concatenate(parts)
        rng.shuffle(samples)

    else:
        raise ValueError(f"Unknown distribution type: {dt}")

    # Apply bounds
    if spec.bounds is not None:
        lo = spec.bounds[0] if spec.bounds[0] is not None else -np.inf
        hi = spec.bounds[1] if spec.bounds[1] is not None else np.inf
        samples = np.clip(samples, lo, hi)

    return samples


def draw_correlated_costs(
    spec_cl: DistributionSpec,
    spec_cd: DistributionSpec,
    correlation: float,
    n: int,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray]:
    """Draw (c_l, c_d) with specified rank correlation using Gaussian copula.

    Args:
        spec_cl: Distribution spec for lying cost.
        spec_cd: Distribution spec for deception cost.
        correlation: Desired Spearman rank correlation in [-1, 1].
        n: Number of samples.
        rng: NumPy random generator.

    Returns:
        Tuple of (c_l, c_d) arrays.
    """
    if abs(correlation) < 1e-10:
        c_l = draw_samples(spec_cl, n, rng)
        c_d = draw_samples(spec_cd, n, rng)
        return c_l, c_d

    # Gaussian copula
    cov = np.array([[1.0, correlation], [correlation, 1.0]])
    z = rng.multivariate_normal([0, 0], cov, size=n)
    u = stats.norm.cdf(z)  # uniform marginals

    # Map through inverse marginal CDFs by sorting
    c_l_raw = draw_samples(spec_cl, n, rng)
    c_d_raw = draw_samples(spec_cd, n, rng)

    order_l = np.argsort(np.argsort(u[:, 0]))
    order_d = np.argsort(np.argsort(u[:, 1]))

    c_l = np.sort(c_l_raw)[order_l]
    c_d = np.sort(c_d_raw)[order_d]

    return c_l, c_d


def draw_population_params(
    config: PopulationConfig, rng: np.random.Generator
) -> dict[str, np.ndarray]:
    """Draw all utility parameters for a population of agents.

    Supports two modes:
    1. Continuous distributions (default): draw from DistributionSpec
    2. Explicit composition: when config.composition has non-empty type dicts,
       allocate exact type counts and draw from type-specific sub-distributions.

    Returns:
        Dictionary with keys 'c_l', 'c_d', 'alpha', 'beta', and optionally
        'risk_type', 'altruism_type' (string labels) each mapping to arrays
        of shape (n_agents,).
    """
    n = config.n_agents

    # Lying and deception costs (always from continuous distributions)
    c_l, c_d = draw_correlated_costs(
        config.lying_cost, config.deception_cost,
        config.cost_correlation, n, rng,
    )

    comp = config.composition

    # --- Risk aversion (alpha) ---
    if comp.risk_types:
        alpha, risk_labels = _draw_from_composition(
            comp.risk_types, comp.risk_params, n, rng,
        )
    else:
        alpha = draw_samples(config.risk_aversion, n, rng)
        risk_labels = np.array([""] * n)

    # --- Altruism (beta) ---
    if comp.altruism_types:
        beta, altruism_labels = _draw_from_composition(
            comp.altruism_types, comp.altruism_params, n, rng,
        )
    else:
        beta = draw_samples(config.altruism, n, rng)
        altruism_labels = np.array([""] * n)

    result = {"c_l": c_l, "c_d": c_d, "alpha": alpha, "beta": beta}
    if comp.risk_types:
        result["risk_type"] = risk_labels
    if comp.altruism_types:
        result["altruism_type"] = altruism_labels
    return result


def _draw_from_composition(
    type_proportions: dict[str, float],
    type_params: dict[str, dict[str, float]],
    n: int,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray]:
    """Draw parameter values using explicit type composition.

    Allocates exact agent counts per type (rounding the last group),
    then draws each agent's parameter from a type-specific normal distribution.

    Args:
        type_proportions: {"type_name": proportion}, must sum to ~1.0
        type_params: {"type_name": {"loc": mean, "scale": std}}
        n: Total number of agents.
        rng: Random generator.

    Returns:
        (values, labels): parameter values and type label for each agent.
    """
    types = list(type_proportions.keys())
    props = np.array([type_proportions[t] for t in types], dtype=float)
    props /= props.sum()  # normalize

    # Deterministic allocation: exact counts
    counts = np.round(props * n).astype(int)
    # Fix rounding: adjust the largest group
    diff = n - counts.sum()
    counts[np.argmax(counts)] += diff

    values = np.zeros(n)
    labels = np.empty(n, dtype=object)
    idx = 0

    for type_name, count in zip(types, counts):
        p = type_params.get(type_name, {"loc": 0.0, "scale": 0.3})
        loc = p.get("loc", 0.0)
        scale = p.get("scale", 0.3)
        values[idx:idx + count] = rng.normal(loc, scale, size=count)
        labels[idx:idx + count] = type_name
        idx += count

    # Shuffle to avoid ordering artifacts
    perm = rng.permutation(n)
    return values[perm], labels[perm]


def adjust_distribution(
    samples: np.ndarray,
    shift: float = 0.0,
    scale: float = 1.0,
    bounds: tuple[float | None, float | None] | None = None,
) -> np.ndarray:
    """Shift and scale an existing sample array.

    Useful for counterfactual analysis: "what if the population were
    more risk-averse (shift alpha up) or less lying-averse (scale c_l down)?"
    """
    result = samples * scale + shift
    if bounds is not None:
        lo = bounds[0] if bounds[0] is not None else -np.inf
        hi = bounds[1] if bounds[1] is not None else np.inf
        result = np.clip(result, lo, hi)
    return result


def estimate_density(samples: np.ndarray, grid: np.ndarray) -> np.ndarray:
    """Kernel density estimate on a grid using Gaussian KDE."""
    if len(samples) < 2 or np.std(samples) < 1e-12:
        return np.zeros_like(grid)
    kde = stats.gaussian_kde(samples)
    return kde(grid)


def fit_distribution(samples: np.ndarray, dist_type: str = "lognormal") -> DistributionSpec:
    """Fit a parametric distribution to samples via MLE.

    Returns a DistributionSpec with fitted parameters.
    """
    if dist_type == "lognormal":
        positive = samples[samples > 0]
        if len(positive) < 2:
            return DistributionSpec("lognormal", {"mean": 0.0, "sigma": 1.0}, (0.0, None))
        log_data = np.log(positive)
        mean, sigma = np.mean(log_data), np.std(log_data)
        return DistributionSpec("lognormal", {"mean": float(mean), "sigma": float(sigma)}, (0.0, None))

    elif dist_type == "normal":
        loc, scale = np.mean(samples), np.std(samples)
        return DistributionSpec("normal", {"loc": float(loc), "scale": float(scale)})

    elif dist_type == "beta":
        lo, hi = np.min(samples), np.max(samples)
        if hi - lo < 1e-10:
            return DistributionSpec("beta", {"a": 1.0, "b": 1.0}, (lo, hi))
        normalized = (samples - lo) / (hi - lo)
        normalized = np.clip(normalized, 1e-6, 1 - 1e-6)
        a, b, _, _ = stats.beta.fit(normalized, floc=0, fscale=1)
        return DistributionSpec("beta", {"a": float(a), "b": float(b)}, (float(lo), float(hi)))

    else:
        raise ValueError(f"Unsupported fit distribution: {dist_type}")
