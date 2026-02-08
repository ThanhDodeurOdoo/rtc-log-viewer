import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ISSUE_CODES, ISSUE_TYPES } from "../src/analysis/constants.js";
import { runRuleEngine } from "../src/analysis/rule_engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataPath = join(__dirname, "data", "RtcLogs_2026-01-12_05-39.json");
const testData = JSON.parse(readFileSync(testDataPath, "utf-8"));

describe("Rule engine", () => {
    test("returns normalized issues with evidence metadata", () => {
        const issues = runRuleEngine(testData);
        expect(Array.isArray(issues)).toBe(true);
        if (issues.length > 0) {
            expect(issues[0]).toHaveProperty("ruleId");
            expect(issues[0]).toHaveProperty("errorCode");
            expect(issues[0]).toHaveProperty("type");
            expect(issues[0]).toHaveProperty("evidence");
            expect(issues[0].evidence).toHaveProperty("eventPattern");
        }
    });

    test("allows pluggable rule injection", () => {
        const customRule = {
            id: "custom_rule",
            errorCode: 9999,
            severity: ISSUE_TYPES.ERROR,
            title: "Custom Rule Triggered",
            recommendation: "Custom recommendation",
            evidencePattern: "custom pattern",
            detect() {
                return [
                    {
                        description: "custom",
                        timelineKey: "2026-01-01T00:00:00.000Z",
                    },
                ];
            },
        };
        const issues = runRuleEngine(testData, { rules: [customRule] });
        expect(issues).toHaveLength(1);
        expect(issues[0].title).toBe("Custom Rule Triggered");
        expect(issues[0].errorCode).toBe(9999);
        expect(issues[0].evidence.eventPattern).toBe("custom pattern");
    });

    test("includes known default rules", () => {
        const issues = runRuleEngine(testData);
        const hasKnownCode = issues.some(
            (issue) => issue.errorCode === ISSUE_CODES.NO_TURN_SERVER
        );
        expect(hasKnownCode).toBe(true);
    });
});
