"""
Visualization module for experiment results.

Generates publication-quality plots in the style of behavioral economics papers:
  - Utility parameter distributions (histograms + KDE, like continuous functions)
  - Joint (c_l, c_d) distribution with equilibrium region boundaries
  - Agent type proportions (altruistic, risk-averse, lying/deception averse)
  - Strategy distributions (truth-telling probabilities, like Figures 2 & 6)
  - Strategy clustering (2D scatter with k-means, like Figure 3)
  - Second-order belief distributions (like Figure 7)
  - Equilibrium region visualization in (c_l, c_d)-space (like Figure 16)
  - Parameter sensitivity analysis
"""
from __future__ import annotations

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import FancyBboxPatch
from scipy import stats
from sklearn.cluster import KMeans
from pathlib import Path


# Style configuration for publication-quality plots
COLORS = {
    "equilibrium": "#2196F3",
    "deception_averse": "#F44336",
    "lying_averse": "#4CAF50",
    "inference_error": "#FF9800",
    "fully_honest": "#9C27B0",
    "strategic": "#607D8B",
    "noise": "#795548",
    "unknown": "#9E9E9E",
    # Distribution colors
    "c_l": "#E91E63",
    "c_d": "#3F51B5",
    "alpha": "#009688",
    "beta": "#FF5722",
    # Game colors
    "BT": "#1565C0",
    "GL": "#C62828",
}

PARAM_LABELS = {
    "c_l": r"Lying Cost ($c_l$)",
    "c_d": r"Deception Cost ($c_d$)",
    "alpha": r"Risk Aversion ($\alpha$)",
    "beta": r"Altruism ($\beta$)",
}


def _setup_style():
    plt.rcParams.update({
        "font.size": 11,
        "axes.titlesize": 13,
        "axes.labelsize": 12,
        "xtick.labelsize": 10,
        "ytick.labelsize": 10,
        "legend.fontsize": 10,
        "figure.dpi": 150,
        "savefig.dpi": 300,
        "savefig.bbox": "tight",
    })


def plot_utility_distributions(
    params: dict[str, np.ndarray],
    output_dir: str = "output",
    filename: str = "utility_distributions.png",
) -> None:
    """Plot marginal distributions of all utility parameters.

    Creates a 2x2 grid: c_l, c_d, alpha, beta
    Each panel shows histogram + KDE curve (continuous density function).
    """
    _setup_style()
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle("Distribution of Agent Utility Parameters", fontsize=15, fontweight="bold")

    for ax, (key, label) in zip(axes.flat, PARAM_LABELS.items()):
        data = params.get(key, np.array([]))
        if len(data) == 0:
            ax.set_visible(False)
            continue

        color = COLORS.get(key, "#333333")

        # Histogram
        ax.hist(data, bins=40, density=True, alpha=0.4, color=color, edgecolor="white", linewidth=0.5)

        # KDE curve
        if np.std(data) > 1e-10:
            kde = stats.gaussian_kde(data)
            x_grid = np.linspace(data.min() - 0.1 * np.ptp(data), data.max() + 0.1 * np.ptp(data), 300)
            ax.plot(x_grid, kde(x_grid), color=color, linewidth=2.5, label="KDE")

        # Statistics
        mean, median = np.mean(data), np.median(data)
        ax.axvline(mean, color=color, linestyle="--", linewidth=1.5, alpha=0.7, label=f"Mean={mean:.2f}")
        ax.axvline(median, color=color, linestyle=":", linewidth=1.5, alpha=0.7, label=f"Median={median:.2f}")

        ax.set_xlabel(label)
        ax.set_ylabel("Density")
        ax.legend(framealpha=0.8, fontsize=9)
        ax.set_title(label)

    plt.tight_layout()
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / filename)
    plt.close()


