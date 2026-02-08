import { ISSUE_TYPES } from "../analysis/constants.js";

function summarizeBySeverity(issues) {
    const summary = {
        [ISSUE_TYPES.ERROR]: 0,
        [ISSUE_TYPES.WARNING]: 0,
        [ISSUE_TYPES.INFO]: 0,
    };
    for (const issue of issues) {
        if (summary[issue.type] !== undefined) {
            summary[issue.type] += 1;
        }
    }
    return summary;
}

function summarizeByRule(issues) {
    const counts = new Map();
    for (const issue of issues) {
        const key = issue.ruleId || "unknown";
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([ruleId, count]) => ({ ruleId, count }))
        .sort((a, b) => b.count - a.count);
}

function getDatasetSummary(logs) {
    const timelines = logs?.timelines || {};
    const snapshots = logs?.snapshots || {};
    let sessionEntries = 0;
    for (const timeline of Object.values(timelines)) {
        sessionEntries += Object.keys(timeline?.entriesBySessionId || {}).length;
    }
    return {
        timelineCount: Object.keys(timelines).length,
        snapshotCount: Object.keys(snapshots).length,
        sessionEntries,
    };
}

function selectTopFindings(groupedIssues, limit = 15) {
    return groupedIssues.slice(0, limit).map((group) => ({
        title: group.title,
        type: group.type,
        errorCode: group.errorCode,
        count: group.count,
        recommendation: group.recommendation || null,
        description: group.description,
    }));
}

export function buildDiagnosticReport({
    logs,
    issues,
    groupedIssues,
    selectedTimelines,
    selectedSnapshots,
    generatedAt = new Date(),
}) {
    return {
        meta: {
            generatedAt: generatedAt.toISOString(),
            version: "1.0",
        },
        filters: {
            selectedTimelineCount: selectedTimelines.length,
            selectedSnapshotCount: selectedSnapshots.length,
            selectedTimelines,
            selectedSnapshots,
        },
        dataset: getDatasetSummary(logs),
        summary: {
            totalIssues: issues.length,
            bySeverity: summarizeBySeverity(issues),
            byRule: summarizeByRule(issues),
            topFindings: selectTopFindings(groupedIssues),
        },
        findings: issues.map((issue) => ({
            ruleId: issue.ruleId,
            errorCode: issue.errorCode,
            type: issue.type,
            title: issue.title,
            description: issue.description,
            recommendation: issue.recommendation || null,
            timelineKey: issue.timelineKey || null,
            snapshotKey: issue.timestamp || null,
            sessionId: issue.sessionId ?? null,
            evidence: issue.evidence || null,
            details: issue.details || null,
        })),
    };
}

export function formatDiagnosticReportMarkdown(report) {
    const lines = [];
    lines.push("# RTC Diagnostic Report");
    lines.push("");
    lines.push(`Generated at: ${report.meta.generatedAt}`);
    lines.push("");
    lines.push("## Dataset");
    lines.push(`- Timelines: ${report.dataset.timelineCount}`);
    lines.push(`- Snapshots: ${report.dataset.snapshotCount}`);
    lines.push(`- Session Entries: ${report.dataset.sessionEntries}`);
    lines.push("");
    lines.push("## Filters");
    lines.push(
        `- Selected Timelines: ${report.filters.selectedTimelineCount}`
    );
    lines.push(
        `- Selected Snapshots: ${report.filters.selectedSnapshotCount}`
    );
    lines.push("");
    lines.push("## Summary");
    lines.push(`- Total Issues: ${report.summary.totalIssues}`);
    lines.push(`- Errors: ${report.summary.bySeverity.error}`);
    lines.push(`- Warnings: ${report.summary.bySeverity.warning}`);
    lines.push(`- Info: ${report.summary.bySeverity.info}`);
    lines.push("");
    lines.push("## Top Findings");
    if (!report.summary.topFindings.length) {
        lines.push("- No issues detected.");
    } else {
        for (const finding of report.summary.topFindings) {
            lines.push(
                `- [${finding.type}] ${finding.title} (${finding.count} occurrences)`
            );
        }
    }
    lines.push("");
    lines.push("## Rule Distribution");
    if (!report.summary.byRule.length) {
        lines.push("- No rules triggered.");
    } else {
        for (const item of report.summary.byRule) {
            lines.push(`- ${item.ruleId}: ${item.count}`);
        }
    }
    lines.push("");
    return lines.join("\n");
}

function downloadFile(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function exportDiagnosticReport(report, format = "json") {
    const timestamp = report.meta.generatedAt.replace(/[:.]/g, "-");
    if (format === "markdown") {
        const markdown = formatDiagnosticReportMarkdown(report);
        downloadFile(
            markdown,
            "text/markdown;charset=utf-8",
            `rtc-diagnostic-report-${timestamp}.md`
        );
        return;
    }
    const json = JSON.stringify(report, null, 2);
    downloadFile(
        json,
        "application/json;charset=utf-8",
        `rtc-diagnostic-report-${timestamp}.json`
    );
}
