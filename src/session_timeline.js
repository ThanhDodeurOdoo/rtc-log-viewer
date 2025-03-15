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
                        t-key="event_index"
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
        if (!this.props.sessionData || !this.props.session) return [];

        const events = [];
        let eventId = 0;

        // Get session logs
        const sessionInfo = this.props.sessionData.entriesBySessionId[this.props.session];
        if (!sessionInfo || !sessionInfo.logs || !Array.isArray(sessionInfo.logs)) {
            return [];
        }

        // Process logs for this session
        sessionInfo.logs.forEach(log => {
            // Extract timestamp from event string
            const timeMatch = log.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
            if (timeMatch && timeMatch[1]) {
                const time = timeMatch[1].includes('T') ?
                    new Date(timeMatch[1]).toLocaleTimeString() :
                    timeMatch[1];

                const eventText = log.event.substring(timeMatch[0].length).trim();
                const level = log.level || 'info';

                events.push({
                    id: `event_${eventId++}`,
                    time: time,
                    text: eventText,
                    level: level,
                    tooltip: `${time}: ${eventText}`,
                    logEvent: log
                });
            }
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

    get relevantSnapshots() {
        if (!this.props.snapshots || !this.props.snapshots.length) return [];

        return this.props.snapshots.map(snapshot => {
            // Extract time from snapshot ID (ISO date string)
            let time = "";
            try {
                const date = new Date(snapshot);
                time = date.toLocaleTimeString();
            } catch (e) {
                // If parsing fails, try to extract time from format
                const timeParts = snapshot.split('T')[1];
                if (timeParts) {
                    time = timeParts.split('.')[0].replace(/:/g, ':');
                }
            }

            return {
                id: snapshot,
                time: time
            };
        });
    }

    timeToMinutes(timeStr) {
        let hours = 0, minutes = 0, seconds = 0;

        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) {
            [hours, minutes, seconds] = parts;
        } else if (parts.length === 2) {
            [minutes, seconds] = parts;
        } else if (parts.length === 1) {
            seconds = parts[0];
        }

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
        // Extract just the time part from the ISO date string
        try {
            const date = new Date(snapshotId);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return snapshotId.split('T')[1]?.split('.')[0]?.substring(0, 5) || "";
        }
    }

    selectSnapshot(snapshotId) {
        this.props.onSnapshotSelect(snapshotId);
    }
}