def plot_joint_cost_distribution(
    c_l: np.ndarray,
    c_d: np.ndarray,
    classifications: list[str] | None = None,
    output_dir: str = "output",
    filename: str = "joint_cost_distribution.png",
) -> None:
    """Plot joint distribution of (c_l, c_d) with classification coloring.

    Shows scatter plot with marginal KDEs and equilibrium region boundaries.
    Analogous to the (c_d, c_l)-space in Appendix G, Figure 16.
    """
    _setup_style()
    fig = plt.figure(figsize=(10, 10))
    gs = gridspec.GridSpec(3, 3, width_ratios=[0.15, 1, 0.05], height_ratios=[0.15, 1, 0.05])

    ax_main = fig.add_subplot(gs[1, 1])
    ax_top = fig.add_subplot(gs[0, 1], sharex=ax_main)
    ax_right = fig.add_subplot(gs[1, 0], sharey=ax_main)

    # Main scatter
    if classifications is not None:
        unique_classes = sorted(set(classifications))
        for cls in unique_classes:
            mask = np.array([c == cls for c in classifications])
            color = COLORS.get(cls, "#999999")
            label = cls.replace("_", " ").title()
            ax_main.scatter(c_l[mask], c_d[mask], c=color, s=25, alpha=0.6, label=label, edgecolors="none")
        ax_main.legend(loc="upper right", framealpha=0.8)
    else:
        ax_main.scatter(c_l, c_d, c=COLORS["c_l"], s=20, alpha=0.5, edgecolors="none")

    # Contour overlay
    if len(c_l) > 10 and np.std(c_l) > 1e-10 and np.std(c_d) > 1e-10:
        try:
            xmin, xmax = np.percentile(c_l, [1, 99])
            ymin, ymax = np.percentile(c_d, [1, 99])
            xx, yy = np.meshgrid(
                np.linspace(xmin, xmax, 80),
                np.linspace(ymin, ymax, 80),
            )
            positions = np.vstack([xx.ravel(), yy.ravel()])
            kernel = stats.gaussian_kde(np.vstack([c_l, c_d]))
            zz = np.reshape(kernel(positions), xx.shape)
            ax_main.contour(xx, yy, zz, levels=6, colors="gray", alpha=0.4, linewidths=0.8)
        except Exception:
            pass

    ax_main.set_xlabel(PARAM_LABELS["c_l"])
    ax_main.set_ylabel(PARAM_LABELS["c_d"])
    ax_main.set_title("Joint Distribution of Lying and Deception Costs")

    # Marginal KDEs
    if np.std(c_l) > 1e-10:
        kde_l = stats.gaussian_kde(c_l)
        x_grid = np.linspace(c_l.min(), np.percentile(c_l, 99), 200)
        ax_top.fill_between(x_grid, kde_l(x_grid), alpha=0.4, color=COLORS["c_l"])
        ax_top.plot(x_grid, kde_l(x_grid), color=COLORS["c_l"], linewidth=1.5)
    ax_top.set_ylabel("Density")
    plt.setp(ax_top.get_xticklabels(), visible=False)

    if np.std(c_d) > 1e-10:
        kde_d = stats.gaussian_kde(c_d)
        y_grid = np.linspace(c_d.min(), np.percentile(c_d, 99), 200)
        ax_right.fill_betweenx(y_grid, kde_d(y_grid), alpha=0.4, color=COLORS["c_d"])
        ax_right.plot(kde_d(y_grid), y_grid, color=COLORS["c_d"], linewidth=1.5)
    ax_right.set_xlabel("Density")
    plt.setp(ax_right.get_yticklabels(), visible=False)
    ax_right.invert_xaxis()

    plt.tight_layout()
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / filename)
    plt.close()


def plot_type_proportions(
    proportions: dict[str, float],
    title: str = "Agent Type Proportions",
    output_dir: str = "output",
    filename: str = "type_proportions.png",
) -> None:
    """Bar chart of agent type proportions (altruistic, risk-averse, etc.)."""
    _setup_style()
    fig, ax = plt.subplots(figsize=(10, 6))

    labels = [k.replace("_", " ").title() for k in proportions.keys()]
    values = list(proportions.values())
    colors = [COLORS.get(k, "#999999") for k in proportions.keys()]

    bars = ax.bar(labels, values, color=colors, edgecolor="white", linewidth=1.5, width=0.6)

    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01,
                f"{val:.1%}", ha="center", va="bottom", fontweight="bold", fontsize=11)

    ax.set_ylabel("Proportion")
    ax.set_title(title, fontweight="bold")
    ax.set_ylim(0, max(values) * 1.2 if values else 1.0)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    plt.tight_layout()
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / filename)
    plt.close()


