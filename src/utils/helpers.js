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

export default {
    formatEventTime,
    formatEventText,
    formatTime,
    getSessionStateClass,
    getConnectionStateClass,
    getAudioState,
    getNetworkState
};
