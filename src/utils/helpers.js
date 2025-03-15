

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

export default {
    formatEventTime,
    formatEventText,
    formatTime,
};