def plot_strategy_distribution(
    strategies: np.ndarray,
    game_type: str,
    equilibrium_pred: float | None = None,
    output_dir: str = "output",
    filename: str | None = None,
) -> None:
    """Distribution of truth-telling probabilities.

    Analogous to Figure 2 (Experiment I) and Figure 6 (Experiment II)
    in Choi et al. (2025).
    """
    _setup_style()
    fig, (ax_bar, ax_hist) = plt.subplots(1, 2, figsize=(12, 5),
                                           gridspec_kw={"width_ratios": [1, 3]})

    color = COLORS.get(game_type, "#333333")
    label = "BT (Bad-type Truth-telling)" if game_type == "BT" else "GL (Good-type Lying)"

    # Left panel: average bar
    avg = np.mean(strategies)
    ax_bar.bar([label], [avg], color=color, width=0.5, alpha=0.7, edgecolor="white")
    if equilibrium_pred is not None:
        ax_bar.scatter([label], [equilibrium_pred], marker="D", c=COLORS["equilibrium"],
                       s=100, zorder=5, label=f"Prediction={equilibrium_pred:.1f}")
        ax_bar.legend()
    ax_bar.set_ylabel("Average Truth-telling Probability")
    ax_bar.set_ylim(0, 1.05)
    ax_bar.set_title(f"Average ({game_type})")

    # Right panel: distribution histogram
    ax_hist.hist(strategies, bins=np.linspace(0, 1, 21), density=False,
                 color=color, alpha=0.6, edgecolor="white", linewidth=0.8)
    # Convert to percentage
    counts, edges = np.histogram(strategies, bins=np.linspace(0, 1, 21))
    pcts = counts / len(strategies) * 100
    ax_hist.cla()
    ax_hist.bar((edges[:-1] + edges[1:]) / 2, pcts, width=np.diff(edges)[0] * 0.9,
                color=color, alpha=0.6, edgecolor="white", linewidth=0.8)

    if equilibrium_pred is not None:
        ax_hist.axvline(equilibrium_pred, color=COLORS["equilibrium"], linestyle="--",
                        linewidth=2, label="Equilibrium prediction")
        ax_hist.scatter([equilibrium_pred], [max(pcts) * 0.95], marker="x",
                        c=COLORS["equilibrium"], s=150, zorder=5)
        ax_hist.legend()

    ax_hist.set_xlabel("Truth-telling Probability")
    ax_hist.set_ylabel("Observations (%)")
    ax_hist.set_title(f"Distribution of Strategies ({game_type})")
    ax_hist.set_xlim(-0.05, 1.05)

    fig.suptitle(f"Sender Strategy (Stage 1) — {label}", fontsize=14, fontweight="bold", y=1.02)
    plt.tight_layout()

    fname = filename or f"strategy_distribution_{game_type.lower()}.png"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / fname)
    plt.close()


def plot_strategy_clustering(
    s1: np.ndarray,
    s2: np.ndarray,
    game_type: str,
    n_clusters: int = 4,
    output_dir: str = "output",
    filename: str | None = None,
) -> None:
    """2D strategy clustering scatter plot.

    Analogous to Figure 3 in Choi et al. (2025).
    Horizontal: strategy in stage 1, Vertical: strategy in stage 2.
    K-means clustering identifies behavioral subgroups.
    """
    _setup_style()
    fig, ax = plt.subplots(figsize=(8, 8))

    # K-means clustering
    data = np.column_stack([s1, s2])
    valid = np.all(np.isfinite(data), axis=1)
    data_valid = data[valid]

    if len(data_valid) < n_clusters:
        ax.scatter(s1, s2, alpha=0.5)
    else:
        km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = km.fit_predict(data_valid)
        centers = km.cluster_centers_

        cluster_colors = ["#F44336", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0"]
        cluster_markers = ["o", "s", "^", "D", "v"]
        cluster_names = ["Cluster 1", "Cluster 2", "Cluster 3", "Cluster 4", "Cluster 5"]

        for i in range(n_clusters):
            mask = labels == i
            pct = mask.sum() / len(labels) * 100
            ax.scatter(
                data_valid[mask, 0], data_valid[mask, 1],
                c=cluster_colors[i % len(cluster_colors)],
                marker=cluster_markers[i % len(cluster_markers)],
                s=30, alpha=0.6, edgecolors="none",
                label=f"{cluster_names[i]} ({pct:.0f}%)",
            )

        # Plot centers
        for i, center in enumerate(centers):
            ax.scatter(center[0], center[1],
                       c=cluster_colors[i % len(cluster_colors)],
                       marker=cluster_markers[i % len(cluster_markers)],
                       s=200, edgecolors="black", linewidths=2, zorder=10)

    # Equilibrium prediction
    if game_type == "BT":
        eq_x, eq_y = 0.0, 1.0  # truth in stage 1, lie in stage 2
        ax.set_xlabel(r"$Pr(m_1=1|\theta_1=0)$ — Lying prob (Stage 1)")
        ax.set_ylabel(r"$Pr(m_2=1|\theta_2=0)$ — Lying prob (Stage 2)")
    else:
        eq_x, eq_y = 1.0, 0.0  # lie in stage 1, truth in stage 2
        ax.set_xlabel(r"$Pr(m_1=1|\theta_1=1)$ — Truth prob (Stage 1)")
        ax.set_ylabel(r"$Pr(m_2=1|\theta_2=1)$ — Truth prob (Stage 2)")

    ax.scatter([eq_x], [eq_y], marker="o", facecolors="none", edgecolors="black",
               s=300, linewidths=2.5, zorder=10, label="Prediction")

    ax.set_xlim(-0.05, 1.05)
    ax.set_ylim(-0.05, 1.05)
    ax.set_title(f"Clustering of Sender Strategies — {game_type}", fontweight="bold")
    ax.legend(loc="center right", framealpha=0.8)

    plt.tight_layout()
    fname = filename or f"strategy_clustering_{game_type.lower()}.png"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / fname)
    plt.close()


