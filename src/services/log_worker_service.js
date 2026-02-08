import { buildFilteredLogs } from "../analysis/log_filter.js";
import { runRuleEngine } from "../analysis/rule_engine.js";

class LogWorkerService {
    constructor() {
        this.worker = this._createWorker();
        this.requests = new Map();
        this.nextRequestId = 1;
        this.localData = null;
        this.lastLoadedRef = null;

        if (this.worker) {
            this.worker.onmessage = (event) => this._handleMessage(event.data);
            this.worker.onerror = (error) => {
                console.error("Analysis worker error, falling back to main thread:", error);
                this._rejectAllPending("Worker crashed");
                this.worker = null;
            };
        }
    }

    _createWorker() {
        if (typeof Worker === "undefined") {
            return null;
        }
        try {
            return new Worker(
                new URL("../workers/log_worker.js", import.meta.url),
                { type: "module" }
            );
        } catch (error) {
            console.warn("Could not start analysis worker:", error);
            return null;
        }
    }

    _handleMessage(message) {
        const pending = this.requests.get(message?.id);
        if (!pending) {
            return;
        }
        this.requests.delete(message.id);
        if (message.ok) {
            pending.resolve(message.result);
        } else {
            pending.reject(new Error(message.error || "Unknown worker error"));
        }
    }

    _rejectAllPending(reason) {
        for (const pending of this.requests.values()) {
            pending.reject(new Error(reason));
        }
        this.requests.clear();
    }

    _request(type, payload) {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error("Worker unavailable"));
                return;
            }
            const id = this.nextRequestId++;
            this.requests.set(id, { resolve, reject });
            this.worker.postMessage({
                id,
                type,
                ...payload,
            });
        });
    }

    async parseJsonText(text) {
        if (!this.worker) {
            const logs = JSON.parse(text);
            this.localData = logs;
            this.lastLoadedRef = logs;
            return logs;
        }
        const logs = await this._request("parse_json", { text });
        this.localData = logs;
        this.lastLoadedRef = logs;
        return logs;
    }

    async setLogData(logs) {
        this.localData = logs;
        if (logs && this.lastLoadedRef === logs) {
            return;
        }
        this.lastLoadedRef = logs;
        if (!this.worker) {
            return;
        }
        try {
            await this._request("set_log_data", { logs });
        } catch (error) {
            console.warn("Failed to sync data to worker, using main thread:", error);
            this.worker = null;
        }
    }

    async analyzeSelection({
        selectedTimelines = [],
        selectedSnapshots = [],
        fallbackLogs = null,
    }) {
        if (this.worker && this.localData) {
            try {
                return await this._request("analyze_selection", {
                    selectedTimelines,
                    selectedSnapshots,
                });
            } catch (error) {
                console.warn("Worker analysis failed, using main thread:", error);
                this.worker = null;
            }
        }

        const sourceLogs =
            fallbackLogs ||
            buildFilteredLogs(this.localData, {
                selectedTimelines,
                selectedSnapshots,
            });
        return runRuleEngine(sourceLogs);
    }
}

export const logWorkerService = new LogWorkerService();
