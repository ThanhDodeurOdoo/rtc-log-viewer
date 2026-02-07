const { Component, computed, props } = owl;
import helpers from "../../utils/helpers.js";

function formatNumeric(value) {
    if (!Number.isFinite(value)) {
        return "n/a";
    }
    return `${Math.round(value)}`;
}

function buildSparklinePath(values) {
    const points = values
        .map((value, index) => ({ value, index }))
        .filter((point) => Number.isFinite(point.value));
    if (!points.length) {
        return "";
    }
    const width = 100;
    const height = 28;
    const padding = 2;
    const min = Math.min(...points.map((point) => point.value));
    const max = Math.max(...points.map((point) => point.value));
    const range = max - min || 1;
    const length = points.length - 1 || 1;
    return points
        .map((point, index) => {
            const x = padding + (index / length) * (width - padding * 2);
            const normalized = (point.value - min) / range;
            const y = height - padding - normalized * (height - padding * 2);
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
}

export class TrendCard extends Component {
    static template = "TrendCard";

    props = props();

    setup() {
        this.sparklinePath = computed(() =>
            buildSparklinePath(this.props.trend.values || [])
        );
    }

    formatValue(value, kind) {
        if (!Number.isFinite(value)) {
            return "n/a";
        }
        if (kind === "duration") {
            return helpers.formatDuration(value);
        }
        return formatNumeric(value);
    }
}