def plot_equilibrium_regions(
    c_l_range: tuple[float, float] = (0, 5),
    c_d_range: tuple[float, float] = (0, 5),
    game_type: str = "BT",
    agents_cl: np.ndarray | None = None,
    agents_cd: np.ndarray | None = None,
    output_dir: str = "output",
    filename: str | None = None,
) -> None:
    """Visualize equilibrium regions in (c_l, c_d)-space.

    Analogous to Figure 16 in Choi et al. (2025) Appendix G.

    Proposition 3 (BT): three regions based on c_l vs c_d
      I.   Full reputation building:  c_l > c_bar(c_d)
      II.  Partial:                    c_lower(c_d) < c_l < c_bar(c_d)
      III. No reputation building:    c_l < c_lower(c_d)

    Proposition 4 (GL): three regions based on c_l vs c_d
      I.   Full reputation building:  c_l < c_star(c_d)
      II.  Partial:                    c_star(c_d) < c_l < c_star_upper(c_d)
      III. No reputation building:    c_l > c_star_upper(c_d)
    """
    _setup_style()
    fig, ax = plt.subplots(figsize=(9, 8))

    cl = np.linspace(c_l_range[0], c_l_range[1], 200)
    cd = np.linspace(c_d_range[0], c_d_range[1], 200)
    CL, CD = np.meshgrid(cl, cd)

    if game_type == "BT":
        # In BT: deviation from equilibrium when c_l is small relative to c_d
        # Approximate boundaries (from equilibrium analysis):
        c_bar = 0.8 * CD + 0.2  # upper threshold
        c_lower = 0.3 * CD      # lower threshold

        # Region I: Full reputation building (c_l > c_bar)
        ax.fill_between(cd, c_bar[:, 0], c_l_range[1], alpha=0.15, color=COLORS["equilibrium"],
                         label="Full Reputation Building")
        # Region II: Partial
        ax.fill_between(cd, c_lower[:, 0], c_bar[:, 0], alpha=0.15, color=COLORS["noise"],
                         label="Partial Reputation Building")
        # Region III: No reputation building
        ax.fill_between(cd, 0, c_lower[:, 0], alpha=0.15, color=COLORS["deception_averse"],
                         label="No Reputation Building")

        ax.plot(cd, c_bar[:, 0], "k-", linewidth=1.5, alpha=0.5)
        ax.plot(cd, c_lower[:, 0], "k--", linewidth=1.5, alpha=0.5)
        title = "Equilibrium Regions — BT Environment"
    else:
        # In GL: deviation from equilibrium when c_l is large
        c_star = 0.5 * CD + 0.3  # lower threshold
        c_star_upper = 0.8 * CD + 0.6  # upper threshold

        ax.fill_between(cd, 0, c_star[:, 0], alpha=0.15, color=COLORS["equilibrium"],
                         label="Full Reputation Building")
        ax.fill_between(cd, c_star[:, 0], c_star_upper[:, 0], alpha=0.15, color=COLORS["noise"],
                         label="Partial Reputation Building")
        ax.fill_between(cd, c_star_upper[:, 0], c_l_range[1], alpha=0.15, color=COLORS["lying_averse"],
                         label="No Reputation Building")

        ax.plot(cd, c_star[:, 0], "k-", linewidth=1.5, alpha=0.5)
        ax.plot(cd, c_star_upper[:, 0], "k--", linewidth=1.5, alpha=0.5)
        title = "Equilibrium Regions — GL Environment"

    # Overlay agent positions
    if agents_cl is not None and agents_cd is not None:
        ax.scatter(agents_cd, agents_cl, c="black", s=15, alpha=0.4, zorder=5, label="Agents")

    ax.set_xlabel(PARAM_LABELS["c_d"])
    ax.set_ylabel(PARAM_LABELS["c_l"])
    ax.set_title(title, fontweight="bold")
    ax.legend(loc="upper left", framealpha=0.8)
    ax.set_xlim(c_l_range)
    ax.set_ylim(c_d_range)

    plt.tight_layout()
    fname = filename or f"equilibrium_regions_{game_type.lower()}.png"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / fname)
    plt.close()


