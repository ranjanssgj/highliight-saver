// Background script for Highlight Saver
if (typeof importScripts !== 'undefined') {
    importScripts('../utils/storage.js');
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save_highlight",
        title: "Save Highlight",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log('Background: Context menu clicked', info.menuItemId);
    if (info.menuItemId === 'save_highlight') {
        const message = {
            action: 'CAPTURE_HIGHLIGHT',
            selectionText: info.selectionText
        };
        console.log('Background: Sending CAPTURE_HIGHLIGHT to tab', tab.id);

        try {
            await chrome.tabs.sendMessage(tab.id, message);
        } catch (err) {
            console.warn('Background: Direct message failed, attempting script injection...', err.message);

            try {
                // Manually inject scripts if the content script is missing/outdated
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/utils/storage.js', 'src/content/content.js']
                });

                // Wait a bit for listener to register
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, message);
                        console.log('Background: Message delivered after injection');
                    } catch (retryErr) {
                        console.error('Background: Retry failed after injection', retryErr);
                    }
                }, 100);
            } catch (injectErr) {
                console.error('Background: Script injection failed', injectErr);
            }
        }
    }
});

console.log('Highlight Saver: Service Worker loaded');
