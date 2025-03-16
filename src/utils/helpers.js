export function formatEventTime(event) {
    if (!event || !event.event) return '';

    const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
    if (timeMatch && timeMatch[1]) {
        // Check if ISO format
        if (timeMatch[1].includes('T')) {
            const date = new Date(timeMatch[1]);
            return date.toLocaleTimeString();
        }
        return timeMatch[1];
    }
    return '';
}

export function formatEventText(event) {
    if (!event || !event.event) return '';

    const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
    if (timeMatch) {
        return event.event.substring(timeMatch[0].length).trim();
    }
    return event.event;
}

export function formatTime(timelineKey) {
    if (!timelineKey) return '';

    try {
        const date = new Date(timelineKey);
        return date.toLocaleString();
    } catch (e) {
        return timelineKey;
    }
}

export function getSessionStateClass(session) {
    if (!session) return '';

    if (session.state === 'connected' || session.peer?.state === 'connected') {
        return 'connected';
    }

    if (session.state === 'connecting' || session.peer?.state === 'connecting') {
        return 'connecting';
    }

    return 'disconnected';
}

export function getConnectionStateClass(state) {
    if (!state) return '';

    if (state.includes('connected')) return 'connected';
    if (state.includes('connecting')) return 'connecting';
    return 'disconnected';
}

export function getAudioState(state) {
    const states = [
        'HAVE_NOTHING',
        'HAVE_METADATA',
        'HAVE_CURRENT_DATA',
        'HAVE_FUTURE_DATA',
        'HAVE_ENOUGH_DATA'
    ];

    return states[state] || state;
}

export function getNetworkState(state) {
    const states = [
        'NETWORK_EMPTY',
        'NETWORK_IDLE',
        'downloading', // NETWORK_LOADING
        'NETWORK_NO_SOURCE'
    ];

    return states[state] || state;
}

/**
 * Format a duration in milliseconds to a human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(ms) {
    if (!ms || ms < 0) return '0s';

    const seconds = Math.floor(ms / 1000);
    const milliseconds = (ms % 1000) / 10;
    if (seconds < 1) return `${(ms / 1000).toFixed(2)}s`;
    if (seconds < 60) return `${seconds}.${milliseconds.toFixed(0)}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}.${milliseconds.toFixed(0)}s`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}.${milliseconds.toFixed(0)}s`;
}

/**
 * Calculate a visible time range based on zoom level and pan position
 * @param {string} startTime - ISO string of timeline start time
 * @param {string} endTime - ISO string of timeline end time
 * @param {number} zoomLevel - Value from 1-10 where 1 is full range
 * @param {number} panPosition - Value from 0-1 representing position in zoomed timeline
 * @returns {Object} Object with visible start and end times
 */
export function calculateVisibleTimeRange(startTime, endTime, zoomLevel, panPosition) {
    if (!startTime || !endTime) {
        return {
            visibleStartTime: new Date(),
            visibleEndTime: new Date(),
            fullStartTime: new Date(),
            fullEndTime: new Date()
        };
    }

    const fullStartTime = new Date(startTime);
    const fullEndTime = new Date(endTime);
    const fullRange = fullEndTime.getTime() - fullStartTime.getTime();

    // If no zoom, show full range
    if (zoomLevel <= 1) {
        return {
            visibleStartTime: fullStartTime,
            visibleEndTime: fullEndTime,
            fullStartTime,
            fullEndTime
        };
    }

    // Calculate visible range based on zoom
    const visibleRangeDuration = fullRange / zoomLevel;

    // Calculate the maximum possible pan offset
    const maxPanOffset = fullRange - visibleRangeDuration;

    // Apply pan position (0 = start, 1 = end)
    const panOffset = Math.min(maxPanOffset, maxPanOffset * panPosition);

    // Calculate visible start and end times
    const visibleStartTime = new Date(fullStartTime.getTime() + panOffset);
    const visibleEndTime = new Date(visibleStartTime.getTime() + visibleRangeDuration);

    return {
        visibleStartTime,
        visibleEndTime,
        fullStartTime,
        fullEndTime
    };
}

/**
 * Group events that are positioned close to each other on the timeline
 * @param {Array} events - Array of event objects with position property
 * @param {number} threshold - Threshold percentage for considering events as clustered
 * @returns {Array} Array of event groups (each group is an array of events)
 */
export function groupCloseEvents(events, threshold = 5) {
    if (!events || !events.length) return [];

    // Sort events by position
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
    groupCloseEvents
};