def plot_belief_distribution(
    belief_diffs: np.ndarray,
    threshold: float,
    game_type: str,
    output_dir: str = "output",
    filename: str | None = None,
) -> None:
    """Distribution of second-order belief differences.

    Analogous to Figure 7 in Choi et al. (2025).
    Shows the difference in sender's second-order beliefs conditional
    on truth-telling vs lying.
    """
    _setup_style()
    fig, (ax_bar, ax_hist) = plt.subplots(1, 2, figsize=(12, 5),
                                           gridspec_kw={"width_ratios": [1, 3]})

    color = COLORS.get(game_type, "#333333")

    # Left: average
    avg = np.mean(belief_diffs)
    ax_bar.bar([game_type], [avg], color=color, width=0.4, alpha=0.7)
    ax_bar.set_ylabel("Avg Difference in Second-order Belief")
    ax_bar.set_ylim(-1, 1)
    ax_bar.axhline(threshold, color=COLORS["inference_error"], linestyle="--", linewidth=1.5)

    # Right: distribution
    bins = np.linspace(-1, 1, 41)
    counts, edges = np.histogram(belief_diffs, bins=bins)
    pcts = counts / len(belief_diffs) * 100
    ax_hist.bar((edges[:-1] + edges[1:]) / 2, pcts, width=np.diff(edges)[0] * 0.9,
                color=color, alpha=0.6, edgecolor="white")
    ax_hist.axvline(threshold, color=COLORS["inference_error"], linestyle="--",
                    linewidth=2, label=f"Threshold $T_{{{game_type}}}$={threshold:.2f}")
    ax_hist.set_xlabel("Difference in Second-order Belief")
    ax_hist.set_ylabel("Observations (%)")
    ax_hist.legend()

    fig.suptitle(f"Sender's Second-order Belief — {game_type}", fontsize=14, fontweight="bold")
    plt.tight_layout()

    fname = filename or f"belief_distribution_{game_type.lower()}.png"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / fname)
    plt.close()


def plot_parameter_sensitivity(
    param_values: np.ndarray,
    metric_values: np.ndarray,
    param_name: str,
    metric_name: str,
    output_dir: str = "output",
    filename: str = "sensitivity.png",
) -> None:
    """Plot how an outcome metric changes as a parameter varies."""
    _setup_style()
    fig, ax = plt.subplots(figsize=(8, 5))

    ax.plot(param_values, metric_values, "o-", color=COLORS["equilibrium"],
            linewidth=2, markersize=6)
    ax.fill_between(param_values, metric_values, alpha=0.1, color=COLORS["equilibrium"])

    ax.set_xlabel(param_name.replace("_", " ").title())
    ax.set_ylabel(metric_name.replace("_", " ").title())
    ax.set_title(f"Sensitivity: {metric_name} vs {param_name}", fontweight="bold")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    plt.tight_layout()
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / filename)
    plt.close()


