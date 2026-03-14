// Popup script for Highlight Saver
// Helper: Safe SVG insertion using DOMParser to satisfy linter
const setSafeIcon = (el, svg) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (svgEl) {
        el.textContent = '';
        el.appendChild(svgEl);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('highlights-container');
    const searchInput = document.getElementById('search-input');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');

    if (!window.StorageManager) {
        container.textContent = 'Error: StorageManager not loaded.';
        return;
    }

    // Pin Extension Banner Logic
    const pinBanner = document.getElementById('pin-extension-banner');
    const closeBannerBtn = document.getElementById('close-pin-banner');

    async function checkPinBanner() {
        const settings = await window.StorageManager.getSettings();
        if (!settings.dismissedPinBanner) {
            pinBanner.classList.remove('hidden');
        }
    }

    closeBannerBtn.onclick = async () => {
        pinBanner.classList.add('hidden');
        await window.StorageManager.updateSettings({ dismissedPinBanner: true });
    };

    checkPinBanner();

    // State
    let allGroupedHighlights = {};
    let pinnedWebsites = [];
    let isManageMode = false;
    let selectedHighlights = new Set(); // Stores highlight.id
    let currentSettings = { theme: 'auto' };

    // Theme Logic
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.body.classList.toggle('dark-mode', isDark);
    }

    const ICONS = {
        PIN: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v2a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 10z"></path><path d="m12 22 5-3"></path><path d="m7 19 5 3"></path></svg>`,
        PIN_FILL: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v2a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 10z"></path><path d="m12 22 5-3"></path><path d="m7 19 5 3"></path></svg>`,
        TRASH: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
        EDIT: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`
    };

    // Listen for system theme changes if in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentSettings.theme === 'auto') applyTheme('auto');
    });

    // Initialize Header with Manage Button & Theme Selector
    const headerActions = document.getElementById('header-actions');

    // Theme Selector
    const themeSelector = document.createElement('select');
    themeSelector.id = 'theme-selector';
    themeSelector.className = 'hs-theme-select';
    themeSelector.innerHTML = `
        <option value="auto">🌓 Auto</option>
        <option value="light">☀️ Light</option>
        <option value="dark">🌙 Dark</option>
    `;

    themeSelector.onchange = async () => {
        const theme = themeSelector.value;
        currentSettings.theme = theme;
        await window.StorageManager.updateSettings({ theme });
        applyTheme(theme);
    };
    headerActions.appendChild(themeSelector);

    const manageBtn = document.createElement('button');
    manageBtn.id = 'manage-toggle-btn';
    manageBtn.textContent = 'Manage';
    manageBtn.className = 'hs-btn hs-btn-secondary';
    manageBtn.onclick = () => toggleManageMode();
    headerActions.appendChild(manageBtn);

    // Initialize Bulk Action Bar (Hidden)
    const actionBar = document.createElement('div');
    actionBar.id = 'bulk-action-bar';
    actionBar.className = 'bulk-action-bar hidden';
    actionBar.innerHTML = `
        <span id="selected-count">0 selected</span>
        <div class="bulk-actions">
            <button id="bulk-delete-btn" class="hs-btn hs-btn-destructive">Delete Selected</button>
            <button id="bulk-cancel-btn" class="hs-btn hs-btn-secondary">Cancel</button>
        </div>
    `;
    document.body.appendChild(actionBar);

    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const bulkCancelBtn = document.getElementById('bulk-cancel-btn');
    const selectedCountSpan = document.getElementById('selected-count');

    bulkCancelBtn.onclick = () => toggleManageMode(false);
    bulkDeleteBtn.onclick = async () => {
        if (selectedHighlights.size === 0) return;

        const confirmed = await window.CustomUI.confirm({
            title: 'Delete Multiple',
            message: `Are you sure you want to delete ${selectedHighlights.size} highlights?`,
            confirmText: 'Delete All',
            isDestructive: true
        });

        if (confirmed) {
            for (const hostname of Object.keys(allGroupedHighlights)) {
                const hList = allGroupedHighlights[hostname];
                for (const h of hList) {
                    if (selectedHighlights.has(h.id)) {
                        await window.StorageManager.deleteHighlight(hostname, h.id);
                    }
                }
            }
            selectedHighlights.clear();
            toggleManageMode(false);
            await loadData();
            render(searchInput.value);
        }
    };

    async function loadData() {
        console.log('Popup: Loading data...');
        allGroupedHighlights = await window.StorageManager.getAllHighlights();
        pinnedWebsites = await window.StorageManager.getPinnedWebsites();
        currentSettings = await window.StorageManager.getSettings();
        applyTheme(currentSettings.theme);
        themeSelector.value = currentSettings.theme;
    }

    function toggleManageMode(force) {
        isManageMode = force !== undefined ? force : !isManageMode;
        manageBtn.textContent = isManageMode ? 'Exit' : 'Manage';
        manageBtn.classList.toggle('hs-btn-primary', isManageMode);
        actionBar.classList.toggle('hidden', !isManageMode);
        if (!isManageMode) selectedHighlights.clear();
        updateSelectedCount();
        render(searchInput.value);
    }

    function updateSelectedCount() {
        selectedCountSpan.textContent = `${selectedHighlights.size} selected`;
        bulkDeleteBtn.disabled = selectedHighlights.size === 0;
    }

    function render(filterText = '') {
        container.innerHTML = '';
        const hostnames = Object.keys(allGroupedHighlights);

        if (hostnames.length === 0) {
            container.textContent = 'No highlights saved yet.';
            return;
        }

        const searchTerm = filterText.toLowerCase();

        // Sort: Pinned websites first, then alphabet
        const sortedHostnames = hostnames.sort((a, b) => {
            const aPinned = pinnedWebsites.indexOf(a) > -1;
            const bPinned = pinnedWebsites.indexOf(b) > -1;
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return a.localeCompare(b);
        });

        let foundAny = false;
        let totalCount = 0;

        sortedHostnames.forEach(hostname => {
            const highlights = allGroupedHighlights[hostname];
            const filteredHighlights = highlights.filter(h =>
                h.text.toLowerCase().includes(searchTerm) ||
                hostname.toLowerCase().includes(searchTerm) ||
                (h.note && h.note.toLowerCase().includes(searchTerm))
            );

            if (filteredHighlights.length === 0) return;
            foundAny = true;
            totalCount += filteredHighlights.length;

            const isPinned = pinnedWebsites.indexOf(hostname) > -1;
            const details = document.createElement('details');
            details.className = isPinned ? 'site-group pinned-site' : 'site-group';

            if (searchTerm) details.open = true;

            const summary = document.createElement('summary');
            summary.className = 'site-header';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'hostname-title';
            titleSpan.textContent = hostname;
            summary.appendChild(titleSpan);

            if (isPinned) {
                const siteBadge = document.createElement('span');
                siteBadge.className = 'item-pin-badge';
                siteBadge.textContent = 'PINNED';
                siteBadge.style.position = 'static';
                siteBadge.style.marginRight = '8px';
                summary.appendChild(siteBadge);
            }

            // Per-site badge
            const badge = document.createElement('span');
            badge.className = 'site-badge';
            badge.textContent = filteredHighlights.length;
            summary.appendChild(badge);

            const pinSiteBtn = document.createElement('button');
            pinSiteBtn.className = 'pin-btn site-pin';
            setSafeIcon(pinSiteBtn, isPinned ? ICONS.PIN_FILL : ICONS.PIN);
            pinSiteBtn.title = 'Pin website';
            pinSiteBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await window.StorageManager.toggleWebsitePin(hostname);
                await loadData();
                render(searchInput.value);
            };
            summary.appendChild(pinSiteBtn);
            details.appendChild(summary);

            const ul = document.createElement('ul');
            ul.className = 'highlight-list';

            const sortedHighlights = filteredHighlights.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            sortedHighlights.forEach(highlight => {
                const li = document.createElement('li');
                li.className = highlight.pinned ? 'highlight-item pinned' : 'highlight-item';
                if (highlight.color) {
                    li.style.borderLeftColor = highlight.color;
                    li.style.borderLeftWidth = '4px';
                }

                if (highlight.pinned) {
                    const pinBadge = document.createElement('span');
                    pinBadge.className = 'item-pin-badge';
                    pinBadge.textContent = 'PINNED';
                    li.appendChild(pinBadge);
                }

                // Multi-select Checkbox
                if (isManageMode) {
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'hs-checkbox';
                    cb.checked = selectedHighlights.has(highlight.id);
                    cb.onclick = (e) => {
                        e.stopPropagation();
                        if (cb.checked) selectedHighlights.add(highlight.id);
                        else selectedHighlights.delete(highlight.id);
                        updateSelectedCount();
                    };
                    li.appendChild(cb);
                    li.onclick = () => cb.click();
                }

                const contentDiv = document.createElement('div');
                contentDiv.style.flexGrow = '1';
                contentDiv.className = 'content-wrap';

                const textLink = document.createElement('a');
                textLink.href = highlight.url;
                textLink.className = 'highlight-link';
                textLink.textContent = highlight.text;
                textLink.onclick = async (e) => {
                    e.preventDefault();
                    if (isManageMode) return;

                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab && tab.url === highlight.url) {
                        chrome.tabs.sendMessage(tab.id, { action: 'FOCUS_HIGHLIGHT', id: highlight.id });
                    } else {
                        await chrome.storage.local.set({
                            pending_highlight: { id: highlight.id, url: highlight.url }
                        });
                        chrome.tabs.create({ url: highlight.url });
                    }
                };
                contentDiv.appendChild(textLink);

                if (highlight.note) {
                    const notePrev = document.createElement('div');
                    notePrev.className = 'note-preview';
                    notePrev.textContent = highlight.note;
                    contentDiv.appendChild(notePrev);
                }

                li.appendChild(contentDiv);

                if (!isManageMode) {
                    const actions = document.createElement('div');
                    actions.className = 'item-actions';

                    const editBtn = document.createElement('button');
                    editBtn.className = 'pin-btn';
                    setSafeIcon(editBtn, ICONS.EDIT);
                    editBtn.title = 'Edit Note';
                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        toggleEditForm(li, hostname, highlight);
                    };
                    actions.appendChild(editBtn);

                    const pinBtn = document.createElement('button');
                    pinBtn.className = 'pin-btn item-pin';
                    setSafeIcon(pinBtn, highlight.pinned ? ICONS.PIN_FILL : ICONS.PIN);
                    pinBtn.title = 'Pin Highlight';
                    pinBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await window.StorageManager.toggleHighlightPin(hostname, highlight.id);
                        await loadData();
                        render(searchInput.value);
                    };
                    actions.appendChild(pinBtn);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn';
                    setSafeIcon(deleteBtn, ICONS.TRASH);
                    deleteBtn.title = 'Delete';
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const confirmed = await window.CustomUI.confirm({
                            title: 'Delete Highlight',
                            message: 'Are you sure?',
                            confirmText: 'Delete',
                            isDestructive: true
                        });
                        if (confirmed) {
                            await window.StorageManager.deleteHighlight(hostname, highlight.id);
                            await loadData();
                            render(searchInput.value);
                        }
                    };
                    actions.appendChild(deleteBtn);
                    li.appendChild(actions);
                }

                ul.appendChild(li);
            });

            details.appendChild(ul);
            container.appendChild(details);
        });

        if (!foundAny && searchTerm) {
            container.innerHTML = '<div class="no-results">No matches found.</div>';
        }

        // Update search placeholder with totals
        searchInput.placeholder = `Search ${totalCount} highlight${totalCount !== 1 ? 's' : ''}...`;
    }

    function toggleEditForm(li, hostname, highlight) {
        const existing = li.querySelector('.edit-note-form');
        if (existing) { existing.remove(); return; }

        const form = document.createElement('div');
        form.className = 'edit-note-form';

        const colorPicker = document.createElement('div');
        colorPicker.className = 'color-picker';
        const colors = [
            { name: 'yellow', value: 'var(--hs-hl-yellow)' },
            { name: 'green', value: 'var(--hs-hl-green)' },
            { name: 'pink', value: 'var(--hs-hl-pink)' },
            { name: 'blue', value: 'var(--hs-hl-blue)' },
            { name: 'orange', value: 'var(--hs-hl-orange)' }
        ];

        let selectedColor = highlight.color || colors[0].value;
        colors.forEach(c => {
            const opt = document.createElement('div');
            opt.className = `color-option color-${c.name}${selectedColor === c.value ? ' selected' : ''}`;
            opt.style.backgroundColor = c.value;
            opt.onclick = () => {
                form.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
                opt.classList.add('selected');
                selectedColor = c.value;
            };
            colorPicker.appendChild(opt);
        });

        const textarea = document.createElement('textarea');
        textarea.value = highlight.note || '';
        textarea.placeholder = 'Add a note...';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'hs-btn hs-btn-primary';
        saveBtn.textContent = 'Save';
        saveBtn.onclick = async () => {
            await window.StorageManager.updateHighlight(hostname, highlight.id, {
                note: textarea.value,
                color: selectedColor
            });
            await loadData();
            render(searchInput.value);
        };

        form.appendChild(colorPicker);
        form.appendChild(textarea);
        form.appendChild(saveBtn);
        li.appendChild(form);
        textarea.focus();
    }

    searchInput.addEventListener('input', (e) => render(e.target.value));

    exportBtn.onclick = async () => {
        const data = await window.StorageManager.exportHighlights();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `highlights-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    importBtn.onclick = () => importInput.click();
    importInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const confirmed = await window.CustomUI.confirm({
                    title: 'Import Highlights',
                    message: 'This will overwrite your current highlights. Continue?'
                });
                if (confirmed) {
                    await window.StorageManager.importHighlights(data);
                    await loadData();
                    render(searchInput.value);
                }
            } catch (err) {
                alert('Import Failed: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    await loadData();
    render();
});
