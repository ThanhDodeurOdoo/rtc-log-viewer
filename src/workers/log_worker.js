import { buildFilteredLogs } from "../analysis/log_filter.js";
import { runRuleEngine } from "../analysis/rule_engine.js";

let currentLogData = null;

function respond(id, ok, payload) {
    if (ok) {
        self.postMessage({ id, ok: true, result: payload });
        return;
    }
    self.postMessage({ id, ok: false, error: payload });
}

function parseJsonText(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Parsed log must be a JSON object.");
    }
    return parsed;
}

self.onmessage = (event) => {
    const message = event.data || {};
    const { id, type } = message;
    try {
        switch (type) {
            case "parse_json": {
                const logs = parseJsonText(message.text || "");
                currentLogData = logs;
                respond(id, true, logs);
                return;
            }
            case "set_log_data": {
                currentLogData = message.logs || null;
                respond(id, true, { ok: true });
                return;
            }
            case "analyze_selection": {
                if (!currentLogData) {
                    throw new Error("No log data loaded in worker.");
                }
                const filteredLogs = buildFilteredLogs(currentLogData, {
                    selectedTimelines: message.selectedTimelines || [],
                    selectedSnapshots: message.selectedSnapshots || [],
                });
                const issues = runRuleEngine(filteredLogs);
                respond(id, true, issues);
                return;
            }
            default:
                throw new Error(`Unknown worker message type: ${type}`);
        }
    } catch (error) {
        respond(id, false, error instanceof Error ? error.message : String(error));
    }
};