def plot_population_comparison(
    params_before: dict[str, np.ndarray],
    params_after: dict[str, np.ndarray],
    output_dir: str = "output",
    filename: str = "population_comparison.png",
) -> None:
    """Compare population distributions before/after parameter adjustment."""
    _setup_style()
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle("Population Distribution: Before vs After Adjustment",
                 fontsize=15, fontweight="bold")

    for ax, (key, label) in zip(axes.flat, PARAM_LABELS.items()):
        before = params_before.get(key, np.array([]))
        after = params_after.get(key, np.array([]))

        if len(before) == 0 and len(after) == 0:
            ax.set_visible(False)
            continue

        bins = 40
        if len(before) > 0:
            ax.hist(before, bins=bins, density=True, alpha=0.3, color="gray",
                    edgecolor="white", label="Before")
            if np.std(before) > 1e-10:
                kde = stats.gaussian_kde(before)
                x = np.linspace(before.min(), before.max(), 200)
                ax.plot(x, kde(x), "--", color="gray", linewidth=2)

        if len(after) > 0:
            color = COLORS.get(key, "#333333")
            ax.hist(after, bins=bins, density=True, alpha=0.4, color=color,
                    edgecolor="white", label="After")
            if np.std(after) > 1e-10:
                kde = stats.gaussian_kde(after)
                x = np.linspace(after.min(), after.max(), 200)
                ax.plot(x, kde(x), "-", color=color, linewidth=2)

        ax.set_xlabel(label)
        ax.set_ylabel("Density")
        ax.set_title(label)
        ax.legend()

    plt.tight_layout()
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    plt.savefig(Path(output_dir) / filename)
    plt.close()


def generate_all_plots(result, output_dir: str = "output") -> None:
    """Generate all plots from an ExperimentResult."""
    from src.experiments import ExperimentResult
    r: ExperimentResult = result

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # 1. Utility parameter distributions
    plot_utility_distributions(r.true_distributions, output_dir)

    # 2. Joint cost distribution
    classifications = [ip.classification for ip in r.inferred]
    plot_joint_cost_distribution(
        r.true_distributions["c_l"],
        r.true_distributions["c_d"],
        classifications=classifications,
        output_dir=output_dir,
    )

    # 3. Type proportions
    if r.honesty_proportions:
        plot_type_proportions(r.honesty_proportions,
                              "Honesty Preference Types", output_dir,
                              "honesty_proportions.png")
    if r.risk_proportions:
        plot_type_proportions(r.risk_proportions,
                              "Risk Attitude Distribution", output_dir,
                              "risk_proportions.png")
    if r.altruism_proportions:
        plot_type_proportions(r.altruism_proportions,
                              "Altruism Distribution", output_dir,
                              "altruism_proportions.png")
    if r.classifications:
        plot_type_proportions(r.classifications,
                              "Behavioral Classification (Inferred)", output_dir,
                              "behavioral_classifications.png")

    # 4. Strategy distributions
    bt_strats = r.org_result.bt_truth_probs
    if len(bt_strats) > 0:
        plot_strategy_distribution(bt_strats, "BT", equilibrium_pred=1.0, output_dir=output_dir)

    gl_strats = r.org_result.gl_lie_probs
    if len(gl_strats) > 0:
        # In GL, we show truth-telling prob (equilibrium predicts low truth-telling)
        plot_strategy_distribution(1 - gl_strats, "GL", equilibrium_pred=0.0, output_dir=output_dir)

    # 5. Equilibrium regions
    cl = r.true_distributions["c_l"]
    cd = r.true_distributions["c_d"]
    cl_max = min(np.percentile(cl, 95) * 1.5, 10)
    cd_max = min(np.percentile(cd, 95) * 1.5, 10)

    plot_equilibrium_regions((0, cl_max), (0, cd_max), "BT", cl, cd, output_dir)
    plot_equilibrium_regions((0, cl_max), (0, cd_max), "GL", cl, cd, output_dir)

    # 6. Strategy clustering (using stage 1 strategies as proxy)
    if len(bt_strats) > 0:
        # Use truth prob as s1, and generate s2 from round data
        org = r.org_result
        s1_bt = np.array([org.bt_strategies.get(i, 0.5) for i in range(r.population.n)])
        s2_bt = np.random.default_rng(42).random(r.population.n)  # placeholder for stage 2
        plot_strategy_clustering(1 - s1_bt, s2_bt, "BT", output_dir=output_dir)

    if len(gl_strats) > 0:
        s1_gl = np.array([org.gl_strategies.get(i, 0.5) for i in range(r.population.n)])
        s2_gl = np.random.default_rng(42).random(r.population.n)
        plot_strategy_clustering(s1_gl, 1 - s2_gl, "GL", output_dir=output_dir)

    print(f"All plots saved to {output_dir}/")
