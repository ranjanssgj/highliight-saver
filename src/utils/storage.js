const StorageManager = {
    /**
     * @param {Object} highlightDef 
     * @param {string} highlightDef.hostname
     * @param {string} highlightDef.url
     * @param {string} highlightDef.text
     * @param {string} highlightDef.id
     */
    async saveHighlight(highlightDef) {
        console.log('Storage: Saving highlight...', highlightDef);
        if (!highlightDef.hostname) throw new Error("hostname is required for saving highlight");
        const key = `highlights_${highlightDef.hostname}`;

        return new Promise((resolve, reject) => {
            chrome.storage.sync.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Storage: Get error', chrome.runtime.lastError);
                    return reject(chrome.runtime.lastError);
                }
                const existing = result[key] || [];
                existing.push(highlightDef);
                chrome.storage.sync.set({ [key]: existing }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Storage: Set error', chrome.runtime.lastError);
                        return reject(chrome.runtime.lastError);
                    }
                    console.log('Storage: Saved successfully');
                    resolve(true);
                });
            });
        });
    },

    /**
     * @param {string} hostname 
     * @returns {Promise<Array>} Array of highlights for the hostname
     */
    async getHighlights(hostname) {
        if (!hostname) return [];
        const key = `highlights_${hostname}`;
        console.log('Storage: Fetching highlights for', hostname);

        return new Promise((resolve) => {
            chrome.storage.sync.get([key], (result) => {
                const found = result[key] || [];
                console.log(`Storage: Found ${found.length} highlights for ${hostname}`);
                resolve(found);
            });
        });
    },

    /**
     * @param {string} hostname 
     * @param {string} id 
     */
    async deleteHighlight(hostname, id) {
        if (!hostname || !id) return;
        const key = `highlights_${hostname}`;

        return new Promise((resolve) => {
            chrome.storage.sync.get([key], (result) => {
                let existing = result[key] || [];
                existing = existing.filter(h => h.id !== id);
                chrome.storage.sync.set({ [key]: existing }, () => {
                    resolve(true);
                });
            });
        });
    },

    /**
     * @returns {Promise<Object>} Grouped highlights: { hostname: [highlights] }
     */
    async getAllHighlights() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (result) => {
                const grouped = {};
                for (const key in result) {
                    if (key.startsWith('highlights_')) {
                        const hostname = key.replace('highlights_', '');
                        grouped[hostname] = result[key];
                    }
                }
                resolve(grouped);
            });
        });
    },

    /**
     * @returns {Promise<Array>} List of pinned hostnames
     */
    async getPinnedWebsites() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['pinned_websites'], (result) => {
                resolve(result.pinned_websites || []);
            });
        });
    },

    /**
     * @param {string} hostname 
     */
    async toggleWebsitePin(hostname) {
        if (!hostname) return;
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['pinned_websites'], (result) => {
                let pinned = result.pinned_websites || [];
                const index = pinned.indexOf(hostname);

                if (index > -1) {
                    pinned.splice(index, 1);
                } else {
                    if (pinned.length >= 5) {
                        return reject(new Error("Maximum of 5 pinned websites allowed."));
                    }
                    pinned.push(hostname);
                }

                chrome.storage.sync.set({ pinned_websites: pinned }, () => {
                    resolve(pinned);
                });
            });
        });
    },

    /**
     * @param {string} hostname 
     * @param {string} id 
     */
    async toggleHighlightPin(hostname, id) {
        if (!hostname || !id) return;
        const key = `highlights_${hostname}`;

        return new Promise((resolve, reject) => {
            chrome.storage.sync.get([key], (result) => {
                let highlights = result[key] || [];
                const hIndex = highlights.findIndex(h => h.id === id);

                if (hIndex === -1) return reject(new Error("Highlight not found"));

                const currentlyPinnedCount = highlights.filter(h => h.pinned).length;
                const isCurrentlyPinned = !!highlights[hIndex].pinned;

                if (!isCurrentlyPinned && currentlyPinnedCount >= 5) {
                    return reject(new Error("Maximum of 5 pinned highlights allowed per website."));
                }

                highlights[hIndex].pinned = !isCurrentlyPinned;

                chrome.storage.sync.set({ [key]: highlights }, () => {
                    resolve(highlights[hIndex].pinned);
                });
            });
        });
    },

    /**
     * @param {string} hostname 
     * @param {string} id 
     * @param {Object} updates 
     */
    async updateHighlight(hostname, id, updates) {
        if (!hostname || !id) return;
        const key = `highlights_${hostname}`;

        return new Promise((resolve, reject) => {
            chrome.storage.sync.get([key], (result) => {
                let highlights = result[key] || [];
                const hIndex = highlights.findIndex(h => h.id === id);
                if (hIndex === -1) return reject(new Error("Highlight not found"));

                highlights[hIndex] = { ...highlights[hIndex], ...updates };

                chrome.storage.sync.set({ [key]: highlights }, () => {
                    resolve(true);
                });
            });
        });
    },

    /**
     * @returns {Promise<Object>} Entire storage content
     */
    async exportHighlights() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (result) => {
                resolve(result);
            });
        });
    },

    /**
     * @param {Object} data 
     */
    async importHighlights(data) {
        if (typeof data !== 'object' || data === null) {
            throw new Error("Invalid import data");
        }
        return new Promise((resolve) => {
            chrome.storage.sync.set(data, () => {
                resolve(true);
            });
        });
    },

    /**
     * @returns {Promise<Object>} Settings object
     */
    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['settings'], (result) => {
                resolve(result.settings || { theme: 'auto' });
            });
        });
    },

    /**
     * @param {Object} updates 
     */
    async updateSettings(updates) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['settings'], (result) => {
                const settings = { ...(result.settings || { theme: 'auto' }), ...updates };
                chrome.storage.sync.set({ settings }, () => {
                    resolve(settings);
                });
            });
        });
    }
};

if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
}
if (typeof self !== 'undefined') {
    self.StorageManager = StorageManager;
}
