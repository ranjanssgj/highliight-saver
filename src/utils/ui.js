/**
 * Highlight Saver UI Utilities
 * Provides custom sleek modals and UI components to replace native browser dialogs.
 */

const CustomUI = {
    /**
     * Shows a premium confirmation modal.
     * @param {Object} options 
     * @param {string} options.title
     * @param {string} options.message
     * @param {string} options.confirmText
     * @param {string} options.cancelText
     * @param {boolean} options.isDestructive
     * @returns {Promise<boolean>}
     */
    confirm({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'hs-modal-overlay';

            const modal = document.createElement('div');
            modal.className = 'hs-modal-container';

            const header = document.createElement('div');
            header.className = 'hs-modal-header';
            header.textContent = title;

            const body = document.createElement('div');
            body.className = 'hs-modal-body';
            body.textContent = message;

            const footer = document.createElement('div');
            footer.className = 'hs-modal-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'hs-btn hs-btn-secondary';
            cancelBtn.textContent = cancelText;

            const confirmBtn = document.createElement('button');
            confirmBtn.className = `hs-btn ${isDestructive ? 'hs-btn-destructive' : 'hs-btn-primary'}`;
            confirmBtn.textContent = confirmText;

            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);

            modal.appendChild(header);
            modal.appendChild(body);
            modal.appendChild(footer);

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Trigger animation
            setTimeout(() => overlay.classList.add('active'), 10);

            // Trigger animation
            setTimeout(() => overlay.classList.add('active'), 10);

            cancelBtn.onclick = () => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    resolve(false);
                }, 300);
            };

            confirmBtn.onclick = () => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    resolve(true);
                }, 300);
            };

            // Close on overlay click
            overlay.onclick = (e) => {
                if (e.target === overlay) cancelBtn.click();
            };
        });
    }
};

if (typeof window !== 'undefined') {
    window.CustomUI = CustomUI;
}
if (typeof self !== 'undefined') {
    self.CustomUI = CustomUI;
}
