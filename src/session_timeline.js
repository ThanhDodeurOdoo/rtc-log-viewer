const { Component, xml } = owl;

export class SessionTimeline extends Component {
    static template = xml`
        <div class="session-timeline">
            <h3>Call Timeline - Session <t t-esc="props.session"/></h3>
            
            <div t-if="!sessionEvents.length" class="no-data">
                No timeline data available for this session
            </div>
            
            <div t-else="" class="timeline-container">
                <div class="timeline">
                    <div class="timeline-line"></div>
                    
                    <!-- Render timeline events -->
                    <div 
                        t-foreach="sessionEvents" 
                        t-as="event" 
                        t-key="event.id"
                        class="timeline-event"
                        t-att-class="getEventClass(event)"
                        t-att-style="getEventStyle(event)"
                    >
                        <div class="event-tooltip" t-esc="event.tooltip"></div>
                    </div>
                    
                    <!-- Render snapshot markers -->
                    <div 
                        t-foreach="relevantSnapshots" 
                        t-as="snapshot" 
                        t-key="snapshot.id"
                        class="snapshot-marker"
                        t-att-class="{ selected: snapshot.id === props.selectedSnapshot }"
                        t-att-style="getSnapshotStyle(snapshot)"
                        t-on-click="() => this.selectSnapshot(snapshot.id)"
                    >
                        <div class="marker-label" t-esc="getSnapshotTime(snapshot.id)"></div>
                    </div>
                    
                    <div class="timeline-times">
                        <div t-esc="timeStart"></div>
                        <div t-esc="timeEnd"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.timeStart = '';
        this.timeEnd = '';
    }

    get sessionEvents() {
        if (!this.props.sessionData) return [];

        const events = [];
        let eventId = 0;

        // Process timeline data to extract events
        const timelines = this.props.sessionData.timelines || {};

        Object.entries(timelines).forEach(([timelineKey, timelineData]) => {
            // Get the session ID we're interested in
            const selectedSessionId = this.props.session;

            // For each session in this timeline
            Object.entries(timelineData).forEach(([sessionId, sessionInfo]) => {
                // Skip if this isn't the session we're looking for and isn't a relevant property
                if (sessionId !== selectedSessionId && sessionId !== 'hasTurn') {
                    return;
                }

                // Skip non-log data like "hasTurn"
                if (sessionId === 'hasTurn') return;

                // Process logs for this session
                if (sessionInfo.logs && Array.isArray(sessionInfo.logs)) {
                    sessionInfo.logs.forEach(log => {
                        // Extract timestamp from event string
                        const timeMatch = log.event.match(/(\d{2}:\d{2}:\d{2}):/);
                        if (timeMatch && timeMatch[1]) {
                            const time = timeMatch[1];
                            const eventText = log.event.substring(timeMatch[0].length).trim();
                            const level = log.level || 'info';

                            events.push({
                                id: `event_${eventId++}`,
                                time: time,
                                text: eventText,
                                level: level,
                                tooltip: `${time}: ${eventText}`,
                                sessionId: sessionId,
                                timelineKey: timelineKey
                            });
                        }
                    });
                }

                // Add step information if available
                if (sessionInfo.step) {
                    events.push({
                        id: `step_${eventId++}`,
                        time: this.extractTimeFromTimelineKey(timelineKey),
                        text: `Step: ${sessionInfo.step}`,
                        level: 'info',
                        tooltip: `Step: ${sessionInfo.step}`,
                        sessionId: sessionId,
                        timelineKey: timelineKey
                    });
                }
            });
        });

        // Sort events by time
        events.sort((a, b) => {
            return this.timeToMinutes(a.time) - this.timeToMinutes(b.time);
        });

        // Set timeline start and end times
        if (events.length > 0) {
            this.timeStart = events[0].time;
            this.timeEnd = events[events.length - 1].time;
        }

        return events;
    }

    extractTimeFromTimelineKey(key) {
        // Extract time from format "c:1-s:3-d:2025-03-12-10:24:37"
        const match = key.match(/d:(\d{4}-\d{2}-\d{2}-(\d{2}):(\d{2}):(\d{2}))/);
        if (match) {
            return `${match[2]}:${match[3]}:${match[4]}`;
        }
        return '00:00:00'; // Default if no time found
    }

    get relevantSnapshots() {
        if (!this.props.snapshots || !this.props.snapshots.length) return [];

        return this.props.snapshots.map(snapshot => {
            // Extract timestamp from snapshot ID (snapshot-YYYY-MM-DD-HH-MM-SS)
            const timePart = snapshot.substring(9).split('-');
            // Get just the time part (HH-MM-SS)
            const time = timePart.slice(3).join(':').replace(/-/g, ':');

            return {
                id: snapshot,
                time: time
            };
        });
    }

    timeToMinutes(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return hours * 60 + minutes + seconds / 60;
    }

    getTimePosition(timeStr) {
        if (!this.timeStart || !this.timeEnd) return 0;

        const startMinutes = this.timeToMinutes(this.timeStart);
        const endMinutes = this.timeToMinutes(this.timeEnd);
        const currentMinutes = this.timeToMinutes(timeStr);

        // Protect against division by zero
        if (endMinutes === startMinutes) return 50;

        // Calculate position as percentage
        const position = ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
        return Math.max(0, Math.min(100, position));
    }

    getEventClass(event) {
        const classes = [];
        if (event.level === 'warn') classes.push('warning');
        if (event.level === 'error') classes.push('error');
        return classes.join(' ');
    }

    getEventStyle(event) {
        const position = this.getTimePosition(event.time);
        return `left: ${position}%;`;
    }

    getSnapshotStyle(snapshot) {
        const position = this.getTimePosition(snapshot.time);
        return `left: ${position}%;`;
    }

    getSnapshotTime(snapshotId) {
        // Extract just the time part from the snapshot ID
        const timePart = snapshotId.substring(9).split('-');
        // Format: HH:MM
        return timePart.slice(3, 5).join(':');
    }

    selectSnapshot(snapshotId) {
        this.props.onSnapshotSelect(snapshotId);
    }
}