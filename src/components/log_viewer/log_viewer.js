const { Component, signal, computed, useEffect, props } = owl;
import helpers from "../../utils/helpers.js";
import { NoData } from "../no_data/no_data.js";
import { EventList } from "../event_list/event_list.js";
import { ConnectionState } from "../connection_state/connection_state.js";
import { SessionProperties } from "../session_properties/session_properties.js";

export class LogViewer extends Component {
    static components = {
        NoData,
        EventList,
        ConnectionState,
        SessionProperties,
    };

    static template = "LogViewer";

    props = props();

    setup() {
        this.activeView = signal("timeline");
        this.selectedTimeline = signal("");
        this.selectedSession = signal("");
        this.selectedSnapshot = signal("");
        this.expandedSessions = signal.Object({});

        this.viewOptions = [
            { id: "timeline", label: "Timeline" },
            { id: "session", label: "Session Details" },
            { id: "raw", label: "Raw Data" },
        ];

        this.helpers = helpers;
        this.logs = computed(() => {
            if (typeof this.props.logs === "function") {
                return this.props.logs();
            }
            return this.props.logs || null;
        });
        this.timelineKeys = computed(() => {
            const logs = this.logs();
            if (!logs || !logs.timelines) {
                return [];
            }
            return Object.keys(logs.timelines).sort();
        });
        this.snapshotKeys = computed(() => {
            const logs = this.logs();
            if (!logs || !logs.snapshots) {
                return [];
            }
            return Object.keys(logs.snapshots).sort();
        });
        this.availableSessions = computed(() => {
            const logs = this.logs();
            const selectedTimeline = this.selectedTimeline();
            if (!selectedTimeline || !logs || !logs.timelines) {
                return [];
            }

            const timeline = logs.timelines[selectedTimeline];
            if (!timeline || !timeline.entriesBySessionId) {
                return [];
            }

            return Object.keys(timeline.entriesBySessionId).filter((id) => {
                return !isNaN(parseInt(id));
            });
        });
        this.sessionEvents = computed(() => {
            const logs = this.logs();
            const selectedTimeline = this.selectedTimeline();
            const selectedSession = this.selectedSession();
            if (!selectedTimeline || !selectedSession || !logs || !logs.timelines) {
                return [];
            }

            const timeline = logs.timelines[selectedTimeline];
            if (!timeline || !timeline.entriesBySessionId) {
                return [];
            }

            const sessionData = timeline.entriesBySessionId[selectedSession];
            if (!sessionData || !sessionData.logs || !Array.isArray(sessionData.logs)) {
                return [];
            }

            return sessionData.logs;
        });
        this.snapshotSessions = computed(() => {
            const logs = this.logs();
            const selectedSnapshot = this.selectedSnapshot();
            if (!selectedSnapshot || !logs || !logs.snapshots) {
                return [];
            }

            const snapshot = logs.snapshots[selectedSnapshot];
            if (!snapshot || !snapshot.sessions || !Array.isArray(snapshot.sessions)) {
                return [];
            }

            return snapshot.sessions;
        });
        useEffect(() => {
            this.selectedTimeline();
            this.selectedSession.set("");
        });
        useEffect(() => {
            this.selectedSnapshot();
            this.expandedSessions.set({});
        });
    }

    isSessionSelf(sessionId) {
        const logs = this.logs();
        const selectedTimeline = this.selectedTimeline();
        if (!selectedTimeline || !logs || !logs.timelines) {
            return false;
        }

        const timeline = logs.timelines[selectedTimeline];
        if (!timeline) {
            return false;
        }

        return sessionId === timeline.selfSessionId?.toString();
    }

    setActiveView(viewId) {
        this.activeView.set(viewId);
    }

    selectSession(sessionId) {
        this.selectedSession.set(sessionId);
    }

    toggleSession(sessionId) {
        const expanded = this.expandedSessions();
        expanded[sessionId] = !expanded[sessionId];
    }
}
