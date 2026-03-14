// Content script for Highlight Saver
let currentSettings = { theme: 'auto' };

async function applyTheme(theme) {
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark-mode', isDark);
}

// Listen for storage changes to sync theme
chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
        currentSettings = changes.settings.newValue;
        applyTheme(currentSettings.theme);
    }
});

// Initial theme load
chrome.storage.sync.get(['settings'], (result) => {
    currentSettings = result.settings || { theme: 'auto' };
    applyTheme(currentSettings.theme);
});

// Listen for system theme changes if in auto mode
window.matchMedia('(prefers-color-scheme: dark)').addListener(() => {
    if (currentSettings.theme === 'auto') applyTheme('auto');
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log('Content Script: Received message', request.action);
    if (request.action === 'CAPTURE_HIGHLIGHT') {
        const selection = window.getSelection();
        const selectedText = request.selectionText || selection.toString().trim();
        console.log('Content Script: Captured text:', selectedText);

        if (!selectedText) {
            console.warn('Highlight Saver: No text selected to save.');
            return;
        }

        const highlightObject = {
            id: Date.now().toString(),
            text: selectedText,
            url: window.location.href,
            hostname: window.location.hostname,
            color: 'var(--hs-hl-yellow)', // Use CSS Variable
            createdAt: new Date().toISOString()
        };

        try {
            if (window.StorageManager) {
                await window.StorageManager.saveHighlight(highlightObject);
                console.log('Highlight Saver: Highlight saved successfully.', highlightObject);

                // Try to highlight using existing selection first
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (range.toString().trim() === selectedText) {
                        highlightRange(range, highlightObject.id, highlightObject.color, true);
                        selection.removeAllRanges();
                        return;
                    }
                }

                // Fallback to text search
                highlightTextOnPage(highlightObject.text, highlightObject.id, highlightObject.color, true);
            } else {
                console.error('Highlight Saver: StorageManager not found in content script.');
            }
        } catch (error) {
            console.error('Highlight Saver: Error saving highlight:', error);
        }
    } else if (request.action === 'FOCUS_HIGHLIGHT') {
        const mark = document.querySelector(`mark[data-highlight-id="${request.id}"]`);
        if (mark) {
            mark.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Visual flash effect
            const originalTransition = mark.style.transition;
            const originalScale = mark.style.transform;

            mark.style.transition = 'all 0.3s ease';
            mark.style.transform = 'scale(1.1)';
            mark.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.2)';
            mark.style.zIndex = '9999';
            mark.style.position = 'relative';

            setTimeout(() => {
                mark.style.transform = originalScale;
                mark.style.boxShadow = '';
                setTimeout(() => {
                    mark.style.transition = originalTransition;
                    mark.style.zIndex = '';
                    mark.style.position = '';
                }, 300);
            }, 1000);
        }
    }
});

/**
 * Wraps a Range in <mark> elements, handling multi-node selections.
 */
function highlightRange(range, highlightId, color, shouldFlash = false) {
    const documentFragment = range.extractContents();
    const mark = document.createElement('mark');
    mark.className = 'highlight-saver-mark';
    mark.setAttribute('data-highlight-id', highlightId);
    mark.title = 'Click to delete highlight';
    if (color) mark.style.backgroundColor = color;

    mark.appendChild(documentFragment);
    range.insertNode(mark);

    if (shouldFlash) {
        mark.style.transition = 'outline 0.3s ease';
        mark.style.outline = '4px solid white';
        setTimeout(() => mark.style.outline = '', 1000);
    }

    mark.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToolbar(mark, highlightId);
    });
}

