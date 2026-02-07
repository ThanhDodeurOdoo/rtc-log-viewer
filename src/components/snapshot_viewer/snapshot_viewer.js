const { Component, signal, computed, plugin, props, types, useEffect } = owl;
import helpers from "../../utils/helpers.js";
import { ConnectionState } from "../connection_state/connection_state.js";
import { SessionProperties } from "../session_properties/session_properties.js";
import { LogPlugin } from "../../plugins/log_plugin.js";

export class SnapshotViewer extends Component {
    static template = "SnapshotViewer";

    static components = {
        ConnectionState,
        SessionProperties,
    };

    props = props({ snapshotKey: types.string });

    setup() {
        this.expanded = signal(false);
        this.expandedSessions = signal.Object({});
        this.rootRef = signal(null);
        this.helpers = helpers;
        this.log = plugin(LogPlugin);
        this.snapshotData = computed(() => {
            const snapshots = this.log.filteredSnapshots();
            return snapshots[this.props.snapshotKey] || {};
        });
        this.sessions = computed(() => {
            const snapshotData = this.snapshotData();
            if (!snapshotData.sessions || !Array.isArray(snapshotData.sessions)) {
                return [];
            }
            return snapshotData.sessions;
        });
        this.hasSessions = computed(() => this.sessions().length > 0);
        this.hasServerInfo = computed(() => {
            const server = this.snapshotData().server;
            return !!server && Object.keys(server).length > 0;
        });
        this.hasServerErrors = computed(() => {
            const server = this.snapshotData().server;
            return !!(
                server &&
                server.errors &&
                Array.isArray(server.errors) &&
                server.errors.length > 0
            );
        });
        this.snapshotTitle = computed(() => {
            try {
                const date = new Date(this.props.snapshotKey);
                return `Snapshot: ${date.toISOString()}`;
            } catch {
                return this.props.snapshotKey;
            }
        });

        useEffect(() => {
            const focus = this.log.snapshotFocus();
            if (!focus || focus.snapshotKey !== this.props.snapshotKey) {
                return;
            }
            this.expanded.set(true);
            this.rootRef()?.scrollIntoView({ behavior: "smooth", block: "start" });
            if (focus.sessionId) {
                const targetSessionId = this.findSnapshotSessionId(focus.sessionId);
                if (targetSessionId !== null) {
                    const expanded = this.expandedSessions();
                    expanded[targetSessionId] = true;
                }
            }
            this.log.clearSnapshotFocus();
        });
    }

    toggleSession(sessionId) {
        const expanded = this.expandedSessions();
        expanded[sessionId] = !expanded[sessionId];
    }

    findSnapshotSessionId(sessionId) {
        const normalized = String(sessionId);
        const session = this.sessions().find(
            (item) => item.id !== undefined && String(item.id) === normalized
        );
        return session ? session.id : null;
    }
}
