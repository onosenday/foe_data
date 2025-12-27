// Google Analytics 4 Credentials
let GA_MEASUREMENT_ID = '';
let GA_API_SECRET = '';
let GA_ENDPOINT = '';

// Debug mode (prints events to console instead of sending)
const DEBUG = false;

class Analytics {
    constructor() {
        this.clientId = null;
        this.enabled = true; // Default to true, strictly controlled by user setting
        this.initialized = false;
    }

    /**
     * Initialize the analytics service.
     * Loads config, client ID and privacy preference.
     */
    async init() {
        if (this.initialized) return;

        // 1. Load Configuration (Dynamic Import)
        try {
            // Try to load real config (gitignored)
            const config = await import('./config.js');
            GA_MEASUREMENT_ID = config.GA_CONFIG.MEASUREMENT_ID;
            GA_API_SECRET = config.GA_CONFIG.API_SECRET;
        } catch (e) {
            // Fallback to example/placeholder (e.g. zip installation)
            if (DEBUG) console.warn('[Analytics] config.js not found. Using placeholders.');
            try {
                const example = await import('./config.example.js');
                GA_MEASUREMENT_ID = example.GA_CONFIG.MEASUREMENT_ID;
                GA_API_SECRET = example.GA_CONFIG.API_SECRET;
            } catch (e2) {
                console.error('[Analytics] No config file found.');
            }
        }

        GA_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

        // 2. Load Client ID
        const stored = await chrome.storage.local.get(['analytics_client_id', 'analytics_enabled']);

        if (stored.analytics_client_id) {
            this.clientId = stored.analytics_client_id;
        } else {
            this.clientId = this._generateUUID();
            await chrome.storage.local.set({ analytics_client_id: this.clientId });
        }

        // 3. Load Privacy Setting (default to true if undefined)
        this.enabled = stored.analytics_enabled !== false;

        this.initialized = true;
    }

    /**
     * Enable or disable analytics.
     * @param {boolean} isEnabled 
     */
    async setEnabled(isEnabled) {
        this.enabled = isEnabled;
        await chrome.storage.local.set({ analytics_enabled: isEnabled });
    }

    /**
     * Track a custom event.
     * @param {string} eventName - e.g. 'export_json', 'view_popup'
     * @param {object} params - Additional parameters
     */
    async track(eventName, params = {}) {
        if (!this.enabled) return;

        // Ensure init complete
        if (!this.initialized) await this.init();

        // If no credentials, abort (unless debugging)
        if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.includes('YOUR_')) {
            if (DEBUG) console.warn('[Analytics] Credentials missing/invalid. Request not sent.');
            return;
        }

        const payload = {
            client_id: this.clientId,
            events: [{
                name: eventName,
                params: {
                    ...params,
                    session_id: '1' // Simplified session handling
                }
            }]
        };

        if (DEBUG) {
            console.log('[Analytics] Tracking:', eventName, payload);
        }

        try {
            const response = await fetch(GA_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok && DEBUG) {
                console.error('[Analytics] Failed to send event', response);
            }
        } catch (e) {
            if (DEBUG) console.error('[Analytics] Network error', e);
        }
    }

    /**
     * Generate a random UUID v4
     */
    _generateUUID() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
}

// Export singleton
export const analytics = new Analytics();