function showToolbar(mark, highlightId) {
    // Remove existing toolbars
    document.querySelectorAll('.hs-toolbar').forEach(t => t.remove());

    const toolbar = document.createElement('div');
    toolbar.className = 'hs-toolbar';

    // Position it
    const rect = mark.getBoundingClientRect();
    toolbar.style.top = `${window.scrollY + rect.top}px`;
    toolbar.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;

    const colors = [
        { name: 'yellow', value: 'var(--hs-hl-yellow)' },
        { name: 'green', value: 'var(--hs-hl-green)' },
        { name: 'pink', value: 'var(--hs-hl-pink)' },
        { name: 'blue', value: 'var(--hs-hl-blue)' },
        { name: 'orange', value: 'var(--hs-hl-orange)' }
    ];

    colors.forEach(c => {
        const dot = document.createElement('div');
        dot.className = 'hs-toolbar-color';
        dot.style.backgroundColor = c.value;
        if (mark.style.backgroundColor === c.value) dot.classList.add('active');

        dot.onclick = async () => {
            mark.style.backgroundColor = c.value;
            await window.StorageManager.updateHighlight(window.location.hostname, highlightId, { color: c.value });
            toolbar.remove();
        };
        toolbar.appendChild(dot);
    });

    const divider = document.createElement('div');
    divider.className = 'hs-toolbar-divider';
    toolbar.appendChild(divider);

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'hs-toolbar-delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete highlight';
    deleteBtn.onclick = async () => {
        toolbar.remove();
        const confirmed = await window.CustomUI.confirm({
            title: 'Delete Highlight',
            message: 'Are you sure you want to delete this highlight?',
            confirmText: 'Delete',
            isDestructive: true
        });

        if (confirmed) {
            try {
                await window.StorageManager.deleteHighlight(window.location.hostname, highlightId);
                const parent = mark.parentNode;
                while (mark.firstChild) {
                    parent.insertBefore(mark.firstChild, mark);
                }
                parent.removeChild(mark);
                parent.normalize();
            } catch (error) {
                console.error('Highlight Saver: Failed to delete highlight', error);
            }
        }
    };
    toolbar.appendChild(deleteBtn);

    document.body.appendChild(toolbar);

    // Close on click elsewhere
    const closeHandler = (e) => {
        if (!toolbar.contains(e.target) && e.target !== mark) {
            toolbar.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
}

/**
 * Searches for text on the page and highlights it.
 */
function highlightTextOnPage(searchText, highlightId, color, shouldFlash = false) {
    if (!searchText) return;

    // Find all ranges containing the text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        if (node.nodeValue.includes(searchText)) {
            // Check if already highlighted
            if (node.parentElement.closest('.highlight-saver-mark')) continue;
            // Avoid restricted tags
            if (['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) continue;

            const index = node.nodeValue.indexOf(searchText);
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + searchText.length);
            highlightRange(range, highlightId, color, shouldFlash);
            // After one successful highlight, we usually stop for that specific ID
            return;
        }
    }
}

async function restoreHighlights() {
    console.log('Content Script: Restoring highlights...');
    if (!window.StorageManager) return;

    try {
        const highlights = await window.StorageManager.getHighlights(window.location.hostname);
        const pageHighlights = highlights.filter(h => h.url === window.location.href);

        pageHighlights.forEach(h => {
            highlightTextOnPage(h.text, h.id, h.color);
        });
        console.log(`Content Script: Restored ${pageHighlights.length} highlights`);

        // REQ-18 Handshake: Check if we jumped here from popup
        await checkPendingHighlight();
    } catch (error) {
        console.error('Highlight Saver: Restore error', error);
    }
}

async function checkPendingHighlight() {
    const result = await chrome.storage.local.get(['pending_highlight']);
    const pending = result.pending_highlight;

    if (pending && pending.url === window.location.href) {
        console.log('Content Script: Processing pending highlight jump', pending.id);

        // Wait a small bit for DOM/highlights to settle
        setTimeout(() => {
            const mark = document.querySelector(`mark[data-highlight-id="${pending.id}"]`);
            if (mark) {
                mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Reuse the focus effect
                chrome.runtime.sendMessage({ action: 'FORCE_FOCUS_UI', id: pending.id });
            }
            chrome.storage.local.remove('pending_highlight');
        }, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreHighlights);
} else {
    restoreHighlights();
}

console.log('Highlight Saver: Content script loaded');
