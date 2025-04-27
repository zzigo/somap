// Local analytics implementation
export class Analytics {
    constructor() {
        this.events = [];
        this.isEnabled = true;
    }

    track(eventName, properties = {}) {
        if (!this.isEnabled) return;

        const event = {
            name: eventName,
            properties,
            timestamp: new Date().toISOString(),
            sessionId: localStorage.getItem('userId') || 'anonymous'
        };

        this.events.push(event);
        console.debug('Analytics event:', event);

        // Optionally send to your server
        this.sendToServer(event).catch(err => {
            console.warn('Failed to send analytics event:', err);
        });
    }

    async sendToServer(event) {
        try {
            const response = await fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.warn('Analytics error:', error);
            // Store failed events for retry
            this.storeFailedEvent(event);
        }
    }

    storeFailedEvent(event) {
        const failedEvents = JSON.parse(localStorage.getItem('failedAnalytics') || '[]');
        failedEvents.push(event);
        localStorage.setItem('failedAnalytics', JSON.stringify(failedEvents));
    }

    retryFailedEvents() {
        const failedEvents = JSON.parse(localStorage.getItem('failedAnalytics') || '[]');
        if (failedEvents.length === 0) return;

        failedEvents.forEach(event => this.sendToServer(event));
        localStorage.removeItem('failedAnalytics');
    }

    disable() {
        this.isEnabled = false;
    }

    enable() {
        this.isEnabled = true;
    }
}

// Create and export a singleton instance
export const analytics = new Analytics();

// Export default for convenience
export default analytics; 