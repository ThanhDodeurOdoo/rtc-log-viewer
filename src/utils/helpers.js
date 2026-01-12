export function formatEventTime(event) {
    if (!event || !event.event) {
        return "";
    }

    const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
    if (timeMatch && timeMatch[1]) {
        const date = new Date(timeMatch[1]);
        return date.toISOString().split("T")[1].replace("Z", "");
    }
    return "";
}

export function formatEventText(event) {
    if (!event || !event.event) {
        return "";
    }

    const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
    if (timeMatch) {
        return event.event.substring(timeMatch[0].length).trim();
    }
    return event.event;
}

export function formatTime(timelineKey) {
    if (!timelineKey) {
        return "";
    }

    try {
        const date = new Date(timelineKey);
        return date.toISOString();
    } catch {
        return timelineKey;
    }
}

export function getSessionStateClass(session) {
    if (!session) {
        return "";
    }

    if (session.state === "connected" || session.peer?.state === "connected") {
        return "connected";
    }

    if (session.state === "connecting" || session.peer?.state === "connecting") {
        return "connecting";
    }

    return "disconnected";
}

export function getConnectionStateClass(state) {
    switch (state) {
        case "connected":
            return "connected";
        case "connecting":
        case "authenticated":
        case "recovering":
            return "connecting";
        default:
            return "disconnected";
    }
}

export function getAudioState(state) {
    const states = [
        "HAVE_NOTHING",
        "HAVE_METADATA",
        "HAVE_CURRENT_DATA",
        "HAVE_FUTURE_DATA",
        "HAVE_ENOUGH_DATA",
    ];

    return states[state] || state;
}

export function getNetworkState(state) {
    const states = [
        "NETWORK_EMPTY",
        "NETWORK_IDLE",
        "downloading", // NETWORK_LOADING
        "NETWORK_NO_SOURCE",
    ];

    return states[state] || state;
}

export function formatDuration(ms) {
    if (!ms || ms < 0) {
        return "0s";
    }

    const seconds = Math.floor(ms / 1000);
    const milliseconds = (ms % 1000) / 10;
    if (seconds < 1) {
        return `${(ms / 1000).toFixed(2)}s`;
    }
    if (seconds < 60) {
        return `${seconds}.${milliseconds.toFixed(0)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
        return `${minutes}m ${remainingSeconds}.${milliseconds.toFixed(0)}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}.${milliseconds.toFixed(0)}s`;
}

export function calculateVisibleTimeRange(startTime, endTime, zoomLevel, panPosition) {
    if (!startTime || !endTime) {
        return {
            visibleStartTime: new Date(),
            visibleEndTime: new Date(),
            fullStartTime: new Date(),
            fullEndTime: new Date(),
        };
    }

    const fullStartTime = new Date(startTime);
    const fullEndTime = new Date(endTime);
    const fullRange = fullEndTime.getTime() - fullStartTime.getTime();

    if (zoomLevel <= 1) {
        return {
            visibleStartTime: fullStartTime,
            visibleEndTime: fullEndTime,
            fullStartTime,
            fullEndTime,
        };
    }

    const visibleRangeDuration = fullRange / zoomLevel;
    const maxPanOffset = fullRange - visibleRangeDuration;
    const panOffset = Math.min(maxPanOffset, maxPanOffset * panPosition);

    const visibleStartTime = new Date(fullStartTime.getTime() + panOffset);
    const visibleEndTime = new Date(visibleStartTime.getTime() + visibleRangeDuration);

    return {
        visibleStartTime,
        visibleEndTime,
        fullStartTime,
        fullEndTime,
    };
}

export function groupCloseEvents(events, threshold = 5) {
    if (!events || !events.length) {
        return [];
    }

    const sortedEvents = [...events].sort((a, b) => a.position - b.position);

    const groups = [];
    let currentGroup = [];

    for (const event of sortedEvents) {
        if (currentGroup.length === 0) {
            currentGroup.push(event);
        } else {
            const lastEvent = currentGroup[currentGroup.length - 1];

            if (Math.abs(lastEvent.position - event.position) < threshold) {
                currentGroup.push(event);
            } else {
                groups.push([...currentGroup]);
                currentGroup = [event];
            }
        }
    }

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
}

export function eventContains(log, pattern) {
    if (!log || !log.event) {
        return false;
    }

    const text = formatEventText(log);
    return text.includes(pattern);
}

/** Returns 'info', 'warning', or 'error' based on log level and content keywords */
export function getEventSeverity(log) {
    if (!log) {
        return "info";
    }

    if (log.level === "error" || log.level === "ERROR") {
        return "error";
    }

    if (
        log.level === "warn" ||
        log.level === "warning" ||
        log.level === "WARN" ||
        log.level === "WARNING"
    ) {
        return "warning";
    }

    const text = formatEventText(log);
    const errorKeywords = ["error", "failed", "failure", "exception", "crash"];
    const warningKeywords = ["warning", "attempting to recover", "disconnect"];

    if (errorKeywords.some((keyword) => text.toLowerCase().includes(keyword))) {
        return "error";
    }

    if (warningKeywords.some((keyword) => text.toLowerCase().includes(keyword))) {
        return "warning";
    }

    return "info";
}

export function extractConnectionState(log) {
    if (!log || !log.event) {
        return null;
    }

    const text = formatEventText(log);

    if (text.includes("connection state change:")) {
        const statePart = text.split("connection state change:")[1].trim();
        return statePart;
    }

    if (
        text.includes("peer removed") ||
        text.includes("session deleted") ||
        text.includes("ending call")
    ) {
        return "closed";
    }

    return null;
}

export default {
    formatEventTime,
    formatEventText,
    formatTime,
    getSessionStateClass,
    getConnectionStateClass,
    getAudioState,
    getNetworkState,
    formatDuration,
    calculateVisibleTimeRange,
    groupCloseEvents,
    eventContains,
    getEventSeverity,
    extractConnectionState,
};
