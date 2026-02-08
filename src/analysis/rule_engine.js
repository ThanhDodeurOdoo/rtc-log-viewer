import { ISSUE_TYPES } from "./constants.js";
import { analysisRules } from "./rules.js";

function sortBySeverity(issues) {
    const severityOrder = {
        [ISSUE_TYPES.ERROR]: 0,
        [ISSUE_TYPES.WARNING]: 1,
        [ISSUE_TYPES.INFO]: 2,
    };
    issues.sort(
        (a, b) =>
            (severityOrder[a.type] ?? 3) - (severityOrder[b.type] ?? 3)
    );
}

function defaultEvidence(rule, issue) {
    return {
        timelineKey: issue.timelineKey || null,
        snapshotKey: issue.timestamp || null,
        sessionId:
            issue.sessionId !== undefined && issue.sessionId !== null
                ? String(issue.sessionId)
                : null,
        eventPattern: issue.details?.eventPattern || rule.evidencePattern || "",
        eventTime:
            issue.details?.eventTime ||
            issue.details?.lastEventTime ||
            issue.details?.lastRecoveryTime ||
            null,
    };
}

function normalizeIssue(rule, issue) {
    const normalized = {
        ...issue,
        id: issue.id || `${rule.id}:${Math.random().toString(36).slice(2, 8)}`,
        ruleId: rule.id,
        errorCode: issue.errorCode ?? rule.errorCode,
        type: issue.type || rule.severity,
        title: issue.title || rule.title,
        recommendation:
            issue.recommendation ||
            (typeof rule.recommendation === "function"
                ? rule.recommendation(issue)
                : rule.recommendation),
    };
    normalized.evidence = issue.evidence || defaultEvidence(rule, normalized);
    return normalized;
}

function runRule(rule, logs) {
    try {
        const detected = rule.detect(logs);
        if (!Array.isArray(detected)) {
            return [];
        }
        return detected.map((issue) => normalizeIssue(rule, issue));
    } catch (error) {
        console.error(`Analysis rule '${rule.id}' failed:`, error);
        return [];
    }
}

export function runRuleEngine(logs, { rules = analysisRules } = {}) {
    if (!logs) {
        return [];
    }
    const allIssues = [];
    for (const rule of rules) {
        allIssues.push(...runRule(rule, logs));
    }
    sortBySeverity(allIssues);
    return allIssues;
}
