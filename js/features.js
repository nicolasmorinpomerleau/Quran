'use strict';

// ═══════════════════════════════════════════════════════════════════
// QURAN APP v9.9 — Phase 1 Features Module
// ═══════════════════════════════════════════════════════════════════
// All features can be toggled in Settings → Features
// Defaults are conservative — power features are opt-in
// ═══════════════════════════════════════════════════════════════════

const FEATURES_KEY = 'quranFeaturesV1';

// Per-section tutorial video links — replace placeholder URLs with specific videos when ready
const HELP_VIDEOS = {
    display:  'https://www.youtube.com/@islampaixducoeur',
    reading:  'https://www.youtube.com/@islampaixducoeur',
    search:   'https://www.youtube.com/@islampaixducoeur',
    study:    'https://www.youtube.com/@islampaixducoeur',
    audio:    'https://www.youtube.com/@islampaixducoeur',
    advanced: 'https://www.youtube.com/@islampaixducoeur',
    privacy:  'https://www.youtube.com/@islampaixducoeur',
};

// Default feature flags (user can toggle in settings)
const DEFAULT_FEATURES = {
    // v10.9: Off by default — user can opt in
    keyboardShortcuts: true,         // #2 — always on (desktop only, harmless on mobile)
    lastReadBanner:    false,        // #6 — Continue Reading banner
    khatmTracker:      false,        // #13
    // Always on (no toggle): pullToRefresh, deepLinks. Removed from this map.
    // Removed dead flags: bookmarkTags, landscapeLayout, loadingSkeletons.
    copyShareVerse:    true,         // #3
    swipeBetweenSurahs:true,         // #4 (mobile)
    searchAsYouType:   true,         // #5
    saveTools:         true,         // v10.8 — unified: highlight + bookmark + note
    arabicFontChoice:  true,         // #17
    focusMode:         true,         // #18
    autoDarkTheme:     false,        // #19 (off by default — opinionated)
    browserLangDefault:false,        // #20 (off by default — Arabic is best default)
    hapticFeedback:    true,         // #22 (mobile)
    verseNavigation:   true,         // #1
    notesExportImport: true,         // #7
    betterErrorStates: true,         // #16
    audioRecitation:   true,         // v10.2 — Phase 2b
    tafsir:            true,         // v10.2 — Phase 2b
    // v10.7 — eight features
    topicsIndex:           true,
    dailyVerse:            true,
    reflectionPrompts:     true,
    hijriAwareness:        true,
    verseComparison:       true,
    pdfExport:             true,
    readingTimeAnalytics:  true,
    voiceSearch:           true,
    dailyVerseNotification:false,     // v10.10 — opt-in (requires notification permission)
    analyticsOptOut:       false      // v11: anonymous usage stats ON by default (user can opt out)
};

// v10.9: One-time migration — for users upgrading from v10.8 or earlier,
// reset the now-default-OFF flags to false (user-friendly fresh experience).
// They can opt back in via Settings if they want.
(function v109DefaultsMigration() {
    try {
        if (localStorage.getItem('quranV109Migrated') === '1') return;
        var saved = JSON.parse(localStorage.getItem(FEATURES_KEY) || '{}');
        // Force these to off (matches new defaults)
        saved.lastReadBanner    = false;
        saved.khatmTracker      = false;
        // v10.14.10: always-on features — clear any saved override so defaults apply
        delete saved.keyboardShortcuts;
        delete saved.copyShareVerse;
        delete saved.saveTools;
        // Remove dead flag entries so they don't leak into UI anymore
        delete saved.bookmarkTags;
        delete saved.landscapeLayout;
        delete saved.loadingSkeletons;
        delete saved.pullToRefresh; // always on
        delete saved.deepLinks;     // always on
        delete saved.hapticFeedback;     // v10.10: always on
        delete saved.swipeBetweenSurahs; // v10.10: always on
        delete saved.betterErrorStates;  // v10.10: removed (dead code)
        localStorage.setItem(FEATURES_KEY, JSON.stringify(saved));
        localStorage.setItem('quranV109Migrated', '1');
    } catch(e) {}
}());

// v10.14.10: always-on features — clear any saved override so the new defaults apply
(function v1014DefaultsMigration() {
    try {
        if (localStorage.getItem('quranV1014Migrated') === '1') return;
        var saved = JSON.parse(localStorage.getItem(FEATURES_KEY) || '{}');
        delete saved.keyboardShortcuts;  // now always on
        delete saved.copyShareVerse;     // now always on
        delete saved.saveTools;          // now always on
        delete saved.arabicFontChoice;   // now always on
        delete saved.hijriAwareness;     // now always on
        delete saved.audioRecitation;      // now always on
        delete saved.notesExportImport;   // now always on
        delete saved.readingTimeAnalytics;// now always on
        localStorage.setItem(FEATURES_KEY, JSON.stringify(saved));
        localStorage.setItem('quranV1014Migrated', '1');
    } catch(e) {}
}());

function getFeatures() {
    try {
        var saved = JSON.parse(localStorage.getItem(FEATURES_KEY) || '{}');
        var merged = {};
        Object.keys(DEFAULT_FEATURES).forEach(function(k) {
            merged[k] = (k in saved) ? saved[k] : DEFAULT_FEATURES[k];
        });
        return merged;
    } catch(e) {
        return Object.assign({}, DEFAULT_FEATURES);
    }
}

function saveFeatures(f) {
    try { localStorage.setItem(FEATURES_KEY, JSON.stringify(f)); } catch(e) {}
}

function isFeatureOn(name) {
    return !!getFeatures()[name];
}

// Quick helper — v10.10: always on (no toggle)
function hapticTap(ms) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms || 10); } catch(e) {}
    }
}

// v11: Analytics helper — calls umami.track() if loaded and user hasn't opted out
function track(name, props) {
    try {
        if (isFeatureOn('analyticsOptOut')) return;
        if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
            umami.track(name, props || {});
        }
    } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════════
// #20 — Default to browser language on first run (opt-in)
// Apply by triggering the language selector after init has loaded
// ═══════════════════════════════════════════════════════════════════
function applyBrowserLangDefault() {
    if (localStorage.getItem('quranInitLangApplied') === '1') return;
    if (!isFeatureOn('browserLangDefault')) return;
    var browserLang = (navigator.language || 'en').toLowerCase();
    var map = { 'fr': 'french', 'en': 'english', 'es': 'spanish', 'ar': 'arabic' };
    var lang = null;
    for (var prefix in map) {
        if (browserLang.indexOf(prefix) === 0) { lang = map[prefix]; break; }
    }
    if (!lang) return;
    var sel = document.getElementById('languageSelector');
    if (sel && sel.value !== lang) {
        sel.value = lang;
        sel.dispatchEvent(new Event('change'));
        try { localStorage.setItem('quranInitLangApplied', '1'); } catch(e) {}
    }
}

// ═══════════════════════════════════════════════════════════════════
// #19 — Auto dark theme (time-based, simple)
//        Switches to scholar after 7pm, manuscript before 7pm
// ═══════════════════════════════════════════════════════════════════
function applyAutoTheme() {
    if (!isFeatureOn('autoDarkTheme')) return;
    var hour = new Date().getHours();
    var theme = (hour >= 19 || hour < 6) ? 'scholar' : 'manuscript';
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-theme') === theme);
    });
}

// ═══════════════════════════════════════════════════════════════════
// #15 — Deep links: ?s=2&v=255 opens directly to that verse
// ═══════════════════════════════════════════════════════════════════
function parseDeepLink() {
    // v10.9: deepLinks always enabled (no toggle)
    var p = new URLSearchParams(location.search);
    var s = parseInt(p.get('s'), 10);
    var v = parseInt(p.get('v'), 10);
    if (isNaN(s) || s < 1 || s > 114) return null;
    return { suraIdx: s - 1, verseNum: !isNaN(v) ? v : null };
}

function applyDeepLinkOnLoad() {
    var dl = parseDeepLink();
    if (!dl) return;
    setTimeout(function() {
        if (typeof displaySingleSura === 'function') {
            displaySingleSura(dl.suraIdx);
            if (dl.verseNum) {
                setTimeout(function() {
                    var verses = document.querySelectorAll('.verse');
                    if (verses[dl.verseNum - 1]) {
                        verses[dl.verseNum - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        verses[dl.verseNum - 1].style.transition = 'background 0.4s';
                        verses[dl.verseNum - 1].style.background = 'var(--accent-trace)';
                        setTimeout(function() {
                            verses[dl.verseNum - 1].style.background = '';
                        }, 1500);
                    }
                }, 300);
            }
        }
    }, 500);
}

// Build a deep link for a verse
function buildDeepLink(suraId, verseNum) {
    var s = parseInt(suraId, 10) + 1;
    var url = location.origin + location.pathname + '?s=' + s + '&v=' + verseNum;
    return url;
}

// ═══════════════════════════════════════════════════════════════════
// #6 — Last-read banner
// ═══════════════════════════════════════════════════════════════════
function getLastReadInfo() {
    var hx = JSON.parse(localStorage.getItem('quranReadHistory') || '{}');
    var keys = Object.keys(hx);
    if (keys.length < 1) return null;
    // Find the most recently read sura
    var current = document.querySelector('.sura');
    var currentId = current ? current.id : null;
    var sorted = keys.sort(function(a, b) { return hx[b] - hx[a]; });
    // Skip the current one only if there's something else
    for (var i = 0; i < sorted.length; i++) {
        if (sorted[i] !== currentId || sorted.length === 1) {
            var data = quranData.find(function(s) { return s.id === sorted[i]; });
            if (data) {
                // Try to read scroll position too (saved in main app state)
                var lastVerseIdx = null;
                try {
                    var st = JSON.parse(localStorage.getItem('quranAppState') || '{}');
                    if (st.lastVerseBySura && st.lastVerseBySura[sorted[i]] != null) {
                        lastVerseIdx = st.lastVerseBySura[sorted[i]];
                    }
                } catch(e) {}
                // Calculate "X ago" timestamp
                var elapsed = Date.now() - hx[sorted[i]];
                var ago;
                if (elapsed < 60000) ago = 'just now';
                else if (elapsed < 3600000) ago = Math.round(elapsed/60000) + ' min ago';
                else if (elapsed < 86400000) ago = Math.round(elapsed/3600000) + ' hr ago';
                else ago = Math.round(elapsed/86400000) + 'd ago';
                return {
                    suraId: sorted[i],
                    suraName: data.name,
                    suraNum: parseInt(sorted[i]) + 1,
                    ts: hx[sorted[i]],
                    ago: ago,
                    verseIdx: lastVerseIdx
                };
            }
        }
    }
    return null;
}

// v10: Persistent Continue Reading card — builds and returns the element.
// Inserted by the Surahs sheet builder + desktop TOC builder.
function buildContinueCard() {
    if (!isFeatureOn('lastReadBanner')) return null;
    var info = getLastReadInfo();
    if (!info) return null;
    var card = document.createElement('div');
    card.className = 'continue-reading-card';
    var verseLine = info.verseIdx != null
        ? '<div class="crc-verse">Verse ' + (info.verseIdx + 1) + ' · ' + info.ago + '</div>'
        : '<div class="crc-verse">' + info.ago + '</div>';
    card.innerHTML =
        '<span class="crc-icon">📍</span>' +
        '<div class="crc-text">' +
            '<div class="crc-label">Continue where you left off</div>' +
            '<div class="crc-name">' + info.suraName + '</div>' +
            verseLine +
        '</div>' +
        '<span class="crc-arrow">→</span>';
    card.addEventListener('click', function() {
        if (typeof closeMobileSheet === 'function') closeMobileSheet();
        if (typeof displaySingleSura === 'function') {
            displaySingleSura(info.suraId);
            if (info.verseIdx != null) {
                setTimeout(function() {
                    var verses = document.querySelectorAll('.verse');
                    if (verses[info.verseIdx]) {
                        verses[info.verseIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 200);
            }
        }
        track('continue_reading_clicked', { sura: info.suraId, verse: info.verseIdx });
        hapticTap(15);
    });
    return card;
}

// v10: Old banner removed — kept as a no-op stub for backward compat
function showLastReadBanner() {
    var existing = document.getElementById('lastReadBanner');
    if (existing) existing.remove();
}

// ═══════════════════════════════════════════════════════════════════
// #14 — Loading skeletons removed in v10.9 (was never called anywhere
// and content loads instantly from local XML, so it was dead code).
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// #16 — Better error states removed in v10.10 (was never called anywhere —
// tafsir, audio, and search each have their own inline error UI).
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// #2 — Keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════
(function keyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ignore if typing in an input/textarea
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            // Esc to blur
            if (e.key === 'Escape') e.target.blur();
            return;
        }

        // Ignore if any modal/sheet is open and key isn't Esc
        var noteModal = document.getElementById('noteModal');
        var confirmOverlay = document.getElementById('confirmOverlay');
        var modalOpen = (noteModal && noteModal.style.display === 'flex') ||
                        (confirmOverlay && confirmOverlay.classList.contains('show'));

        if (e.key === 'Escape') {
            if (modalOpen) return;
            // Close mobile sheet
            var sheet = document.getElementById('mobileSheet');
            if (sheet && sheet.classList.contains('open') && typeof closeMobileSheet === 'function') {
                closeMobileSheet();
                e.preventDefault();
                return;
            }
            // Close desktop search/bookmarks
            var bm = document.getElementById('bookmarksPanel');
            if (bm && bm.classList.contains('bookmarksContainer')) {
                bm.classList.replace('bookmarksContainer', 'eraseDiv');
                e.preventDefault();
                return;
            }
            var rc = document.getElementById('resultsContainerID');
            if (rc && rc.classList.contains('resultsContainer')) {
                if (typeof closeSearchResults === 'function') closeSearchResults();
                e.preventDefault();
                return;
            }
            // Close help
            var help = document.getElementById('shortcutsHelp');
            if (help && help.classList.contains('show')) {
                help.classList.remove('show');
                e.preventDefault();
            }
            return;
        }

        if (modalOpen) return;

        // Arrow keys: prev/next surah
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            var current = document.querySelector('.sura');
            if (!current) return;
            var idx = parseInt(current.id);
            var nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
            if (nextIdx < 0 || nextIdx > 113) return;
            if (typeof displaySingleSura === 'function') {
                displaySingleSura(nextIdx);
                e.preventDefault();
            }
            return;
        }

        // / to focus search
        if (e.key === '/') {
            var inp = document.getElementById('search-input');
            if (inp) {
                inp.focus();
                inp.select();
                e.preventDefault();
            }
            return;
        }

        // ? to show help
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            toggleShortcutsHelp();
            e.preventDefault();
            return;
        }

        // F to toggle focus mode
        if (e.key === 'f' || e.key === 'F') {
            toggleFocusMode();
            e.preventDefault();
            return;
        }
    });
}());

function toggleShortcutsHelp() {
    var help = document.getElementById('shortcutsHelp');
    if (!help) {
        help = document.createElement('div');
        help.id = 'shortcutsHelp';
        help.className = 'shortcuts-help';
        help.innerHTML =
            '<div class="shortcuts-box">' +
            '<div class="shortcuts-header"><h3>Keyboard shortcuts</h3><button class="shortcuts-close">✕</button></div>' +
            '<div class="shortcut-row"><kbd>←</kbd> <kbd>→</kbd><span>Previous / Next surah</span></div>' +
            '<div class="shortcut-row"><kbd>/</kbd><span>Focus search</span></div>' +
            '<div class="shortcut-row"><kbd>F</kbd><span>Toggle focus mode</span></div>' +
            '<div class="shortcut-row"><kbd>Esc</kbd><span>Close panel / modal</span></div>' +
            '<div class="shortcut-row"><kbd>?</kbd><span>Show this help</span></div>' +
            '</div>';
        document.body.appendChild(help);
        help.addEventListener('click', function(e) {
            if (e.target === help || e.target.classList.contains('shortcuts-close')) {
                help.classList.remove('show');
            }
        });
    }
    help.classList.toggle('show');
}

// ═══════════════════════════════════════════════════════════════════
// #18 — Focus / reading mode
// ═══════════════════════════════════════════════════════════════════
function toggleFocusMode() {
    if (!isFeatureOn('focusMode')) return;
    var entering = !document.body.classList.contains('focus-mode');
    if (entering) {
        document.body.classList.add('focus-mode');
        window._focusModeActivatedAt = Date.now();
    } else {
        document.body.classList.remove('focus-mode');
    }
    track('focus_mode_toggled', { state: entering ? 'on' : 'off' });
    hapticTap(15);
}

// v9.11: Tap anywhere in focus mode to exit — but ignore taps that happen
// within 500ms of activation (so the same tap that activated it doesn't exit)
document.addEventListener('click', function(e) {
    if (!document.body.classList.contains('focus-mode')) return;
    var activated = window._focusModeActivatedAt || 0;
    if (Date.now() - activated < 500) return;
    // Don't exit if user clicked a button inside the verse area
    if (e.target.closest('.verse-action-btn')) return;
    if (e.target.closest('.verse-actions')) return;
    if (e.target.closest('.verse-chooser')) return;
    document.body.classList.remove('focus-mode');
});

// ═══════════════════════════════════════════════════════════════════
// #5 — Search-as-you-type (debounced) — works for ANY search input
// Uses event delegation so it covers desktop AND mobile sheet inputs
// ═══════════════════════════════════════════════════════════════════
(function searchAsYouType() {
    var timer = null;
    document.addEventListener('input', function(e) {
        if (!isFeatureOn('searchAsYouType')) return;
        var t = e.target;
        // Only respond to actual search inputs:
        // - desktop #search-input
        // - mobile sheet search input (inside .mob-search-row)
        var isDesktop = t.id === 'search-input';
        var isMobile  = t.tagName === 'INPUT' && t.closest && t.closest('.mob-search-row');
        if (!isDesktop && !isMobile) return;
        if (isMobile) return; // mobile uses the ↵ button — live search causes focus loss

        var term = t.value.trim();
        clearTimeout(timer);
        if (term.length < 2) {
            // Optional: clear results if user erases
            return;
        }

        // Sync the desktop input so searchQuran() reads the right value
        var desktop = document.getElementById('search-input');
        if (desktop && desktop !== t) desktop.value = t.value;

        timer = setTimeout(function() {
            if (typeof searchQuran === 'function') searchQuran(term);
        }, 350);
    });
}());

// ═══════════════════════════════════════════════════════════════════
// #3 — Copy / Share verse + #1 verse navigation buttons
// v10: The Save/Share chooser in buildVerseActions handles this natively.
// This function is kept as a no-op for backwards compatibility — the
// helpers (copyVerseToClipboard / shareVerse / buildDeepLink) are still
// called by the new chooser in script.js.
// ═══════════════════════════════════════════════════════════════════
function attachVerseExtras(verseEl, suraId, verseIdx, verseText, suraName) {
    // v10: No-op — chooser pattern in buildVerseActions handles all these actions.
    return;
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function(){
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
}

function buildShareableText(suraId, verseIdx, verseText, suraName) {
    var sNum = parseInt(suraId, 10) + 1;
    var vNum = verseIdx + 1;
    var lines = [
        verseText,
        '',
        '— ' + suraName + ' (' + sNum + ':' + vNum + ')'
    ];
    // v10.3: Use getElementById (numeric IDs are illegal in CSS selectors).
    // This fixes the bug where translations were never included in Copy.
    var suraEl = document.getElementById(String(suraId));
    if (suraEl) {
        var verses = suraEl.querySelectorAll('.verse');
        if (verses[verseIdx]) {
            var secondaries = verses[verseIdx].querySelectorAll('.secondary-verse');
            if (secondaries.length > 0) {
                lines.push('');
                secondaries.forEach(function(s) { lines.push(s.textContent); });
            }
        }
    }
    return lines.join('\n');
}

function copyVerseToClipboard(suraId, verseIdx, verseText, suraName) {
    var text = buildShareableText(suraId, verseIdx, verseText, suraName);
    copyToClipboard(text);
    showToast('📋 Verse copied');
}

function shareVerse(suraId, verseIdx, verseText, suraName) {
    var text = buildShareableText(suraId, verseIdx, verseText, suraName);
    // v10.9: deep links always enabled (always-on feature, no toggle)
    var url = buildDeepLink(suraId, verseIdx + 1);
    if (navigator.share) {
        navigator.share({
            title: suraName + ' ' + (parseInt(suraId)+1) + ':' + (verseIdx+1),
            text: text,
            url: url
        }).catch(function(){});
    } else {
        copyToClipboard(text + '\n\n' + url);
        showToast('📋 Copied to share');
    }
}

// Toast
function showToast(message) {
    var toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.className = 'app-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(function() {
        toast.classList.remove('show');
    }, 2000);
}

// ═══════════════════════════════════════════════════════════════════
// #1 — Verse prev/next navigation (floating button on mobile, top of pane on desktop)
// ═══════════════════════════════════════════════════════════════════
function buildVerseNav() {
    if (!isFeatureOn('verseNavigation')) return;
    var existing = document.getElementById('verseNavFab');
    if (existing) existing.remove();

    var fab = document.createElement('div');
    fab.id = 'verseNavFab';
    fab.className = 'verse-nav-fab';
    fab.innerHTML =
        '<button class="vnav-btn" data-dir="up" title="Previous surah">‹</button>' +
        '<button class="vnav-btn vnav-jump" title="Jump to verse">#</button>' +
        '<button class="vnav-btn" data-dir="down" title="Next surah">›</button>';
    document.body.appendChild(fab);

    // Make FAB draggable (touch + mouse) so it never blocks the bottom nav
    (function makeDraggable(el) {
        var isDragging = false, startX, startY, origLeft, origBottom, moved = false;
        function onStart(e) {
            if (e.touches && e.touches.length !== 1) return;
            var pt = e.touches ? e.touches[0] : e;
            isDragging = true; moved = false;
            startX = pt.clientX; startY = pt.clientY;
            // Get VISUAL rect (after CSS transform)
            var rect = el.getBoundingClientRect();
            origLeft = rect.left;
            origBottom = window.innerHeight - rect.bottom;
            // Clear CSS transform & positional props before switching to left/bottom
            el.style.transition = 'none';
            el.style.transform = 'none';
            el.style.top = 'auto';
            el.style.right = 'auto';
            el.style.left = origLeft + 'px';
            el.style.bottom = origBottom + 'px';
        }
        function onMove(e) {
            if (!isDragging) return;
            var pt = e.touches ? e.touches[0] : e;
            var dx = pt.clientX - startX, dy = pt.clientY - startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
            if (!moved) return;
            if (e.cancelable) e.preventDefault();
            var newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, origLeft + dx));
            var newBottom = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, origBottom - dy));
            el.style.left = newLeft + 'px';
            el.style.bottom = newBottom + 'px';
        }
        function onEnd() {
            if (!isDragging) return;
            isDragging = false;
            el.style.transition = '';
            // Keep inline left/bottom/transform so dragged position persists
        }
        el.addEventListener('mousedown', onStart);
        // non-passive so preventDefault works inside onMove
        el.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
        // Suppress click after drag
        el.addEventListener('click', function(e) { if (moved) { e.stopPropagation(); moved = false; } }, true);
    }(fab));

    fab.querySelector('[data-dir="up"]').addEventListener('click', function() {
        var s = document.querySelector('.sura');
        if (!s) return;
        var i = parseInt(s.id);
        if (i > 0 && typeof displaySingleSura === 'function') {
            displaySingleSura(i - 1);
            hapticTap(15);
        }
    });
    fab.querySelector('[data-dir="down"]').addEventListener('click', function() {
        var s = document.querySelector('.sura');
        if (!s) return;
        var i = parseInt(s.id);
        if (i < 113 && typeof displaySingleSura === 'function') {
            displaySingleSura(i + 1);
            hapticTap(15);
        }
    });
    fab.querySelector('.vnav-jump').addEventListener('click', function() {
        var s = document.querySelector('.sura');
        if (!s) return;
        var sura = quranData.find(function(x) { return x.id === s.id; });
        if (!sura) return;
        var max = sura.verses.length;
        var v = prompt('Jump to verse (1–' + max + '):');
        var n = parseInt(v, 10);
        if (!isNaN(n) && n >= 1 && n <= max) {
            var verses = document.querySelectorAll('.verse');
            if (verses[n-1]) {
                verses[n-1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                hapticTap(15);
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// #4 — Swipe between surahs (mobile) — with animated transition
// v9.11: Content follows finger; releases with slide-in animation
// ═══════════════════════════════════════════════════════════════════
(function swipeBetweenSurahs() {
    var startX = null, startY = null, startTime = 0;
    var tracking = false;
    var container = null;

    function getContainer() {
        if (!container) container = document.getElementById('quranContainer');
        return container;
    }

    document.addEventListener('touchstart', function(e) {
        // v10.10: Always on (no toggle) — natural gesture
        if (window.innerWidth > 900) return;
        if (!e.target.closest('#quranContainer')) return;
        if (e.touches.length !== 1) { startX = null; tracking = false; return; }
        // Don't track if user is interacting with verse-action-btns or scroll
        if (e.target.closest('.verse-action-btn')) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
        tracking = false;
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (startX === null) return;
        if (e.touches.length !== 1) return;
        var dx = e.touches[0].clientX - startX;
        var dy = e.touches[0].clientY - startY;
        // Decide once whether this is a horizontal swipe (lock in direction)
        if (!tracking && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            tracking = true;
            var c = getContainer();
            if (c) c.style.transition = 'none';
        }
        if (tracking) {
            var c = getContainer();
            if (!c) return;
            // Apply translateX to the inner sura element so it follows finger
            var sura = c.querySelector('.sura');
            if (sura) {
                // Dampen with sqrt for natural resistance feel
                var move = dx * 0.7;
                sura.style.transform = 'translateX(' + move + 'px)';
                sura.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 600));
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        if (startX === null) return;
        var ended = e.changedTouches[0];
        var dx = ended.clientX - startX;
        var dy = ended.clientY - startY;
        var dt = Date.now() - startTime;
        var wasTracking = tracking;
        startX = null;
        tracking = false;

        var sura = document.querySelector('.sura');
        if (!sura) return;

        // Quick swipe threshold: 80px OR fast flick (>0.4 px/ms)
        var velocity = Math.abs(dx) / Math.max(dt, 1);
        var isSwipe = wasTracking && (Math.abs(dx) > 80 || velocity > 0.4);
        var isHorizontal = Math.abs(dy) < 100;

        if (!isSwipe || !isHorizontal) {
            // Bounce back to original position
            sura.style.transition = 'transform 0.25s cubic-bezier(.4,0,.2,1), opacity 0.25s';
            sura.style.transform = '';
            sura.style.opacity = '';
            return;
        }

        var i = parseInt(sura.id);
        var nextIdx;
        var direction;
        if (dx < 0 && i < 113) {
            nextIdx = i + 1;
            direction = -1; // slide out to left
        } else if (dx > 0 && i > 0) {
            nextIdx = i - 1;
            direction = 1; // slide out to right
        } else {
            // Edge case (first or last surah) — bounce back
            sura.style.transition = 'transform 0.25s cubic-bezier(.4,0,.2,1), opacity 0.25s';
            sura.style.transform = '';
            sura.style.opacity = '';
            return;
        }

        // Animate current sura sliding off-screen, then load next
        var screenWidth = window.innerWidth;
        sura.style.transition = 'transform 0.22s cubic-bezier(.4,0,.2,1), opacity 0.22s';
        sura.style.transform = 'translateX(' + (direction * screenWidth) + 'px)';
        sura.style.opacity = '0';

        setTimeout(function() {
            // v9.12: Render new sura, then IMMEDIATELY (same frame) set its
            // initial transform before the browser paints — no flicker
            displaySingleSura(nextIdx);
            hapticTap(20);
            var newSura = document.querySelector('.sura');
            if (!newSura) return;
            // Set off-screen position synchronously (no transition)
            newSura.style.transition = 'none';
            newSura.style.transform = 'translateX(' + (-direction * screenWidth) + 'px)';
            newSura.style.opacity = '0';
            // Force reflow so the next style changes are independent
            void newSura.offsetWidth;
            // Animate in via rAF (next frame after the off-screen state is committed)
            requestAnimationFrame(function() {
                newSura.style.transition = 'transform 0.28s cubic-bezier(.25,.46,.45,.94), opacity 0.28s';
                newSura.style.transform = '';
                newSura.style.opacity = '';
            });
        }, 200);
    });

    document.addEventListener('touchcancel', function() {
        startX = null;
        tracking = false;
        var sura = document.querySelector('.sura');
        if (sura) {
            sura.style.transition = 'transform 0.25s';
            sura.style.transform = '';
            sura.style.opacity = '';
        }
    });
}());

// ═══════════════════════════════════════════════════════════════════
// #21 — Pull-to-refresh (mobile, refreshes last-read state)
// ═══════════════════════════════════════════════════════════════════
(function pullToRefresh() {
    var startY = 0;
    var pulling = false;
    var pullDist = 0;
    var indicator = null;

    document.addEventListener('touchstart', function(e) {
        // v10.9: Always on (no toggle) — natural gesture, no reason to disable
        if (window.innerWidth > 900) return;
        // Don't activate when any modal/settings overlay is open
        if (document.querySelector('.mob-info-overlay.show')) return;
        var container = document.getElementById('quranContainer');
        if (!container) return;
        if (container.scrollTop > 0) return;
        if (e.touches.length !== 1) return;
        startY = e.touches[0].clientY;
        pulling = true;
        pullDist = 0;
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!pulling) return;
        var dy = e.touches[0].clientY - startY;
        if (dy < 0) { pulling = false; return; }
        if (dy > 200) dy = 200;
        pullDist = dy;
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'pullIndicator';
            indicator.className = 'pull-indicator';
            document.body.appendChild(indicator);
        }
        indicator.style.opacity = Math.min(1, dy / 80);
        indicator.style.transform = 'translate(-50%, ' + (dy / 2) + 'px)';
        indicator.textContent = dy > 80 ? '↓ Release to refresh' : '↓ Pull to refresh';
    }, { passive: true });

    document.addEventListener('touchend', function() {
        if (!pulling) return;
        pulling = false;
        if (pullDist > 80) {
            // Refresh: re-render TOC + last-read banner
            try { sessionStorage.removeItem('lrbDismissed'); } catch(e) {}
            if (typeof generateTOC === 'function' && activeTocTab === 'surah') generateTOC();
            showLastReadBanner();
            showToast('↻ Refreshed');
            hapticTap(20);
        }
        if (indicator) {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translate(-50%, 0)';
        }
    });
}());

// ═══════════════════════════════════════════════════════════════════
// #7 — Notes export / import + #12 bookmark tags
// We'll inject these UI controls into the settings sheet and desktop
// ═══════════════════════════════════════════════════════════════════
function exportAllData() {
    var data = {
        version:      'v9.9',
        exportedAt:   new Date().toISOString(),
        bookmarks:    JSON.parse(localStorage.getItem('quranBookmarks') || '[]'),
        notes:        JSON.parse(localStorage.getItem('quranNotes') || '{}'),
        highlights:   JSON.parse(localStorage.getItem('quranHighlights') || '{}'),
        history:      JSON.parse(localStorage.getItem('quranReadHistory') || '{}'),
        searchHx:     JSON.parse(localStorage.getItem('quranSearchHx') || '[]'),
        khatm:        JSON.parse(localStorage.getItem('quranKhatm') || '{}'),
        bookmarkTags: JSON.parse(localStorage.getItem('quranBookmarkTags') || '{}')
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'quran-app-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('💾 Backup downloaded');
}

function importAllData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            if (typeof showConfirm === 'function') {
                showConfirm('Import data?', 'This will replace your current bookmarks, notes, highlights, and history. Continue?', function() {
                    if (data.bookmarks)    localStorage.setItem('quranBookmarks',    JSON.stringify(data.bookmarks));
                    if (data.notes)        localStorage.setItem('quranNotes',        JSON.stringify(data.notes));
                    if (data.highlights)   localStorage.setItem('quranHighlights',   JSON.stringify(data.highlights));
                    if (data.history)      localStorage.setItem('quranReadHistory',  JSON.stringify(data.history));
                    if (data.searchHx)     localStorage.setItem('quranSearchHx',     JSON.stringify(data.searchHx));
                    if (data.khatm)        localStorage.setItem('quranKhatm',        JSON.stringify(data.khatm));
                    if (data.bookmarkTags) localStorage.setItem('quranBookmarkTags', JSON.stringify(data.bookmarkTags));
                    showToast('✓ Data imported');
                    setTimeout(function() { location.reload(); }, 800);
                });
            }
        } catch (err) {
            showToast('✗ Invalid backup file');
        }
    };
    reader.readAsText(file);
}

// ═══════════════════════════════════════════════════════════════════
// #12 — Bookmark tags
// ═══════════════════════════════════════════════════════════════════
function getBookmarkTags() {
    try { return JSON.parse(localStorage.getItem('quranBookmarkTags') || '{}'); }
    catch(e) { return {}; }
}
function setBookmarkTag(key, tag) {
    var tags = getBookmarkTags();
    if (tag) tags[key] = tag; else delete tags[key];
    localStorage.setItem('quranBookmarkTags', JSON.stringify(tags));
}
function getAllUsedTags() {
    var tags = getBookmarkTags();
    var set = {};
    Object.values(tags).forEach(function(t) { if (t) set[t] = true; });
    return Object.keys(set).sort();
}

// ═══════════════════════════════════════════════════════════════════
// #13 — Khatm (completion) tracker
// ═══════════════════════════════════════════════════════════════════
function getKhatmData() {
    try { return JSON.parse(localStorage.getItem('quranKhatm') || '{"completions":[],"daily":{}}'); }
    catch(e) { return { completions: [], daily: {} }; }
}
function saveKhatmData(d) { localStorage.setItem('quranKhatm', JSON.stringify(d)); }

function recordDailyReading() {
    if (!isFeatureOn('khatmTracker')) return;
    var k = getKhatmData();
    var today = new Date().toISOString().slice(0, 10);
    k.daily[today] = (k.daily[today] || 0) + 1;
    saveKhatmData(k);
}

function recordKhatmCompletion() {
    var k = getKhatmData();
    k.completions.push(new Date().toISOString());
    saveKhatmData(k);
    track('khatm_completed', { total_completions: k.completions.length });
    showToast('🎉 Khatm completed!');
}

function buildKhatmHeatmap() {
    if (!isFeatureOn('khatmTracker')) return null;
    var k = getKhatmData();
    var wrap = document.createElement('div');
    wrap.className = 'khatm-heatmap khatm-calendar';

    var title = document.createElement('div');
    title.className = 'khatm-title';
    title.innerHTML = '<span>Reading activity</span><span class="khatm-completions">' + k.completions.length + ' khatm</span>';
    wrap.appendChild(title);

    // Build last 3 months as calendar grids
    var monthsWrap = document.createElement('div');
    monthsWrap.className = 'khatm-months';
    var today = new Date();
    var todayKey = today.toISOString().slice(0, 10);

    // Show last 3 months (current + 2 prior), skip months with no reading activity
    var monthsToShow = [];
    for (var m = 2; m >= 0; m--) {
        var d = new Date(today.getFullYear(), today.getMonth() - m, 1);
        var isCurrentMonth = (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth());
        if (isCurrentMonth) {
            monthsToShow.push(d);
        } else {
            // Only include if there's at least one day of activity
            var yr = d.getFullYear(), mn = d.getMonth();
            var daysInMn = new Date(yr, mn + 1, 0).getDate();
            var hasActivity = false;
            for (var dd = 1; dd <= daysInMn; dd++) {
                var key = new Date(yr, mn, dd).toISOString().slice(0, 10);
                if (k.daily[key]) { hasActivity = true; break; }
            }
            if (hasActivity) monthsToShow.push(d);
        }
    }

    var MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    var DAY_LABELS = ['M','T','W','T','F','S','S'];

    monthsToShow.forEach(function(monthStart) {
        var monthBox = document.createElement('div');
        monthBox.className = 'khatm-month';
        var year = monthStart.getFullYear();
        var month = monthStart.getMonth();
        var label = document.createElement('div');
        label.className = 'khatm-month-label';
        label.textContent = MONTH_NAMES[month] + ' ' + year;
        monthBox.appendChild(label);

        // Day-of-week header
        var dowRow = document.createElement('div');
        dowRow.className = 'khatm-dow';
        DAY_LABELS.forEach(function(l) {
            var c = document.createElement('span'); c.textContent = l; dowRow.appendChild(c);
        });
        monthBox.appendChild(dowRow);

        // Grid: pad leading days for week start (Monday)
        var grid = document.createElement('div');
        grid.className = 'khatm-grid';
        var firstDay = new Date(year, month, 1);
        var firstDow = (firstDay.getDay() + 6) % 7; // Mon=0..Sun=6
        for (var i = 0; i < firstDow; i++) {
            var pad = document.createElement('div');
            pad.className = 'khatm-cell khatm-pad';
            grid.appendChild(pad);
        }
        // Number of days in this month
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        for (var day = 1; day <= daysInMonth; day++) {
            var cell = document.createElement('div');
            var dateObj = new Date(year, month, day);
            var key = dateObj.toISOString().slice(0, 10);
            var count = k.daily[key] || 0;
            cell.className = 'khatm-cell';
            cell.setAttribute('data-level', count === 0 ? '0' : count < 3 ? '1' : count < 6 ? '2' : count < 10 ? '3' : '4');
            cell.setAttribute('data-date', key);
            cell.setAttribute('data-count', count);
            cell.textContent = day;
            if (key === todayKey) cell.classList.add('khatm-today');
            if (dateObj > today) cell.classList.add('khatm-future');
            cell.addEventListener('click', function(e) {
                e.stopPropagation();
                showKhatmCellDetail(this);
            });
            grid.appendChild(cell);
        }
        monthBox.appendChild(grid);
        monthsWrap.appendChild(monthBox);
    });
    wrap.appendChild(monthsWrap);

    // Detail banner — appears when a cell is tapped
    var detail = document.createElement('div');
    detail.className = 'khatm-detail';
    detail.id = 'khatmDetailBanner';
    detail.innerHTML = '<span class="khatm-detail-icon">📅</span><span class="khatm-detail-text">Tap any day to see details</span>';
    wrap.appendChild(detail);

    // Legend with contrasting boxes
    var legend = document.createElement('div');
    legend.className = 'khatm-legend';
    legend.innerHTML =
        '<span class="khatm-legend-label">Less</span>' +
        '<span class="kl" data-level="0"></span>' +
        '<span class="kl" data-level="1"></span>' +
        '<span class="kl" data-level="2"></span>' +
        '<span class="kl" data-level="3"></span>' +
        '<span class="kl" data-level="4"></span>' +
        '<span class="khatm-legend-label">More</span>';
    wrap.appendChild(legend);

    return wrap;
}

// v10.4: Show the date + count for a tapped cell
function showKhatmCellDetail(cell) {
    // Find banner in the same heatmap (avoids conflict when multiple instances exist)
    var heatmap = cell.closest('.khatm-heatmap') || cell.closest('.khatm-calendar');
    var banner = heatmap ? heatmap.querySelector('.khatm-detail') : document.getElementById('khatmDetailBanner');
    if (!banner) return;
    var date = cell.getAttribute('data-date');
    var count = parseInt(cell.getAttribute('data-count')) || 0;
    var d = new Date(date + 'T00:00:00');
    var formatted = d.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    var msg;
    if (cell.classList.contains('khatm-future')) {
        msg = formatted + ' · upcoming';
    } else if (count === 0) {
        msg = formatted + ' · no reading';
    } else {
        msg = formatted + ' · ' + count + ' surah' + (count === 1 ? '' : 's') + ' opened';
    }
    banner.innerHTML = '<span class="khatm-detail-icon">📅</span><span class="khatm-detail-text">' + msg + '</span>';
    // Highlight selected cell — scope to this heatmap instance
    var scope = heatmap || document;
    scope.querySelectorAll('.khatm-cell.khatm-selected').forEach(function(c) {
        c.classList.remove('khatm-selected');
    });
    cell.classList.add('khatm-selected');
}

// ── v10: Reading streak — counts consecutive days with at least 1 read ──
function getCurrentReadingStreak() {
    if (!isFeatureOn('khatmTracker')) return 0;
    var k = getKhatmData();
    var streak = 0;
    var d = new Date();
    // Count today + walk back day-by-day until we miss
    for (var i = 0; i < 365; i++) {
        var key = d.toISOString().slice(0, 10);
        if (k.daily[key]) {
            streak++;
        } else {
            // First day allowed to be missing (haven't read today yet but yesterday counts)
            if (i === 0 && streak === 0) {
                d.setDate(d.getDate() - 1);
                continue;
            }
            break;
        }
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

// ── v10: Toggle inline heatmap (drops down under the sticky title) ──
function toggleInlineHeatmap(suraWrapper) {
    var existing = suraWrapper.querySelector('.inline-heatmap-box');
    if (existing) {
        existing.remove();
        return;
    }
    var box = document.createElement('div');
    box.className = 'inline-heatmap-box';
    var heatmap = buildKhatmHeatmap();
    if (heatmap) box.appendChild(heatmap);
    var sticky = suraWrapper.querySelector('.sura-sticky-title');
    if (sticky && sticky.nextSibling) {
        suraWrapper.insertBefore(box, sticky.nextSibling);
    } else {
        suraWrapper.appendChild(box);
    }
    // Animate in
    box.style.maxHeight = '0';
    requestAnimationFrame(function() {
        box.style.maxHeight = box.scrollHeight + 'px';
    });
    // Auto-collapse on outside click
    setTimeout(function() {
        document.addEventListener('click', function dismiss(e) {
            if (e.target.closest('.inline-heatmap-box') || e.target.closest('.sura-streak-pill')) return;
            box.remove();
            document.removeEventListener('click', dismiss);
        });
    }, 100);
}

// ── v10: Programmatic focus mode entry (replaces old toggle in some paths) ──
function enterFocusMode() {
    if (!isFeatureOn('focusMode')) {
        // Auto-enable for the user since they obviously want it
        var current = getFeatures();
        current.focusMode = true;
        saveFeatures(current);
    }
    document.body.classList.add('focus-mode');
    window._focusModeActivatedAt = Date.now();
    hapticTap(15);
}

// ═══════════════════════════════════════════════════════════════════
// #17 — Arabic font choice
// ═══════════════════════════════════════════════════════════════════
const ARABIC_FONTS = {
    amiri:       { label: 'Amiri (default)', css: "'Amiri', serif" },
    scheherazade:{ label: 'Scheherazade',     css: "'Scheherazade New', serif" },
    notoNaskh:   { label: 'Noto Naskh',       css: "'Noto Naskh Arabic', serif" },
    lateef:      { label: 'Lateef',           css: "'Lateef', serif" }
};

function applyArabicFont(key) {
    var font = ARABIC_FONTS[key] || ARABIC_FONTS.amiri;
    document.documentElement.style.setProperty('--font-arabic', font.css);
    try { localStorage.setItem('quranArabicFont', key); } catch(e) {}
}

function loadArabicFontChoice() {
    // Add Google Fonts <link> if not already present
    if (!document.getElementById('arabicFontsLink')) {
        var link = document.createElement('link');
        link.id = 'arabicFontsLink';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Scheherazade+New:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&family=Lateef:wght@400;700&display=swap';
        document.head.appendChild(link);
    }
    var saved = localStorage.getItem('quranArabicFont');
    if (saved && ARABIC_FONTS[saved]) applyArabicFont(saved);
}

// ═══════════════════════════════════════════════════════════════════
// Settings sheet — extended Features section
// We hook into the existing buildSheetSettings via monkey-patch
// ═══════════════════════════════════════════════════════════════════
(function extendSettings() {
    if (typeof buildSheetSettings === 'undefined') return;
    var orig = buildSheetSettings;
    window.buildSheetSettings = buildSheetSettings = function(body, title) {
        orig(body, title);
        appendFeaturesUI(body);
        appendFocusModeButton(body);
        if (window.innerWidth > 767) appendKhatmUI(body);
        // v10.10: appendDataUI moved to a final injection layer (always last)
    };
}());

function appendFeaturesUI(body) {
    var f = getFeatures();

    function makeToggleRow(key, label, sub) {
        var row = document.createElement('label');
        row.className = 'feature-toggle-row';
        var labelWrap = document.createElement('span');
        labelWrap.className = 'feature-toggle-lbl-wrap';
        var span = document.createElement('span');
        span.className = 'feature-toggle-lbl';
        span.textContent = label;
        var subEl = document.createElement('span');
        subEl.className = 'feature-toggle-sub';
        subEl.textContent = sub;
        labelWrap.appendChild(span);
        labelWrap.appendChild(subEl);
        var swWrap = document.createElement('span');
        swWrap.className = 'feature-toggle-sw';
        var inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.checked = f[key];
        inp.addEventListener('change', function() {
            var current = getFeatures();
            current[key] = this.checked;
            saveFeatures(current);
            if (key === 'autoDarkTheme' && this.checked) applyAutoTheme();
            if (key === 'verseNavigation') {
                if (this.checked) buildVerseNav();
                else { var v = document.getElementById('verseNavFab'); if (v) v.remove(); }
            }
            if (key === 'lastReadBanner') {
                if (this.checked) showLastReadBanner();
                else { var b = document.getElementById('lastReadBanner'); if (b) b.remove(); }
            }
            if (key === 'arabicFontChoice') loadArabicFontChoice();
            if (key === 'tafsir' && !this.checked) {
                if (typeof closeTafsirModal === 'function') closeTafsirModal();
            }
            if (key === 'hijriAwareness') {
                var existing = document.querySelector('.hijri-badge');
                if (existing) existing.remove();
                if (this.checked && typeof appendHijriBadge === 'function') {
                    setTimeout(appendHijriBadge, 100);
                }
            }
            if (key === 'voiceSearch') {
                if (this.checked && typeof attachVoiceSearchButton === 'function') {
                    ['search-input', 'mob-search-input'].forEach(function(id) {
                        var el = document.getElementById(id);
                        if (el) { delete el._voiceAttached; attachVoiceSearchButton(el); }
                    });
                } else {
                    document.querySelectorAll('.voice-search-btn').forEach(function(b){ b.remove(); });
                    ['search-input', 'mob-search-input'].forEach(function(id) {
                        var el = document.getElementById(id);
                        if (el) delete el._voiceAttached;
                    });
                }
            }
            if (key === 'verseComparison' && !this.checked) {
                if (typeof closeTafsirCompare === 'function') closeTafsirCompare();
            }
            track('feature_toggled', { feature: key, state: this.checked ? 'on' : 'off' });
            showToast(this.checked ? '✓ Enabled' : '✗ Disabled');
            hapticTap(10);
        });
        var slider = document.createElement('span');
        slider.className = 'feature-toggle-slider';
        swWrap.appendChild(inp);
        swWrap.appendChild(slider);
        row.appendChild(labelWrap);
        row.appendChild(swWrap);
        return row;
    }

    function makeSection(title, helpKey) {
        var sec = document.createElement('div');
        sec.className = 'mob-settings-section';
        var lbl = document.createElement('div');
        lbl.className = 'mob-settings-lbl';
        var titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        lbl.appendChild(titleSpan);
        var helpUrl = helpKey && HELP_VIDEOS[helpKey];
        if (helpUrl) {
            var helpBtn = document.createElement('button');
            helpBtn.className = 'section-help-btn';
            helpBtn.title = 'Watch tutorial on YouTube';
            helpBtn.textContent = 'ℹ️';
            helpBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                window.open(helpUrl, '_blank');
            });
            lbl.appendChild(helpBtn);
        }
        sec.appendChild(lbl);
        return sec;
    }

    // 📖 Reading
    var readSec = makeSection('📖 Reading', 'reading');

    // Notification card — prominent, first in Reading
    var notifLabel = document.createElement('div');
    notifLabel.className = 'notif-settings-section-label';
    notifLabel.textContent = 'Notifications';
    readSec.appendChild(notifLabel);

    var isNotifOn = !!f['dailyVerseNotification'];
    var savedHour = 8;
    try { var _sh = localStorage.getItem(PUSH_NOTIF_HOUR_KEY); if (_sh !== null) savedHour = parseInt(_sh); } catch(e) {}
    function _fmtHour(h) { var p = h >= 12 ? 'PM' : 'AM'; return (h % 12 || 12) + ':00 ' + p; }

    var notifCard = document.createElement('div');
    notifCard.className = 'notif-settings-card' + (isNotifOn ? '' : ' notif-off');

    var notifTop = document.createElement('div');
    notifTop.className = 'notif-settings-card-top';
    var notifTitle = document.createElement('div');
    notifTitle.className = 'notif-settings-card-title';
    notifTitle.textContent = '🔔 Daily verse notification';
    var notifSwWrap = document.createElement('span');
    notifSwWrap.className = 'feature-toggle-sw';
    var notifInp = document.createElement('input');
    notifInp.type = 'checkbox';
    notifInp.checked = isNotifOn;
    var notifSlider = document.createElement('span');
    notifSlider.className = 'feature-toggle-slider';
    notifSwWrap.appendChild(notifInp);
    notifSwWrap.appendChild(notifSlider);
    notifTop.appendChild(notifTitle);
    notifTop.appendChild(notifSwWrap);
    notifCard.appendChild(notifTop);

    var notifTimeRow = document.createElement('div');
    notifTimeRow.className = 'notif-settings-time-row';
    notifTimeRow.style.display = isNotifOn ? '' : 'none';
    var notifTimeLbl = document.createElement('div');
    notifTimeLbl.className = 'notif-settings-time-lbl';
    notifTimeLbl.textContent = '⏰ Time of notification';
    var notifTimeChip = document.createElement('div');
    notifTimeChip.className = 'notif-settings-time-chip';
    var notifTimeVal = document.createElement('span');
    notifTimeVal.textContent = _fmtHour(savedHour);
    notifTimeChip.appendChild(notifTimeVal);
    notifTimeChip.insertAdjacentHTML('beforeend', ' <span style="font-size:10px;opacity:0.6">✏️</span>');
    notifTimeChip.addEventListener('click', function() {
        showNotifTimePicker(function(newHour) {
            notifTimeVal.textContent = _fmtHour(newHour);
            if (typeof doSubscribe === 'function') doSubscribe(newHour);
            showToast('✓ Notification time updated');
        });
    });
    notifTimeRow.appendChild(notifTimeLbl);
    notifTimeRow.appendChild(notifTimeChip);
    notifCard.appendChild(notifTimeRow);

    notifInp.addEventListener('change', function() {
        var current = getFeatures();
        current['dailyVerseNotification'] = this.checked;
        saveFeatures(current);
        notifCard.classList.toggle('notif-off', !this.checked);
        notifTimeRow.style.display = this.checked ? '' : 'none';
        if (this.checked) {
            setupDailyVerseNotification(false);
        } else {
            teardownDailyVerseNotification();
        }
        track('feature_toggled', { feature: 'dailyVerseNotification', state: this.checked ? 'on' : 'off' });
        hapticTap(10);
    });

    readSec.appendChild(notifCard);

    var notifDivider = document.createElement('div');
    notifDivider.className = 'notif-settings-divider';
    readSec.appendChild(notifDivider);

    readSec.appendChild(makeToggleRow('lastReadBanner',  '📍 "Continue reading" banner', 'Shows previously-read surah at top so you can jump back'));
    readSec.appendChild(makeToggleRow('verseNavigation', '⇆ Verse navigation buttons',   'Floating prev / next / jump-to-verse buttons'));
    readSec.appendChild(makeToggleRow('dailyVerse',      '🌅 Daily verse',                'A contemplative verse shown once per day on open'));
    readSec.appendChild(makeToggleRow('focusMode',       '🧘 Focus mode',                 'Hides everything except verses (key: F)'));
    body.appendChild(readSec);

    // 🔍 Search
    var searchSec = makeSection('🔍 Search', 'search');
    if (window.innerWidth > 900) {
        searchSec.appendChild(makeToggleRow('searchAsYouType', '⚡ Search as you type', 'Auto-runs search 350ms after you stop typing'));
    }
    searchSec.appendChild(makeToggleRow('voiceSearch',     '🎤 Voice search',       'Tap the mic to speak a search query'));
    body.appendChild(searchSec);

    // 📚 Study
    var studySec = makeSection('📚 Study', 'study');
    studySec.appendChild(makeToggleRow('tafsir',            '📚 Tafsir (commentary)',  'Tap a verse to read classical commentary · needs internet'));
    studySec.appendChild(makeToggleRow('verseComparison',   '🔀 Compare tafsirs',      'Adds "Compare all" button in the tafsir modal'));
    studySec.appendChild(makeToggleRow('reflectionPrompts', '✍️ Reflection prompts',   'Optional reflection question after finishing a surah'));
    studySec.appendChild(makeToggleRow('khatmTracker',      '🎯 Khatm tracker',        'Daily reading heatmap + completion count'));
    body.appendChild(studySec);

    // ▸ Advanced (collapsed by default)
    var advSec = document.createElement('div');
    advSec.className = 'mob-settings-section';
    var advHeader = document.createElement('div');
    advHeader.className = 'settings-collapsible-header';
    var advTitle = document.createElement('div');
    advTitle.className = 'mob-settings-lbl';
    var advTitleSpan = document.createElement('span');
    advTitleSpan.textContent = '⚙ Advanced';
    advTitle.appendChild(advTitleSpan);
    if (HELP_VIDEOS.advanced) {
        var advHelpBtn = document.createElement('button');
        advHelpBtn.className = 'section-help-btn';
        advHelpBtn.title = 'Watch tutorial on YouTube';
        advHelpBtn.textContent = 'ℹ️';
        advHelpBtn.addEventListener('click', function(e) { e.stopPropagation(); window.open(HELP_VIDEOS.advanced, '_blank'); });
        advTitle.appendChild(advHelpBtn);
    }
    var advArrow = document.createElement('span');
    advArrow.className = 'settings-collapsible-arrow';
    advArrow.textContent = '▾';
    advHeader.appendChild(advTitle);
    advHeader.appendChild(advArrow);
    var advContent = document.createElement('div');
    advContent.className = 'settings-collapsible-content';
    advContent.style.display = 'none';
    advHeader.addEventListener('click', function() {
        var isOpen = advContent.style.display !== 'none';
        advContent.style.display = isOpen ? 'none' : '';
        advArrow.textContent = isOpen ? '▾' : '▴';
    });

    advContent.appendChild(makeToggleRow('autoDarkTheme',      '🌗 Auto dark theme',         'Switches to Scholar after 7pm, Manuscript before'));
    advContent.appendChild(makeToggleRow('browserLangDefault', '🌐 Browser language default', 'Picks French/English/Spanish/Arabic from device'));
    advContent.appendChild(makeToggleRow('pdfExport',          '🖨 Print / PDF export',       'Print the current surah with your notes'));

    // Arabic font picker (inside Advanced)
    var fontSec = document.createElement('div');
    fontSec.className = 'feature-sub-row';
    var fontLbl = document.createElement('div');
    fontLbl.className = 'feature-sub-lbl';
    fontLbl.textContent = '🔤 Arabic font';
    fontSec.appendChild(fontLbl);
    var fontSel = document.createElement('select');
    fontSel.className = 'mob-settings-select';
    Object.keys(ARABIC_FONTS).forEach(function(k) {
        var opt = document.createElement('option');
        opt.value = k;
        opt.textContent = ARABIC_FONTS[k].label;
        fontSel.appendChild(opt);
    });
    fontSel.value = localStorage.getItem('quranArabicFont') || 'amiri';
    fontSel.addEventListener('change', function() {
        track('arabic_font_changed', { font: this.value });
        applyArabicFont(this.value);
    });
    fontSec.appendChild(fontSel);
    advContent.appendChild(fontSec);

    // Analytics toggle (inside Advanced — inverted logic: toggle ON = tracking ON)
    var analyticsDescriptions = {
        arabic:  'مشاركة إحصاءات الاستخدام المجهولة لتحسين التطبيق (لا بيانات شخصية)',
        french:  'Partager des statistiques d\'utilisation anonymes pour améliorer l\'application (sans données personnelles)',
        english: 'Share anonymous usage stats to help improve the app (no personal data)',
        spanish: 'Compartir estadísticas de uso anónimas para mejorar la aplicación (sin datos personales)'
    };
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    var analyticsRow = document.createElement('label');
    analyticsRow.className = 'feature-toggle-row';
    var analyticsLblWrap = document.createElement('span');
    analyticsLblWrap.className = 'feature-toggle-lbl-wrap';
    var analyticsSpan = document.createElement('span');
    analyticsSpan.className = 'feature-toggle-lbl';
    analyticsSpan.textContent = '📊 Anonymous usage stats';
    var analyticsSub = document.createElement('span');
    analyticsSub.className = 'feature-toggle-sub';
    analyticsSub.textContent = analyticsDescriptions[lang] || analyticsDescriptions.english;
    analyticsLblWrap.appendChild(analyticsSpan);
    analyticsLblWrap.appendChild(analyticsSub);
    var analyticsSwWrap = document.createElement('span');
    analyticsSwWrap.className = 'feature-toggle-sw';
    var analyticsInp = document.createElement('input');
    analyticsInp.type = 'checkbox';
    analyticsInp.checked = !isFeatureOn('analyticsOptOut');
    analyticsInp.addEventListener('change', function() {
        var current = getFeatures();
        current.analyticsOptOut = !this.checked;
        saveFeatures(current);
        showToast(this.checked ? '✓ Usage stats ON' : '✗ Usage stats OFF');
        hapticTap(10);
    });
    var analyticsSlider = document.createElement('span');
    analyticsSlider.className = 'feature-toggle-slider';
    analyticsSwWrap.appendChild(analyticsInp);
    analyticsSwWrap.appendChild(analyticsSlider);
    analyticsRow.appendChild(analyticsLblWrap);
    analyticsRow.appendChild(analyticsSwWrap);
    advContent.appendChild(analyticsRow);

    advSec.appendChild(advHeader);
    advSec.appendChild(advContent);
    advSec.setAttribute('data-adv-section', '1');
    body.appendChild(advSec);
    // Note: finalSettingsCleanup moves this to just before Data & Privacy
}

function appendDataUI(body) {
    // Move Advanced section to sit immediately before Data & Privacy
    var advEl = body.querySelector('[data-adv-section]');
    if (advEl) body.appendChild(advEl);

    var outerSec = document.createElement('div');
    outerSec.className = 'mob-settings-section';

    var header = document.createElement('div');
    header.className = 'settings-collapsible-header';
    var headerTitle = document.createElement('div');
    headerTitle.className = 'mob-settings-lbl';
    var headerTitleSpan = document.createElement('span');
    headerTitleSpan.textContent = '🔒 Data & Privacy';
    headerTitle.appendChild(headerTitleSpan);
    if (HELP_VIDEOS.privacy) {
        var privHelpBtn = document.createElement('button');
        privHelpBtn.className = 'section-help-btn';
        privHelpBtn.title = 'Watch tutorial on YouTube';
        privHelpBtn.textContent = 'ℹ️';
        privHelpBtn.addEventListener('click', function(e) { e.stopPropagation(); window.open(HELP_VIDEOS.privacy, '_blank'); });
        headerTitle.appendChild(privHelpBtn);
    }
    var headerArrow = document.createElement('span');
    headerArrow.className = 'settings-collapsible-arrow';
    headerArrow.textContent = '▾';
    header.appendChild(headerTitle);
    header.appendChild(headerArrow);

    var content = document.createElement('div');
    content.className = 'settings-collapsible-content';
    content.style.display = 'none';

    header.addEventListener('click', function() {
        var isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : '';
        headerArrow.textContent = isOpen ? '▾' : '▴';
    });

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-bottom:8px;opacity:0.85;line-height:1.4;';
    hint.textContent = 'Saves all your notes, bookmarks, highlights, and reading history as a JSON file.';
    content.appendChild(hint);

    var exp = document.createElement('button');
    exp.className = 'mob-settings-btn';
    exp.textContent = '💾 Export notes & bookmarks (JSON)';
    exp.addEventListener('click', exportAllData);
    content.appendChild(exp);

    var impLbl = document.createElement('label');
    impLbl.className = 'mob-settings-btn';
    impLbl.style.cursor = 'pointer';
    impLbl.style.display = 'block';
    impLbl.textContent = '📥 Restore from JSON file';
    var impInp = document.createElement('input');
    impInp.type = 'file';
    impInp.accept = 'application/json';
    impInp.style.display = 'none';
    impInp.addEventListener('change', function() {
        if (this.files && this.files[0]) importAllData(this.files[0]);
    });
    impLbl.appendChild(impInp);
    content.appendChild(impLbl);

    outerSec.appendChild(header);
    outerSec.appendChild(content);
    body.appendChild(outerSec);
}

function appendFocusModeButton(body) {
    if (!isFeatureOn('focusMode')) return;
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Reading mode';
    sec.appendChild(lbl);

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-bottom:8px;opacity:0.85;line-height:1.4;';
    hint.textContent = 'Hides everything except the verses. Tap the screen to bring back controls.';
    sec.appendChild(hint);

    var btn = document.createElement('button');
    btn.className = 'mob-settings-btn';
    btn.textContent = '🧘 Enter focus mode';
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof closeMobileSheet === 'function') closeMobileSheet();
        // v9.11: Delay activation so this same click doesn't trigger the
        // tap-to-exit listener bubbling up to document
        setTimeout(function() {
            document.body.classList.add('focus-mode');
            window._focusModeActivatedAt = Date.now();
            hapticTap(15);
        }, 350);
    });
    sec.appendChild(btn);

    body.appendChild(sec);
}

function appendKhatmUI(body) {
    if (!isFeatureOn('khatmTracker')) return;
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Khatm tracker';
    sec.appendChild(lbl);

    // v10.3: Explanatory hint so users understand what this is
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-primary);margin-bottom:10px;opacity:0.78;line-height:1.5;';
    hint.innerHTML =
        '<strong>Khatm</strong> (ختم) means completing a full reading of the Quran. ' +
        'The heatmap shows your daily reading activity — darker squares mean more surahs opened that day. ' +
        'When you finish the entire Quran, tap "Mark Khatm" to log a completion.';
    sec.appendChild(hint);

    // Heatmap — or empty-state hint if no activity yet
    var k = getKhatmData();
    var dailyKeys = Object.keys(k.daily || {});
    if (dailyKeys.length === 0) {
        var emptyState = document.createElement('div');
        emptyState.style.cssText = 'padding:18px 14px;text-align:center;background:var(--accent-trace);border-radius:8px;font-size:12px;color:var(--text-primary);opacity:0.7;font-style:italic;margin-bottom:10px;';
        emptyState.textContent = '📖 Read your first surah to see activity here.';
        sec.appendChild(emptyState);
    } else {
        var heatmap = buildKhatmHeatmap();
        if (heatmap) sec.appendChild(heatmap);
    }

    // Streak summary line
    if (typeof getCurrentReadingStreak === 'function') {
        var streak = getCurrentReadingStreak();
        if (streak > 0) {
            var streakLine = document.createElement('div');
            streakLine.style.cssText = 'font-size:12px;color:var(--accent);margin:8px 0 12px;text-align:center;font-weight:600;';
            streakLine.innerHTML = '🔥 Current streak: ' + streak + ' day' + (streak === 1 ? '' : 's');
            sec.appendChild(streakLine);
        }
    }

    // Mark Khatm button
    var btn = document.createElement('button');
    btn.className = 'mob-settings-btn';
    btn.textContent = '🎉 Mark Khatm as completed';
    btn.addEventListener('click', function() {
        if (typeof showConfirm === 'function') {
            showConfirm('Mark Khatm complete?', 'Log that you have finished a full reading of the Quran. This will be recorded with today\'s date.', function() {
                recordKhatmCompletion();
                // Refresh the settings UI to show new completion count
                if (document.getElementById('featuresModal') && document.getElementById('featuresModal').classList.contains('show')) {
                    if (typeof openFeaturesModal === 'function') openFeaturesModal();
                }
            });
        } else {
            recordKhatmCompletion();
        }
    });
    sec.appendChild(btn);

    // v10.3: Reset button — danger-styled
    var resetBtn = document.createElement('button');
    resetBtn.className = 'mob-settings-btn';
    resetBtn.style.cssText = 'margin-top:8px;background:#d9707018;border-color:#d9707040;color:#e08585;';
    resetBtn.textContent = '🗑 Reset tracker';
    resetBtn.addEventListener('click', function() {
        var data = getKhatmData();
        var dCount = Object.keys(data.daily || {}).length;
        var cCount = (data.completions || []).length;
        var msg = 'This will erase your reading activity (' + dCount + ' day' + (dCount === 1 ? '' : 's') +
                  ') and Khatm completions (' + cCount + '). This cannot be undone.';
        if (typeof showConfirm === 'function') {
            showConfirm('Reset Khatm tracker?', msg, function() {
                try { localStorage.removeItem('quranKhatm'); } catch(e) {}
                showToast('Tracker reset');
                if (document.getElementById('featuresModal') && document.getElementById('featuresModal').classList.contains('show')) {
                    if (typeof openFeaturesModal === 'function') openFeaturesModal();
                }
            });
        } else if (confirm(msg)) {
            try { localStorage.removeItem('quranKhatm'); } catch(e) {}
            showToast('Tracker reset');
        }
    });
    sec.appendChild(resetBtn);

    body.appendChild(sec);
}

// ═══════════════════════════════════════════════════════════════════
// Initial wiring on DOM ready
// ═══════════════════════════════════════════════════════════════════
function initFeatures() {
    loadArabicFontChoice();
    applyAutoTheme();
    applyBrowserLangDefault();
    // v10.4: Show install banner immediately on iOS (which doesn't fire beforeinstallprompt)
    setTimeout(function() {
        if (typeof updateInstallPill === 'function') updateInstallPill();
    }, 200);

    // Wait for quranData to be loaded (async), then run features that need it
    var tries = 0;
    var iv = setInterval(function() {
        tries++;
        if (typeof quranData !== 'undefined' && quranData.length > 0) {
            clearInterval(iv);
            applyDeepLinkOnLoad();
            buildVerseNav();
            // Show last-read banner after 1 sec, only if not dismissed this session
            setTimeout(function() {
                try {
                    if (sessionStorage.getItem('lrbDismissed') === '1') return;
                } catch(e) {}
                showLastReadBanner();
            }, 1000);
            // Patch displaySingleSura to record activity + extras
            patchDisplay();
            checkAudioResume();
        } else if (tries > 50) {
            clearInterval(iv);
        }
    }, 100);
}

function patchDisplay() {
    if (typeof displaySingleSura === 'undefined') return;
    if (window._displayPatchedFeatures) return;
    window._displayPatchedFeatures = true;

    var orig = displaySingleSura;
    window.displaySingleSura = displaySingleSura = function(suraId) {
        orig(suraId);
        recordDailyReading();
        // Add copy/share/link buttons to each verse
        if (isFeatureOn('copyShareVerse')) {
            setTimeout(function() {
                var sura = quranData.find(function(s) { return s.id === String(suraId); });
                if (!sura) return;
                // v9.11: Use getElementById + descendant query — IDs starting with
                // digits are illegal in CSS selectors but legal as element IDs
                var suraEl = document.getElementById(sura.id);
                if (!suraEl) return;
                suraEl.querySelectorAll('.verse').forEach(function(verseEl, idx) {
                    attachVerseExtras(verseEl, sura.id, idx, sura.verses[idx].text, sura.name);
                });
            }, 50);
        }
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeatures);
} else {
    initFeatures();
}

// ═══════════════════════════════════════════════════════════════════
// v9.12 — Desktop Features modal wiring
// ═══════════════════════════════════════════════════════════════════
window.openFeaturesModal = function() {
    var overlay = document.getElementById('featuresModal');
    var body    = document.getElementById('featuresModalBody');
    if (!overlay || !body) return;
    body.innerHTML = '';
    // v10.3: Meditation banner at the top (matches mobile sheet)
    var med = document.createElement('div');
    med.className = 'settings-meditation';
    var medTranslations = {
        french:  "Ne méditent-ils donc pas sur le Coran ? Ou y a-t-il des cadenas sur leurs cœurs ?",
        english: "Then do they not reflect upon the Quran, or are there locks upon their hearts?",
        spanish: "¿Es que no meditan en el Corán? ¿O es que hay candados en sus corazones?",
        arabic:  "أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ أَمْ عَلَىٰ قُلُوبٍ أَقْفَالُهَا"
    };
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'french';
    // v10.11: Collect primary + additional non-Arabic translations to show under the Arabic verse
    var translationsToShow = [];
    if (lang !== 'arabic' && medTranslations[lang]) translationsToShow.push(medTranslations[lang]);
    if (typeof additionalLanguages !== 'undefined' && additionalLanguages.length) {
        additionalLanguages.forEach(function(code) {
            if (code === 'arabic') return;
            if (code === lang) return; // already added
            if (medTranslations[code] && translationsToShow.indexOf(medTranslations[code]) === -1) {
                translationsToShow.push(medTranslations[code]);
            }
        });
    }
    var translationsHtml = translationsToShow.map(function(t) {
        return '<div class="med-translation">' + t + '</div>';
    }).join('');
    med.innerHTML =
        '<div class="med-ornament">✦</div>' +
        '<div class="med-arabic" dir="rtl">أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ أَمْ عَلَىٰ قُلُوبٍ أَقْفَالُهَا</div>' +
        translationsHtml +
        '<div class="med-citation">— Quran 47:24</div>';
    body.appendChild(med);
    // Reuse the same UI builders the mobile sheet uses
    if (typeof appendFeaturesUI      === 'function') appendFeaturesUI(body);
    if (typeof appendFocusModeButton === 'function') appendFocusModeButton(body);
    if (typeof appendKhatmUI         === 'function') appendKhatmUI(body);
    // Version footer and section reordering handled by finalSettingsCleanup (last injection)
    overlay.classList.add('show');
};

window.closeFeaturesModal = function(e) {
    // If called from overlay click, only close when target is the overlay itself
    if (e && e.target && !e.target.classList.contains('features-modal-overlay')) return;
    var overlay = document.getElementById('featuresModal');
    if (overlay) overlay.classList.remove('show');
};

// Wire up the button (after DOM ready)
(function wireFeaturesBtn() {
    function attach() {
        var btn = document.getElementById('featuresBtn');
        if (btn && !btn._featuresWired) {
            btn._featuresWired = true;
            btn.addEventListener('click', function() {
                openFeaturesModal();
            });
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
}());

// Close on Escape (in addition to existing keyboard handler)
document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    var overlay = document.getElementById('featuresModal');
    if (overlay && overlay.classList.contains('show')) {
        overlay.classList.remove('show');
    }
});

// ═══════════════════════════════════════════════════════════════════
// v10 — Sidebar collapsible groups
// ═══════════════════════════════════════════════════════════════════
// Always reset to data-default on page load (Search open, others closed)
(function sidebarGroups() {
    function init() {
        var groups = document.querySelectorAll('.side-group');
        if (!groups.length) return;
        groups.forEach(function(g) {
            var header = g.querySelector('.side-group-header');
            var body = g.querySelector('.side-group-body');
            if (!header || !body) return;
            if (g.getAttribute('data-default') !== 'closed') g.classList.add('side-group-open');
            header.addEventListener('click', function() {
                g.classList.toggle('side-group-open');
            });
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());

// ═══════════════════════════════════════════════════════════════════
// v10.1 — DAILY READING PLAN (#10)
// Picks a plan length, calculates today's reading, tracks progress
// ═══════════════════════════════════════════════════════════════════
const READING_PLAN_KEY = 'quranReadingPlan';

// Juz boundaries: which surah:verse each juz starts at
// (Standard 30-juz division — surahs are 1-indexed here)
const JUZ_START = [
    { juz: 1,  sura: 1,   verse: 1 },
    { juz: 2,  sura: 2,   verse: 142 },
    { juz: 3,  sura: 2,   verse: 253 },
    { juz: 4,  sura: 3,   verse: 93 },
    { juz: 5,  sura: 4,   verse: 24 },
    { juz: 6,  sura: 4,   verse: 148 },
    { juz: 7,  sura: 5,   verse: 82 },
    { juz: 8,  sura: 6,   verse: 111 },
    { juz: 9,  sura: 7,   verse: 88 },
    { juz: 10, sura: 8,   verse: 41 },
    { juz: 11, sura: 9,   verse: 93 },
    { juz: 12, sura: 11,  verse: 6 },
    { juz: 13, sura: 12,  verse: 53 },
    { juz: 14, sura: 15,  verse: 1 },
    { juz: 15, sura: 17,  verse: 1 },
    { juz: 16, sura: 18,  verse: 75 },
    { juz: 17, sura: 21,  verse: 1 },
    { juz: 18, sura: 23,  verse: 1 },
    { juz: 19, sura: 25,  verse: 21 },
    { juz: 20, sura: 27,  verse: 56 },
    { juz: 21, sura: 29,  verse: 46 },
    { juz: 22, sura: 33,  verse: 31 },
    { juz: 23, sura: 36,  verse: 28 },
    { juz: 24, sura: 39,  verse: 32 },
    { juz: 25, sura: 41,  verse: 47 },
    { juz: 26, sura: 46,  verse: 1 },
    { juz: 27, sura: 51,  verse: 31 },
    { juz: 28, sura: 58,  verse: 1 },
    { juz: 29, sura: 67,  verse: 1 },
    { juz: 30, sura: 78,  verse: 1 }
];

function getReadingPlan() {
    try {
        var p = JSON.parse(localStorage.getItem(READING_PLAN_KEY) || 'null');
        if (!p) return null;
        if (!p.completedDays) p.completedDays = {};
        return p;
    } catch(e) { return null; }
}

function saveReadingPlan(p) {
    try { localStorage.setItem(READING_PLAN_KEY, JSON.stringify(p)); } catch(e) {}
}

function clearReadingPlan() {
    try { localStorage.removeItem(READING_PLAN_KEY); } catch(e) {}
}

// Plan types map to total days, and how to slice the Quran
// 30-day plans = 1 juz per day. 60-day = half-juz/day. 90-day = third-juz/day.
function getPlanConfig(planType, customDays) {
    var totalDays;
    if (planType === '30day') totalDays = 30;
    else if (planType === '60day') totalDays = 60;
    else if (planType === '90day') totalDays = 90;
    else if (planType === 'custom' && customDays) totalDays = customDays;
    else totalDays = 30;
    return { totalDays: totalDays, juzPerDay: 30 / totalDays };
}

// Calculate today's reading assignment as a list of surahs
// (which surahs to read today, sorted by sura number)
function calculateTodayReading() {
    var plan = getReadingPlan();
    if (!plan) return null;

    var cfg = getPlanConfig(plan.planType, plan.customDays);
    var startDate = new Date(plan.startDate);
    var today = new Date();
    today.setHours(0,0,0,0);
    startDate.setHours(0,0,0,0);
    var dayIdx = Math.floor((today - startDate) / 86400000); // 0-indexed

    if (dayIdx >= cfg.totalDays) {
        return { dayNum: cfg.totalDays, totalDays: cfg.totalDays, finished: true, surahs: [], juzList: [] };
    }
    if (dayIdx < 0) {
        return { dayNum: 1, totalDays: cfg.totalDays, surahs: [], juzList: [], notStarted: true };
    }

    // Calculate juz range covered today
    var juzStart = dayIdx * cfg.juzPerDay; // float, 0-indexed
    var juzEnd = juzStart + cfg.juzPerDay;

    // Convert juz range to surah list
    // Find which surahs intersect with the juz range
    var surahsToday = {};
    var juzListToday = [];

    var firstJuzInt = Math.floor(juzStart) + 1; // 1-indexed
    var lastJuzInt = Math.ceil(juzEnd); // 1-indexed inclusive boundary
    if (lastJuzInt > 30) lastJuzInt = 30;

    for (var j = firstJuzInt; j <= lastJuzInt; j++) {
        juzListToday.push(j);
        var jStart = JUZ_START[j - 1];
        var jEnd = (j < 30) ? JUZ_START[j] : { sura: 115, verse: 1 }; // sentinel beyond
        // Add all surahs from jStart.sura through jEnd.sura
        for (var s = jStart.sura; s <= jEnd.sura && s <= 114; s++) {
            // Skip sentinel
            if (s >= jEnd.sura && jEnd.verse === 1 && j < 30) {
                // jEnd's verse 1 means next juz starts cleanly at top of that surah
                // so this surah is NOT in current juz unless we include it via overlap
                if (s === jEnd.sura) continue;
            }
            surahsToday[s] = true;
        }
    }

    var surahArr = Object.keys(surahsToday).map(function(k){ return parseInt(k); }).sort(function(a,b){ return a-b; });

    return {
        dayNum: dayIdx + 1,
        totalDays: cfg.totalDays,
        juzList: juzListToday,
        surahs: surahArr,
        completed: !!plan.completedDays[dateKey(today)]
    };
}

function dateKey(d) {
    return d.toISOString().slice(0, 10);
}

function markTodayComplete() {
    var plan = getReadingPlan();
    if (!plan) return;
    var todayKey = dateKey(new Date());
    plan.completedDays[todayKey] = true;
    saveReadingPlan(plan);

    // Check if we've finished all days
    var cfg = getPlanConfig(plan.planType, plan.customDays);
    var doneCount = Object.keys(plan.completedDays).length;
    if (doneCount >= cfg.totalDays) {
        if (typeof recordKhatmCompletion === 'function') recordKhatmCompletion();
        showToast('🎉 Plan completed — Khatm logged!');
        clearReadingPlan();
    } else {
        showToast('✓ Today marked complete');
    }
    hapticTap(20);
    renderReadingPlanCard();
}

// ── Render the plan card at top of reading area ──
// v10.10: Reading plan UI completely reworked.
// - Inline card removed (was too big and intrusive)
// - Small floating pill in top-right area on desktop, in bottom area on mobile
// - Click the pill → opens a compact modal with progress + Mark Done + ✕
// - User can dismiss the pill (sessionStorage) but plan stays active; Settings re-shows it.
function renderReadingPlanCard() {
    var existing = document.getElementById('readingPlanPill');
    if (existing) existing.remove();
    var existingCard = document.getElementById('readingPlanCard'); // legacy
    if (existingCard) existingCard.remove();

    var plan = getReadingPlan();
    if (!plan) return;
    var info = calculateTodayReading();
    if (!info) return;

    // Has the user dismissed the pill this session?
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('readingPlanPillDismissed') === '1'; } catch(e) {}
    if (dismissed) return;

    var pill = document.createElement('button');
    pill.id = 'readingPlanPill';
    pill.className = 'reading-plan-pill';
    pill.type = 'button';
    pill.title = 'Open reading plan';

    var icon, label;
    if (info.notStarted) {
        icon = '📖';
        label = 'Plan · starts soon';
    } else if (info.finished) {
        icon = '🎉';
        label = 'Plan complete';
    } else if (info.completed) {
        icon = '✓';
        label = 'Day ' + info.dayNum + ' done';
    } else {
        icon = '📖';
        label = 'Day ' + info.dayNum + ' / ' + info.totalDays;
    }
    pill.innerHTML =
        '<span class="rpp-ico">' + icon + '</span>' +
        '<span class="rpp-lbl">' + label + '</span>' +
        '<span class="rpp-x" title="Hide for this session">✕</span>';

    pill.addEventListener('click', function(e) {
        if (e.target.classList.contains('rpp-x')) {
            e.stopPropagation();
            try { sessionStorage.setItem('readingPlanPillDismissed', '1'); } catch(err) {}
            pill.remove();
            return;
        }
        openReadingPlanModal();
    });

    document.body.appendChild(pill);
}

// v10.10: Modal that opens when the pill is clicked
function openReadingPlanModal() {
    var existing = document.getElementById('readingPlanModal');
    if (existing) existing.remove();
    var plan = getReadingPlan();
    if (!plan) return;
    var info = calculateTodayReading();
    if (!info) return;

    var overlay = document.createElement('div');
    overlay.id = 'readingPlanModal';
    overlay.className = 'reading-plan-modal-overlay';

    var contentHtml;
    if (info.notStarted) {
        contentHtml =
            '<div class="rpm-icon-big">📖</div>' +
            '<div class="rpm-status">Plan starts ' + new Date(plan.startDate).toLocaleDateString() + '</div>';
    } else if (info.finished) {
        contentHtml =
            '<div class="rpm-icon-big">🎉</div>' +
            '<div class="rpm-status">Plan complete!</div>' +
            '<div class="rpm-detail">You finished all ' + info.totalDays + ' days</div>' +
            '<button class="rpm-btn-primary" id="rpmDismissPlan">Dismiss plan</button>';
    } else {
        var doneCount = Object.keys(plan.completedDays).length;
        var pct = Math.round((doneCount / info.totalDays) * 100);
        var juzText = info.juzList.length === 1
            ? 'Juz ' + info.juzList[0]
            : 'Juz ' + info.juzList[0] + '–' + info.juzList[info.juzList.length-1];
        var surahHint = info.surahs.length > 0
            ? ' · Surahs ' + info.surahs[0] + (info.surahs.length > 1 ? '–' + info.surahs[info.surahs.length-1] : '')
            : '';
        var doneCta = info.completed
            ? '<div class="rpm-done-badge">✓ Day already marked done</div>'
            : '<button class="rpm-btn-primary" id="rpmMarkDone">Mark today done</button>';
        contentHtml =
            '<div class="rpm-day">Day ' + info.dayNum + ' of ' + info.totalDays + '</div>' +
            '<div class="rpm-today">' + juzText + surahHint + '</div>' +
            '<div class="rpm-progress"><div class="rpm-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="rpm-progress-text">' + doneCount + ' / ' + info.totalDays + ' days · ' + pct + '%</div>' +
            doneCta;
    }

    overlay.innerHTML =
        '<div class="reading-plan-modal-box">' +
            '<div class="rpm-header">' +
                '<span class="rpm-title">📖 Reading plan</span>' +
                '<button class="rpm-close" id="rpmClose">✕</button>' +
            '</div>' +
            '<div class="rpm-body">' + contentHtml + '</div>' +
            '<div class="rpm-footer">To cancel the plan, see Settings → Reading plan.</div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function(){ overlay.classList.add('show'); });

    function close() {
        overlay.classList.remove('show');
        setTimeout(function(){ if (overlay.parentNode) overlay.remove(); }, 200);
    }
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) close();
    });
    document.getElementById('rpmClose').addEventListener('click', close);
    var markBtn = document.getElementById('rpmMarkDone');
    if (markBtn) markBtn.addEventListener('click', function() {
        markTodayComplete();
        close();
        // The pill will refresh on next renderReadingPlanCard call
        setTimeout(renderReadingPlanCard, 100);
    });
    var dismissBtn = document.getElementById('rpmDismissPlan');
    if (dismissBtn) dismissBtn.addEventListener('click', function() {
        clearReadingPlan();
        close();
        var p = document.getElementById('readingPlanPill');
        if (p) p.remove();
    });
}

// ── Plan setup UI (in settings) ──
function appendReadingPlanUI(body) {
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Reading plan';
    sec.appendChild(lbl);

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-primary);margin-bottom:10px;opacity:0.78;line-height:1.4;';
    hint.textContent = 'Pick how fast you want to finish the Quran. Each day shows what to read; mark days complete to track progress.';
    sec.appendChild(hint);

    var current = getReadingPlan();

    if (current) {
        // Active plan — show details + cancel
        var cfg = getPlanConfig(current.planType, current.customDays);
        var doneCount = Object.keys(current.completedDays).length;
        var info = document.createElement('div');
        info.className = 'reading-plan-active';
        info.innerHTML =
            '<div class="rpa-row"><span class="rpa-key">Plan:</span><span class="rpa-val">' +
                (current.planType === 'custom' ? current.customDays + ' days' : current.planType.replace('day', ' days')) +
            '</span></div>' +
            '<div class="rpa-row"><span class="rpa-key">Started:</span><span class="rpa-val">' + new Date(current.startDate).toLocaleDateString() + '</span></div>' +
            '<div class="rpa-row"><span class="rpa-key">Progress:</span><span class="rpa-val">' + doneCount + ' / ' + cfg.totalDays + ' days</span></div>';
        sec.appendChild(info);

        // v10.11: Restore-pill button — shows the floating pill again if user dismissed it
        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';

        var showPillBtn = document.createElement('button');
        showPillBtn.className = 'mob-settings-btn';
        showPillBtn.style.cssText = 'flex:1;min-width:0;';
        showPillBtn.textContent = '📌 Show window';
        showPillBtn.title = 'Bring back the floating reading-plan window';
        showPillBtn.addEventListener('click', function() {
            try { sessionStorage.removeItem('readingPlanPillDismissed'); } catch(e) {}
            if (typeof renderReadingPlanCard === 'function') renderReadingPlanCard();
            if (typeof showToast === 'function') showToast('Window restored');
        });
        btnRow.appendChild(showPillBtn);

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'mob-settings-btn';
        cancelBtn.style.cssText = 'flex:1;min-width:0;background:#d9707018;border-color:#d9707040;color:#e08585;';
        cancelBtn.textContent = '🗑 Cancel plan';
        cancelBtn.addEventListener('click', function() {
            if (typeof showConfirm === 'function') {
                showConfirm('Cancel reading plan?', 'Your progress (' + doneCount + ' days) will be lost.', function() {
                    clearReadingPlan();
                    var pill = document.getElementById('readingPlanPill');
                    if (pill) pill.remove();
                    var modal = document.getElementById('readingPlanModal');
                    if (modal) modal.remove();
                    // Clear session-dismissed flag so a future plan shows the pill again
                    try { sessionStorage.removeItem('readingPlanPillDismissed'); } catch(e) {}
                    showToast('Plan cancelled');
                    if (typeof openFeaturesModal === 'function' && document.getElementById('featuresModal').classList.contains('show')) {
                        openFeaturesModal();
                    }
                });
            } else if (confirm('Cancel reading plan? Your progress will be lost.')) {
                clearReadingPlan();
                var pill2 = document.getElementById('readingPlanPill');
                if (pill2) pill2.remove();
                try { sessionStorage.removeItem('readingPlanPillDismissed'); } catch(e) {}
            }
        });
        btnRow.appendChild(cancelBtn);
        sec.appendChild(btnRow);
    } else {
        // No active plan — show plan picker
        var presets = [
            { id: '30day', label: '🌙 30 days', desc: '1 juz/day · Ramadan pace' },
            { id: '60day', label: '📅 60 days', desc: 'Half a juz per day' },
            { id: '90day', label: '📚 90 days', desc: 'Gentle pace · ~3 surahs/day' }
        ];
        presets.forEach(function(p) {
            var btn = document.createElement('button');
            btn.className = 'mob-settings-btn rp-preset-btn';
            btn.innerHTML = '<span class="rpb-label">' + p.label + '</span><span class="rpb-desc">' + p.desc + '</span>';
            btn.addEventListener('click', function() {
                startPlan(p.id);
            });
            sec.appendChild(btn);
        });

        // Custom days input
        var customRow = document.createElement('div');
        customRow.className = 'rp-custom-row';
        customRow.innerHTML =
            '<span class="rpb-label">⚙ Custom:</span>' +
            '<input type="number" min="2" max="365" placeholder="days" id="rpCustomInput">' +
            '<button class="rp-custom-go">Start</button>';
        sec.appendChild(customRow);
        customRow.querySelector('.rp-custom-go').addEventListener('click', function() {
            var v = parseInt(customRow.querySelector('#rpCustomInput').value, 10);
            if (isNaN(v) || v < 2 || v > 365) {
                showToast('Enter 2–365 days');
                return;
            }
            startPlan('custom', v);
        });
    }

    body.appendChild(sec);

    // Reading-time summary — always shown
    var rtSec = document.createElement('div');
    rtSec.className = 'mob-settings-section';
    var rtLbl = document.createElement('div');
    rtLbl.className = 'mob-settings-lbl';
    rtLbl.textContent = 'Reading time';
    rtSec.appendChild(rtLbl);
    var s = getReadingTimeSummary();
    var rtBox = document.createElement('div');
    rtBox.className = 'reading-time-box';
    rtBox.innerHTML =
        '<div class="rt-row"><span class="rt-key">This week</span><span class="rt-val">' + fmtTime(s.thisWeek) + '</span></div>' +
        '<div class="rt-row"><span class="rt-key">4-week average</span><span class="rt-val">' + fmtTime(s.avg4w) + '/week</span></div>' +
        '<div class="rt-footer"><button class="rt-reset-link" type="button">🗑 Reset</button></div>';
    rtSec.appendChild(rtBox);
    var rtReset = rtBox.querySelector('.rt-reset-link');
    rtReset.addEventListener('click', function() {
        var data = getReadingTime();
        var weeksCount = Object.keys(data).length;
        var totalMin = 0;
        Object.values(data).forEach(function(m){ totalMin += m; });
        var msg = 'This will erase your reading-time history (' + weeksCount + ' week' + (weeksCount === 1 ? '' : 's') + ' · ' + fmtTime(totalMin) + ' total). This cannot be undone.';
        if (typeof showConfirm === 'function') {
            showConfirm('Reset reading time?', msg, function() {
                try { localStorage.removeItem(READING_TIME_KEY); } catch(e) {}
                _readingTimeStart = Date.now();
                if (typeof refreshTopReadingTime === 'function') refreshTopReadingTime();
                if (typeof showToast === 'function') showToast('Reading time reset');
                var feat = document.getElementById('featuresModal');
                if (feat && feat.classList.contains('show') && typeof openFeaturesModal === 'function') {
                    openFeaturesModal();
                }
            });
        } else if (confirm(msg)) {
            try { localStorage.removeItem(READING_TIME_KEY); } catch(e) {}
            _readingTimeStart = Date.now();
            if (typeof refreshTopReadingTime === 'function') refreshTopReadingTime();
        }
    });
    // Laptop: restore the sidebar widget if it was hidden
    if (window.innerWidth > 767) {
        var rtHidden = false;
        try { rtHidden = localStorage.getItem('quranHideReadingWidget') === '1'; } catch(e) {}
        if (rtHidden) {
            var showWidgetBtn = document.createElement('button');
            showWidgetBtn.className = 'mob-settings-btn';
            showWidgetBtn.style.marginTop = '8px';
            showWidgetBtn.textContent = '⏱ Show reading time in sidebar';
            showWidgetBtn.addEventListener('click', function() {
                try { localStorage.removeItem('quranHideReadingWidget'); } catch(e) {}
                var w = document.getElementById('topReadingTime');
                if (w) w.style.display = '';
                showWidgetBtn.remove();
            });
            rtSec.appendChild(showWidgetBtn);
        }
    }
    // Phone: button to open full reading-time screen
    if (window.innerWidth <= 767) {
        var viewRtBtn = document.createElement('button');
        viewRtBtn.className = 'mob-settings-btn';
        viewRtBtn.style.marginTop = '8px';
        viewRtBtn.textContent = '⏱ View reading time';
        viewRtBtn.addEventListener('click', function() {
            if (typeof openReadingTimeScreen === 'function') openReadingTimeScreen();
        });
        rtSec.appendChild(viewRtBtn);
    }
    body.appendChild(rtSec);
}

function startPlan(planType, customDays) {
    var totalDays = customDays || { '30days': 30, '60days': 60, '90days': 90 }[planType] || null;
    track('reading_plan_started', { plan_type: planType, days: totalDays });
    var plan = {
        planType: planType,
        customDays: customDays || null,
        startDate: new Date().toISOString(),
        completedDays: {}
    };
    saveReadingPlan(plan);
    showToast('📖 Plan started!');
    renderReadingPlanCard();
    // Refresh the settings UI if open
    if (typeof openFeaturesModal === 'function') {
        var modal = document.getElementById('featuresModal');
        if (modal && modal.classList.contains('show')) openFeaturesModal();
    }
    hapticTap(20);
}

// Hook into displaySingleSura to refresh card when surah changes
(function hookReadingPlanCard() {
    function tryHook() {
        if (typeof displaySingleSura === 'undefined') return false;
        if (window._planCardHooked) return true;
        window._planCardHooked = true;
        var orig = displaySingleSura;
        window.displaySingleSura = displaySingleSura = function(suraId) {
            orig(suraId);
            // Re-render plan card after a tick (so it appears above the new sura)
            setTimeout(renderReadingPlanCard, 100);
        };
        return true;
    }
    if (!tryHook()) {
        var iv = setInterval(function() {
            if (tryHook()) clearInterval(iv);
        }, 200);
    }
}());

// Show on initial load
(function showPlanOnLoad() {
    function tryShow() {
        if (typeof quranData === 'undefined' || !quranData.length) return false;
        renderReadingPlanCard();
        return true;
    }
    if (!tryShow()) {
        var iv = setInterval(function() {
            if (tryShow()) clearInterval(iv);
        }, 300);
    }
}());

// Hook into the existing settings (mobile sheet & desktop modal)
// We extend buildSheetSettings AND openFeaturesModal
(function injectPlanIntoSettings() {
    function tryInject() {
        if (typeof buildSheetSettings === 'undefined') return false;
        if (window._planUIInjected) return true;
        window._planUIInjected = true;
        var origSheet = buildSheetSettings;
        window.buildSheetSettings = buildSheetSettings = function(body, title) {
            origSheet(body, title);
            appendReadingPlanUI(body);
        };
        // Also extend openFeaturesModal (desktop)
        if (typeof openFeaturesModal === 'function') {
            var origModal = openFeaturesModal;
            window.openFeaturesModal = function() {
                origModal();
                var body = document.getElementById('featuresModalBody');
                if (body) appendReadingPlanUI(body);
            };
        }
        return true;
    }
    if (!tryInject()) {
        var iv = setInterval(function() {
            if (tryInject()) clearInterval(iv);
        }, 200);
    }
}());

// ═══════════════════════════════════════════════════════════════════
// v10.1 — PWA registration & install prompt
// ═══════════════════════════════════════════════════════════════════
(function pwaSetup() {
    // Service worker registration
    if ('serviceWorker' in navigator) {
        // Wait for window load so SW registration doesn't compete with initial render
        window.addEventListener('load', function() {
            // Only register on http(s) — skip if running off file://
            if (location.protocol === 'file:') {
                console.info('[PWA] Skipping service worker — file:// not supported. Use Live Server or HTTPS.');
                return;
            }
            navigator.serviceWorker.register('service-worker.js').then(function(reg) {
                console.info('[PWA] Service worker registered, scope:', reg.scope);

                // v10.11: Helper to show the update pill (extracted for reuse)
                function showUpdatePill(workerToActivate) {
                    if (document.querySelector('.pwa-update-bar')) return; // already showing
                    var bar = document.createElement('div');
                    bar.className = 'pwa-update-bar';
                    bar.innerHTML = '<span>📦 New version available</span><button class="pwa-update-btn">Reload</button><button class="pwa-update-dismiss">✕</button>';
                    document.body.appendChild(bar);
                    bar.querySelector('.pwa-update-btn').addEventListener('click', function() {
                        if (workerToActivate && workerToActivate.postMessage) {
                            workerToActivate.postMessage({ type: 'SKIP_WAITING' });
                        }
                        location.reload();
                    });
                    bar.querySelector('.pwa-update-dismiss').addEventListener('click', function() {
                        bar.remove();
                    });
                }

                // v10.11: If a SW is ALREADY waiting (installed before this page loaded), show pill now
                if (reg.waiting && navigator.serviceWorker.controller) {
                    showUpdatePill(reg.waiting);
                }

                // Check for updates periodically (every hour)
                setInterval(function() { reg.update(); }, 60 * 60 * 1000);
                // Also check on focus (catches updates that landed while app was closed)
                window.addEventListener('focus', function() { reg.update(); });

                // Listen for updates discovered during this session
                reg.addEventListener('updatefound', function() {
                    var newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdatePill(newWorker);
                        }
                    });
                });
            }).catch(function(err) {
                console.warn('[PWA] Service worker registration failed:', err);
            });

            // Reload page when SW takes over (for skip-waiting flow)
            var refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', function() {
                if (refreshing) return;
                refreshing = true;
                // Don't auto-reload here — let the explicit Reload button handle it
            });
        });
    }

    // Capture install prompt — show our own "Install" button
    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
        // Mark as available — install button in features modal will pick this up
        window._pwaInstallable = true;
        // v10.3: Update the pill in sticky title
        if (typeof updateInstallPill === 'function') updateInstallPill();
    });

    window.addEventListener('appinstalled', function() {
        if (typeof showToast === 'function') showToast('🎉 App installed');
        window._pwaInstallable = false;
        deferredPrompt = null;
        try { localStorage.setItem('quranPWAInstalled', '1'); } catch(e) {}
        if (typeof updateInstallPill === 'function') updateInstallPill();
    });

    // Expose install trigger
    window.triggerPWAInstall = function() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(result) {
                if (result.outcome === 'accepted') {
                    if (typeof showToast === 'function') showToast('Installing…');
                }
                deferredPrompt = null;
                window._pwaInstallable = false;
                if (typeof updateInstallPill === 'function') updateInstallPill();
            });
            return;
        }
        // v10.5: No native prompt available — show OS-specific instructions modal
        showInstallInstructions();
    };
}());

// v10.5: Step-by-step install instructions when native prompt isn't available
function showInstallInstructions() {
    var ua = navigator.userAgent.toLowerCase();
    var isIOS = /iphone|ipad|ipod/.test(ua);
    var isAndroid = /android/.test(ua);
    var isSamsungInternet = /samsungbrowser/.test(ua);

    var title = 'Install Quran Display';
    var steps;
    if (isIOS) {
        steps = [
            'Tap the <strong>Share</strong> button at the bottom of Safari (the square with the arrow)',
            'Scroll down and tap <strong>Add to Home Screen</strong>',
            'Tap <strong>Add</strong> in the top-right corner'
        ];
    } else if (isSamsungInternet) {
        steps = [
            'Tap the <strong>menu</strong> button (☰) at the bottom of Samsung Internet',
            'Tap <strong>Add page to</strong>',
            'Tap <strong>Home screen</strong>',
            'Tap <strong>Add</strong>'
        ];
    } else if (isAndroid) {
        steps = [
            'Tap the <strong>menu</strong> button (⋮) in the top-right',
            'Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>',
            'Tap <strong>Install</strong>'
        ];
    } else {
        steps = [
            'Look for the <strong>install icon</strong> (⊕) in the address bar',
            'Click it and confirm <strong>Install</strong>',
            'The app will open in its own window'
        ];
    }

    // Build modal
    var existing = document.getElementById('installModal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'installModal';
    overlay.className = 'install-modal-overlay';
    overlay.innerHTML =
        '<div class="install-modal-box">' +
            '<div class="install-modal-header">' +
                '<span class="install-modal-icon">📲</span>' +
                '<span class="install-modal-title">' + title + '</span>' +
                '<button class="install-modal-close">✕</button>' +
            '</div>' +
            '<div class="install-modal-body">' +
                '<ol class="install-steps">' +
                    steps.map(function(s){ return '<li>' + s + '</li>'; }).join('') +
                '</ol>' +
                '<div class="install-benefits">' +
                    '<div class="install-benefit">📖 Read offline once installed</div>' +
                    '<div class="install-benefit">⚡ Launches instantly from home screen</div>' +
                    '<div class="install-benefit">🧘 Fullscreen — no browser chrome</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('.install-modal-close').addEventListener('click', function() {
        overlay.remove();
    });
}

// ── Update visibility of install banner ──────────────────────────────────────
window.updateInstallPill = function() {
    var btn = document.getElementById('headerInstallBtn');
    if (!btn) return;
    // Never show when already running as installed PWA
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;
    if (isStandalone) { btn.style.display = 'none'; return; }
    // Never show if user dismissed or app was already installed
    var dismissed = false, wasInstalled = false;
    try { dismissed    = localStorage.getItem('installBannerDismissed') === '1'; } catch(e) {}
    try { wasInstalled = localStorage.getItem('quranPWAInstalled')      === '1'; } catch(e) {}
    if (dismissed || wasInstalled) { btn.style.display = 'none'; return; }
    // Show on all platforms — native prompt used when available (Android/Desktop),
    // fallback instructions modal shown otherwise (iOS, or before prompt fires).
    btn.style.display = '';
};

// Wire header install button + close button on DOM-ready
(function wireHeaderInstall() {
    function attach() {
        var btn = document.getElementById('headerInstallBtn');
        var close = document.getElementById('headerInstallClose');
        if (!btn || btn._wired) return;
        btn._wired = true;
        btn.addEventListener('click', function(e) {
            if (e.target.closest('#headerInstallClose')) return; // close handled below
            if (typeof triggerPWAInstall === 'function') triggerPWAInstall();
        });
        if (close) close.addEventListener('click', function(e) {
            e.stopPropagation();
            try { localStorage.setItem('installBannerDismissed', '1'); } catch(err) {}
            btn.style.display = 'none';
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
}());

// ── Install card in settings ──
function appendInstallUI(body) {
    if (body.querySelector('[data-install-section]')) return;
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    sec.setAttribute('data-install-section', '1');
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Install as app';
    sec.appendChild(lbl);

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-primary);margin-bottom:10px;opacity:0.78;line-height:1.4;';

    // Detect install state
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;

    if (isStandalone) {
        hint.style.cssText = 'font-size:24px;font-weight:700;color:#4caf50;text-align:center;padding:14px 0 4px;line-height:1.3;';
        hint.textContent = '✅ Installed — works offline';
        sec.appendChild(hint);
    } else if (window._pwaInstallable) {
        hint.textContent = 'Install this app on your device for an icon on your home screen, faster startup, and full offline reading.';
        sec.appendChild(hint);
        var btn = document.createElement('button');
        btn.className = 'mob-settings-btn';
        btn.textContent = '📲 Install on this device';
        btn.addEventListener('click', triggerPWAInstall);
        sec.appendChild(btn);
    } else {
        // Show OS-specific guidance
        var ua = navigator.userAgent.toLowerCase();
        var isIOS = /iphone|ipad|ipod/.test(ua);
        var isMobile = isIOS || /android/.test(ua);
        if (isIOS) {
            hint.innerHTML = 'On iPhone/iPad: tap the <strong>Share</strong> button (□↑) below, then <strong>Add to Home Screen</strong>.';
        } else if (isMobile) {
            hint.innerHTML = 'On Android: tap your browser\'s ⋮ menu, then <strong>Install app</strong> or <strong>Add to Home Screen</strong>.';
        } else {
            hint.innerHTML = 'In Chrome/Edge: look for the install icon (⊕) in the address bar. The app will work offline after first load.';
        }
        sec.appendChild(hint);
    }

    body.appendChild(sec);
}

// Inject install UI into settings (alongside reading plan)
(function injectInstallIntoSettings() {
    function tryInject() {
        if (typeof buildSheetSettings === 'undefined') return false;
        if (window._installUIInjected) return true;
        window._installUIInjected = true;
        var origSheet = buildSheetSettings;
        window.buildSheetSettings = buildSheetSettings = function(body, title) {
            origSheet(body, title);
            appendInstallUI(body);
        };
        if (typeof openFeaturesModal === 'function') {
            var origModal = openFeaturesModal;
            window.openFeaturesModal = function() {
                origModal();
                var body = document.getElementById('featuresModalBody');
                if (body) appendInstallUI(body);
            };
        }
        return true;
    }
    if (!tryInject()) {
        var iv = setInterval(function() {
            if (tryInject()) clearInterval(iv);
        }, 200);
    }
}());

// ═══════════════════════════════════════════════════════════════════
// v10.2 PHASE 2b — AUDIO RECITATION
// Streams from everyayah.com CDN (reliable, CORS-open, free)
// ═══════════════════════════════════════════════════════════════════

const AUDIO_KEY        = 'quranAudioPrefs';
const AUDIO_RESUME_KEY = 'quranAudioResume';
const AUDIO_HOST = 'https://everyayah.com/data/';

// Reciter catalog — folder names from everyayah.com
const RECITERS = [
    { id: 'Alafasy_128kbps',                  name: 'Mishary Al-Afasy',     lang: 'Mujawwad' },
    { id: 'Abdul_Basit_Murattal_192kbps',     name: 'Abdul Basit',          lang: 'Murattal'  },
    { id: 'Abdurrahmaan_As-Sudais_192kbps',   name: 'Abdurrahmaan As-Sudais', lang: 'Murattal' },
    { id: 'Saood_ash-Shuraym_128kbps',        name: 'Saud Al-Shuraim',      lang: 'Murattal'  },
    { id: 'Husary_128kbps',                   name: 'Mahmoud Al-Husary',    lang: 'Murattal'  },
    { id: 'Minshawy_Murattal_128kbps',        name: 'Mohamed Al-Minshawy',  lang: 'Murattal'  }
];

function getAudioPrefs() {
    try {
        var saved = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}');
        return {
            reciter: saved.reciter || 'Alafasy_128kbps',
            autoAdvance: saved.autoAdvance !== false,
            crossSurah:  !!saved.crossSurah,
            speed:       saved.speed || 1,
            repeat:      saved.repeat || 'none', // 'none' | 'verse' | 'surah'
            repeatCount: saved.repeatCount || 1
        };
    } catch(e) {
        return { reciter: 'Alafasy_128kbps', autoAdvance: true, crossSurah: false, speed: 1, repeat: 'none', repeatCount: 1 };
    }
}

function saveAudioPrefs(p) {
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify(p)); } catch(e) {}
}

function saveAudioResume() {
    if (_audioState.suraId == null || _audioState.verseIdx == null) return;
    try {
        localStorage.setItem(AUDIO_RESUME_KEY, JSON.stringify({
            suraId:   _audioState.suraId,
            verseIdx: _audioState.verseIdx,
            suraName: _audioState.suraName,
            ts:       Date.now()
        }));
    } catch(e) {}
}

function clearAudioResume() {
    try { localStorage.removeItem(AUDIO_RESUME_KEY); } catch(e) {}
}

function pad3(n) {
    n = String(n);
    while (n.length < 3) n = '0' + n;
    return n;
}

function audioUrlFor(reciterId, suraNum, verseNum) {
    return AUDIO_HOST + reciterId + '/' + pad3(suraNum) + pad3(verseNum) + '.mp3';
}

// ── Player state ────────────────────────────────────────────────────
var _audio = null;            // HTMLAudioElement
var _audioPreload = null;     // pre-fetched next verse
var _audioStopping = false;   // true during intentional stop — suppresses spurious error event
var _audioState = {
    playing: false,
    suraId: null,       // string sura ID ("0".."113")
    verseIdx: null,     // 0-indexed verse index
    suraName: null,
    totalVerses: 0,
    currentRepeat: 0    // for repeat-verse mode
};

function getAudioEl() {
    if (!_audio) {
        _audio = new Audio();
        _audio.preload = 'auto';
        _audio.addEventListener('ended', onAudioEnded);
        _audio.addEventListener('error', onAudioError);
        _audio.addEventListener('play', function() {
            _audioState.playing = true;
            updateMiniPlayer();
            updateVersePlayButtons();
        });
        _audio.addEventListener('pause', function() {
            _audioState.playing = false;
            updateMiniPlayer();
            updateVersePlayButtons();
        });
        _audio.addEventListener('loadstart', function() {
            updateMiniPlayer('loading');
        });
        _audio.addEventListener('canplay', function() {
            updateMiniPlayer();
        });
    }
    return _audio;
}

function playVerse(suraId, verseIdx) {
    var sura = quranData.find(function(s){ return s.id === String(suraId); });
    if (!sura) return;
    if (verseIdx < 0 || verseIdx >= sura.verses.length) return;

    var prefs = getAudioPrefs();
    var url = audioUrlFor(prefs.reciter, parseInt(suraId) + 1, verseIdx + 1);

    _audioState.suraId = String(suraId);
    _audioState.verseIdx = verseIdx;
    _audioState.suraName = sura.name;
    _audioState.totalVerses = sura.verses.length;
    saveAudioResume();

    var a = getAudioEl();
    a.playbackRate = prefs.speed;
    a.src = url;
    var p = a.play();
    if (p && p.catch) {
        p.catch(function(err) {
            // Most likely autoplay blocked or network error
            console.warn('[Audio] Play failed:', err);
            if (typeof showToast === 'function') {
                showToast('🔊 Audio failed — check network');
            }
        });
    }

    track('audio_played', { sura: parseInt(suraId) + 1, verse: verseIdx + 1, reciter: prefs.reciter });
    // Preload next verse for smooth auto-advance
    preloadNextVerse();
    // Show & highlight
    ensureMiniPlayer();
    updateMiniPlayer();
    updateVersePlayButtons();
    scrollVerseIntoViewIfNeeded(suraId, verseIdx);
}

function preloadNextVerse() {
    if (!_audioState.suraId) return;
    var prefs = getAudioPrefs();
    var nextSuraId = _audioState.suraId;
    var nextVerseIdx = _audioState.verseIdx + 1;
    if (nextVerseIdx >= _audioState.totalVerses) {
        if (!prefs.crossSurah) return;
        var n = parseInt(_audioState.suraId) + 1;
        if (n > 113) return;
        nextSuraId = String(n);
        nextVerseIdx = 0;
    }
    var url = audioUrlFor(prefs.reciter, parseInt(nextSuraId) + 1, nextVerseIdx + 1);
    if (!_audioPreload) _audioPreload = new Audio();
    _audioPreload.preload = 'auto';
    _audioPreload.src = url;
    // Triggers fetch
    _audioPreload.load();
}

function pauseAudio() {
    if (_audio) _audio.pause();
}

function resumeAudio() {
    if (_audio && _audio.src) {
        var p = _audio.play();
        if (p && p.catch) p.catch(function(){});
    }
}

function stopAudio() {
    if (_audio) {
        _audioStopping = true;
        _audio.pause();
        _audio.src = '';
        setTimeout(function() { _audioStopping = false; }, 200);
    }
    clearAudioResume();
    _audioState.suraId = null;
    _audioState.verseIdx = null;
    _audioState.currentRepeat = 0;
    updateMiniPlayer();
    updateVersePlayButtons();
    var mp = document.getElementById('audioMiniPlayer');
    if (mp) mp.remove();
}

function nextAudio() {
    if (!_audioState.suraId) return;
    var prefs = getAudioPrefs();
    var sId = _audioState.suraId;
    var vIdx = _audioState.verseIdx + 1;
    if (vIdx >= _audioState.totalVerses) {
        if (!prefs.crossSurah) { stopAudio(); return; }
        var n = parseInt(sId) + 1;
        if (n > 113) { stopAudio(); return; }
        sId = String(n);
        vIdx = 0;
    }
    playVerse(sId, vIdx);
}

function prevAudio() {
    if (!_audioState.suraId) return;
    var sId = _audioState.suraId;
    var vIdx = _audioState.verseIdx - 1;
    if (vIdx < 0) {
        var n = parseInt(sId) - 1;
        if (n < 0) return;
        var prevSura = quranData.find(function(s){ return s.id === String(n); });
        if (!prevSura) return;
        sId = String(n);
        vIdx = prevSura.verses.length - 1;
    }
    playVerse(sId, vIdx);
}

function onAudioEnded() {
    var prefs = getAudioPrefs();
    _audioState.playing = false;

    // v10.4: Repeat verse loops infinitely until mode changes or user stops
    if (prefs.repeat === 'verse') {
        var a = getAudioEl();
        a.currentTime = 0;
        var p = a.play();
        if (p && p.catch) p.catch(function(){});
        return;
    }

    // Repeat-surah: restart from verse 0 when reached end of surah
    if (prefs.repeat === 'surah' && _audioState.verseIdx + 1 >= _audioState.totalVerses) {
        playVerse(_audioState.suraId, 0);
        return;
    }

    // Next-surah: advance to next surah at end; wrap from 114 back to Al-Fatiha
    if (prefs.repeat === 'next-surah' && _audioState.verseIdx + 1 >= _audioState.totalVerses) {
        var nextId = parseInt(_audioState.suraId) + 1;
        if (nextId >= 114) nextId = 0;
        playVerse(String(nextId), 0);
        return;
    }

    if (prefs.autoAdvance) {
        nextAudio();
    } else {
        updateMiniPlayer();
        updateVersePlayButtons();
    }
}

function onAudioError(e) {
    if (_audioStopping) return;
    console.warn('[Audio] Error:', e);
    if (typeof showToast === 'function') {
        showToast('🔊 Couldn\'t load audio — try another reciter');
    }
    _audioState.playing = false;
    updateMiniPlayer();
    updateVersePlayButtons();
}

function scrollVerseIntoViewIfNeeded(suraId, verseIdx) {
    // Only scroll if user is on the current sura
    var currentSura = document.querySelector('.sura');
    if (!currentSura || currentSura.id !== String(suraId)) {
        // Different sura — navigate to it
        if (typeof displaySingleSura === 'function') {
            displaySingleSura(suraId);
            setTimeout(function() {
                var v = document.querySelectorAll('.verse')[verseIdx];
                if (v) v.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 250);
        }
        return;
    }
    var verses = currentSura.querySelectorAll('.verse');
    if (verses[verseIdx]) {
        var r = verses[verseIdx].getBoundingClientRect();
        var inView = r.top >= 60 && r.bottom <= window.innerHeight - 100;
        if (!inView) {
            verses[verseIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// ── Update visual state of all play buttons in current sura ──
function updateVersePlayButtons() {
    document.querySelectorAll('.verse-audio-btn').forEach(function(btn) {
        var sId = btn.getAttribute('data-sura-id');
        var vIdx = parseInt(btn.getAttribute('data-verse-idx'));
        var isThis = (sId === String(_audioState.suraId)) && (vIdx === _audioState.verseIdx);
        if (isThis) {
            btn.classList.add('playing');
            btn.innerHTML = _audioState.playing ? '⏸' : '▶';
        } else {
            btn.classList.remove('playing');
            btn.innerHTML = '🔊';
        }
    });
    // Also highlight active verse with a border
    document.querySelectorAll('.verse.playing-now').forEach(function(v) {
        v.classList.remove('playing-now');
    });
    if (_audioState.suraId != null && _audioState.verseIdx != null) {
        var currentSura = document.getElementById(String(_audioState.suraId));
        if (currentSura) {
            var verses = currentSura.querySelectorAll('.verse');
            if (verses[_audioState.verseIdx]) {
                verses[_audioState.verseIdx].classList.add('playing-now');
            }
        }
    }
}

// ── Mini-player UI ──
function ensureMiniPlayer() {
    if (document.getElementById('audioMiniPlayer')) return;
    var mp = document.createElement('div');
    mp.id = 'audioMiniPlayer';
    mp.className = 'audio-mini-player';
    mp.innerHTML =
        '<div class="amp-info">' +
            '<div class="amp-verse-line"></div>' +
            '<div class="amp-reciter-line"></div>' +
        '</div>' +
        '<div class="amp-controls">' +
            '<button class="amp-btn amp-prev"  title="Previous verse">⏮</button>' +
            '<button class="amp-btn amp-play"  title="Play/Pause">▶</button>' +
            '<button class="amp-btn amp-next"  title="Next verse">⏭</button>' +
            '<button class="amp-btn amp-speed" title="Playback speed">1×</button>' +
            '<button class="amp-btn amp-close" title="Close">✕</button>' +
        '</div>';
    document.body.appendChild(mp);

    mp.querySelector('.amp-play').addEventListener('click', function() {
        if (_audioState.playing) pauseAudio(); else resumeAudio();
    });
    mp.querySelector('.amp-prev').addEventListener('click', prevAudio);
    mp.querySelector('.amp-next').addEventListener('click', nextAudio);
    mp.querySelector('.amp-close').addEventListener('click', stopAudio);
    mp.querySelector('.amp-speed').addEventListener('click', function() {
        var prefs = getAudioPrefs();
        var steps = [0.75, 1, 1.25, 1.5, 2];
        var i = steps.indexOf(prefs.speed);
        i = (i + 1) % steps.length;
        prefs.speed = steps[i];
        saveAudioPrefs(prefs);
        if (_audio) _audio.playbackRate = prefs.speed;
        updateMiniPlayer();
    });
}

function updateMiniPlayer(state) {
    var mp = document.getElementById('audioMiniPlayer');
    if (!mp) return;
    var prefs = getAudioPrefs();
    var reciter = RECITERS.find(function(r){ return r.id === prefs.reciter; }) || RECITERS[0];
    var verseLine = mp.querySelector('.amp-verse-line');
    var reciterLine = mp.querySelector('.amp-reciter-line');

    if (_audioState.suraId == null) {
        verseLine.textContent = 'No audio';
        reciterLine.textContent = reciter.name;
    } else {
        var label = (_audioState.suraName || 'Surah ' + (parseInt(_audioState.suraId)+1)) + ' · v.' + (_audioState.verseIdx + 1);
        if (state === 'loading') label = '⏳ ' + label;
        verseLine.textContent = label;
        reciterLine.textContent = reciter.name + ' · ' + prefs.speed + '×';
    }
    var playBtn = mp.querySelector('.amp-play');
    if (playBtn) playBtn.textContent = _audioState.playing ? '⏸' : '▶';
    var speedBtn = mp.querySelector('.amp-speed');
    if (speedBtn) speedBtn.textContent = prefs.speed + '×';
}

// ── Add play buttons to verses in current sura (called after render) ──
// v10.11: ALWAYS attach the button — CSS body class hides when feature off
function attachAudioButtons() {
    document.querySelectorAll('.sura .verse').forEach(function(verseEl, _i) {
        if (verseEl.querySelector('.verse-audio-btn')) return; // already has one
        var suraEl = verseEl.closest('.sura');
        if (!suraEl) return;
        var suraId = suraEl.id;
        // Verse index: find this verse's index among siblings
        var verseIdx = Array.prototype.indexOf.call(suraEl.querySelectorAll('.verse'), verseEl);
        var actions = verseEl.querySelector('.verse-actions');
        if (!actions) return;
        var btn = document.createElement('button');
        btn.className = 'verse-action-btn verse-audio-btn';
        btn.setAttribute('data-sura-id', suraId);
        btn.setAttribute('data-verse-idx', verseIdx);
        btn.title = 'Listen';
        btn.innerHTML = '🔊';
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            // If this verse is currently playing — toggle pause
            if (String(suraId) === _audioState.suraId && verseIdx === _audioState.verseIdx) {
                if (_audioState.playing) pauseAudio(); else resumeAudio();
            } else {
                playVerse(suraId, verseIdx);
            }
            hapticTap(15);
        });
        actions.insertBefore(btn, actions.firstChild);
    });
    updateVersePlayButtons();
}

// Save resume position when app is hidden or closed
(function wireAudioResumeSave() {
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) saveAudioResume();
    });
    window.addEventListener('beforeunload', function() {
        saveAudioResume();
    });
}());

// Hook into displaySingleSura to add audio buttons after render
(function hookAudioButtons() {
    function tryHook() {
        if (typeof displaySingleSura === 'undefined') return false;
        if (window._audioHooked) return true;
        window._audioHooked = true;
        var orig = displaySingleSura;
        window.displaySingleSura = displaySingleSura = function(suraId) {
            orig(suraId);
            setTimeout(attachAudioButtons, 80);
        };
        // Initial pass for the sura already on screen
        setTimeout(attachAudioButtons, 200);
        return true;
    }
    if (!tryHook()) {
        var iv = setInterval(function() {
            if (tryHook()) clearInterval(iv);
        }, 200);
    }
}());

// ── Settings UI for audio ──
function appendAudioUI(body) {
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    var audioLblSpan = document.createElement('span');
    audioLblSpan.textContent = '🎵 Audio recitation';
    lbl.appendChild(audioLblSpan);
    if (HELP_VIDEOS.audio) {
        var audioHelpBtn = document.createElement('button');
        audioHelpBtn.className = 'section-help-btn';
        audioHelpBtn.title = 'Watch tutorial on YouTube';
        audioHelpBtn.textContent = 'ℹ️';
        audioHelpBtn.addEventListener('click', function(e) { e.stopPropagation(); window.open(HELP_VIDEOS.audio, '_blank'); });
        lbl.appendChild(audioHelpBtn);
    }
    sec.appendChild(lbl);

    var prefs = getAudioPrefs();

    // Reciter selector
    var recRow = document.createElement('div');
    recRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';
    var recLbl = document.createElement('span');
    recLbl.style.cssText = 'font-size:12px;color:var(--text-primary);opacity:0.85;flex-shrink:0;';
    recLbl.textContent = 'Reciter:';
    var recSel = document.createElement('select');
    recSel.className = 'mob-settings-select';
    recSel.style.flex = '1';
    RECITERS.forEach(function(r) {
        var opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name + ' (' + r.lang + ')';
        recSel.appendChild(opt);
    });
    recSel.value = prefs.reciter;
    recSel.addEventListener('change', function() {
        var p = getAudioPrefs();
        p.reciter = this.value;
        saveAudioPrefs(p);
        updateMiniPlayer();
        showToast('Reciter changed');
    });
    recRow.appendChild(recLbl); recRow.appendChild(recSel);
    sec.appendChild(recRow);

    // Auto-advance toggle
    function toggleRow(labelText, key, defaultVal) {
        var row = document.createElement('label');
        row.className = 'feature-toggle-row';
        var lblWrap = document.createElement('span');
        lblWrap.className = 'feature-toggle-lbl-wrap';
        var l = document.createElement('span');
        l.className = 'feature-toggle-lbl';
        l.textContent = labelText;
        lblWrap.appendChild(l);
        var sw = document.createElement('span');
        sw.className = 'feature-toggle-sw';
        var inp = document.createElement('input');
        inp.type = 'checkbox';
        var p2 = getAudioPrefs();
        inp.checked = p2[key];
        inp.addEventListener('change', function() {
            var pp = getAudioPrefs();
            pp[key] = this.checked;
            saveAudioPrefs(pp);
        });
        var sld = document.createElement('span');
        sld.className = 'feature-toggle-slider';
        sw.appendChild(inp); sw.appendChild(sld);
        row.appendChild(lblWrap); row.appendChild(sw);
        return row;
    }
    sec.appendChild(toggleRow('Auto-advance to next verse', 'autoAdvance'));
    sec.appendChild(toggleRow('Continue across surahs', 'crossSurah'));

    // Repeat selector
    var rptRow = document.createElement('div');
    rptRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;';
    var rptLbl = document.createElement('span');
    rptLbl.style.cssText = 'font-size:12px;color:var(--text-primary);opacity:0.85;flex-shrink:0;';
    rptLbl.textContent = 'Repeat:';
    var rptSel = document.createElement('select');
    rptSel.className = 'mob-settings-select';
    rptSel.style.flex = '1';
    [['none','No repeat'],['verse','Repeat verse'],['surah','Repeat surah'],['next-surah','Next Surah']].forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p[0]; opt.textContent = p[1];
        rptSel.appendChild(opt);
    });
    rptSel.value = prefs.repeat;
    rptSel.addEventListener('change', function() {
        var pp = getAudioPrefs();
        pp.repeat = this.value;
        saveAudioPrefs(pp);
        track('audio_repeat_changed', { mode: this.value });
    });
    rptRow.appendChild(rptLbl); rptRow.appendChild(rptSel);
    sec.appendChild(rptRow);

    body.appendChild(sec);
}

// ── Audio resume: check on load + banner UI ──────────────────────────
function checkAudioResume() {
    var saved;
    try { saved = JSON.parse(localStorage.getItem(AUDIO_RESUME_KEY)); } catch(e) {}
    if (!saved || saved.suraId == null || saved.verseIdx == null) return;
    // Show after 2 s so it doesn't stack with the last-read banner (1 s)
    setTimeout(function() { showResumeBanner(saved); }, 2000);
}

function showResumeBanner(saved) {
    if (document.getElementById('audioResumeBanner')) return;
    var suraName = saved.suraName || ('Surah ' + (parseInt(saved.suraId) + 1));
    var verseNum = saved.verseIdx + 1;
    var banner = document.createElement('div');
    banner.id = 'audioResumeBanner';
    banner.className = 'audio-resume-banner';
    banner.innerHTML =
        '<div class="arb-info">🎵 ' + suraName + ' · v.' + verseNum + '</div>' +
        '<div class="arb-actions">' +
            '<button class="arb-btn arb-play">▶ Reprendre</button>' +
            '<button class="arb-btn arb-dismiss">✕</button>' +
        '</div>';
    document.body.appendChild(banner);
    setTimeout(function() { banner.classList.add('show'); }, 50);
    var autoTimer = setTimeout(dismissResumeBanner, 10000);
    banner.querySelector('.arb-play').addEventListener('click', function() {
        clearTimeout(autoTimer);
        dismissResumeBanner();
        playVerse(saved.suraId, saved.verseIdx);
    });
    banner.querySelector('.arb-dismiss').addEventListener('click', function() {
        clearTimeout(autoTimer);
        clearAudioResume();
        dismissResumeBanner();
    });
}

function dismissResumeBanner() {
    var banner = document.getElementById('audioResumeBanner');
    if (!banner) return;
    banner.classList.remove('show');
    setTimeout(function() { if (banner.parentNode) banner.remove(); }, 300);
}

// ═══════════════════════════════════════════════════════════════════
// v10.2 — TAFSIR (classical commentary)
// Fetches from api.quran.com — caches in localStorage to avoid re-fetching
// ═══════════════════════════════════════════════════════════════════

const TAFSIR_KEY    = 'quranTafsirChoice';
const TAFSIR_CACHE  = 'quranTafsirCache';
const TAFSIR_CACHE_MAX = 200;  // max entries before LRU eviction

// v10.3: Migrated from api.quran.com (deprecated, required auth) to api.alquran.cloud
// (free, no auth, stable edition slugs). Old cached entries from v10.2 are stale
// (wrong content per ID) so we clear them once on v10.3 first load.
const TAFSIR_MIGRATION_KEY = 'quranTafsirMigratedToV103';
(function migrateTafsirCache() {
    try {
        if (localStorage.getItem(TAFSIR_MIGRATION_KEY) === '1') return;
        localStorage.removeItem(TAFSIR_CACHE);
        // Reset choice if it's an old numeric ID (the new IDs are string slugs)
        var choice = localStorage.getItem(TAFSIR_KEY);
        if (choice && /^\d+$/.test(choice)) {
            localStorage.removeItem(TAFSIR_KEY);
        }
        localStorage.setItem(TAFSIR_MIGRATION_KEY, '1');
    } catch(e) {}
}());

// Tafsir catalog — alquran.cloud edition slugs (stable, no auth required)
const TAFSIRS = [
    { id: 'ar.muyassar', name: 'Tafsir al-Muyassar',  lang: 'العربية', rtl: true,  desc: 'Modern, easy Arabic'   },
    { id: 'ar.jalalayn', name: 'Tafsir al-Jalalayn',  lang: 'العربية', rtl: true,  desc: 'Classical, concise'    },
    { id: 'ar.qurtubi',  name: 'Tafsir al-Qurtubi',   lang: 'العربية', rtl: true,  desc: 'Fiqh-focused, classical' },
    { id: 'en.jalalayn', name: 'Tafsir al-Jalalayn',  lang: 'English', rtl: false, desc: 'Classical, in English' },
    { id: 'en.maududi',  name: 'Tafhim-ul-Quran',     lang: 'English', rtl: false, desc: 'Maududi · accessible'  }
];

function getTafsirChoice() {
    try {
        var saved = localStorage.getItem(TAFSIR_KEY);
        if (!saved) return 'ar.muyassar';
        // Validate that it's still in our catalog
        if (TAFSIRS.find(function(t){ return t.id === saved; })) return saved;
        return 'ar.muyassar';
    } catch(e) { return 'ar.muyassar'; }
}

function setTafsirChoice(id) {
    try { localStorage.setItem(TAFSIR_KEY, String(id)); } catch(e) {}
}

function getTafsirCache() {
    try { return JSON.parse(localStorage.getItem(TAFSIR_CACHE) || '{}'); }
    catch(e) { return {}; }
}

function saveTafsirCache(c) {
    // LRU eviction if too large
    var keys = Object.keys(c);
    if (keys.length > TAFSIR_CACHE_MAX) {
        // Sort by lastAccessed asc, drop oldest 20%
        keys.sort(function(a, b) {
            return (c[a].t || 0) - (c[b].t || 0);
        });
        var dropCount = Math.floor(keys.length * 0.2);
        for (var i = 0; i < dropCount; i++) delete c[keys[i]];
    }
    try { localStorage.setItem(TAFSIR_CACHE, JSON.stringify(c)); } catch(e) {
        // Quota exceeded — drop half the cache and retry once
        try {
            var k = Object.keys(c);
            for (var j = 0; j < k.length / 2; j++) delete c[k[j]];
            localStorage.setItem(TAFSIR_CACHE, JSON.stringify(c));
        } catch(e2) {}
    }
}

function stripHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
}

function fetchTafsir(tafsirId, verseKey) {
    // verseKey format: "S:V" (1-indexed)
    // alquran.cloud endpoint: https://api.alquran.cloud/v1/ayah/{S:V}/{edition_slug}
    // Response: { code: 200, status: "OK", data: { number, text, edition, ... } }
    var cacheKey = tafsirId + '|' + verseKey;
    var cache = getTafsirCache();
    if (cache[cacheKey]) {
        cache[cacheKey].t = Date.now();
        saveTafsirCache(cache);
        return Promise.resolve(cache[cacheKey].text);
    }
    var url = 'https://api.alquran.cloud/v1/ayah/' + encodeURIComponent(verseKey) + '/' + encodeURIComponent(tafsirId);
    return fetch(url, { headers: { 'Accept': 'application/json' } })
        .then(function(resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        })
        .then(function(data) {
            if (!data || data.code !== 200 || !data.data) {
                throw new Error('Tafsir not available for this verse');
            }
            var text = data.data.text || '';
            if (!text) throw new Error('Empty tafsir response');
            cache[cacheKey] = { text: text, t: Date.now() };
            saveTafsirCache(cache);
            return text;
        });
}

function openTafsirModal(suraId, verseIdx, verseText, suraName) {
    track('tafsir_opened', { sura: parseInt(suraId) + 1, verse: verseIdx + 1 });

    var existing = document.getElementById('tafsirModal');
    if (existing) existing.remove();

    var tafsirId = getTafsirChoice();
    var tafsir = TAFSIRS.find(function(t){ return t.id === tafsirId; }) || TAFSIRS[0];
    var verseKey = (parseInt(suraId) + 1) + ':' + (verseIdx + 1);

    var overlay = document.createElement('div');
    overlay.id = 'tafsirModal';
    overlay.className = 'tafsir-modal-overlay';
    overlay.innerHTML =
        '<div class="tafsir-modal-box">' +
            '<div class="tafsir-modal-header">' +
                '<div class="tafsir-modal-title">' +
                    '<span class="tafsir-modal-icon">📚</span>' +
                    '<div class="tafsir-modal-title-text">' +
                        '<div class="tafsir-modal-verse">' + suraName + ' (' + verseKey + ')</div>' +
                        '<div class="tafsir-modal-source" id="tafsirSourceLabel">' + tafsir.name + ' · ' + tafsir.lang + '</div>' +
                    '</div>' +
                '</div>' +
                '<button class="tafsir-modal-close" id="tafsirCloseBtn">✕</button>' +
            '</div>' +
            '<div class="tafsir-modal-picker">' +
                '<label>Tafsir:</label>' +
                '<select id="tafsirPicker">' +
                    TAFSIRS.map(function(t) {
                        return '<option value="' + t.id + '"' + (t.id === tafsirId ? ' selected' : '') + '>' + t.name + ' (' + t.lang + ')</option>';
                    }).join('') +
                '</select>' +
            '</div>' +
            '<div class="tafsir-modal-verse-preview"' + (isArabicLanguage(suraId) ? ' dir="rtl"' : '') + '>' +
                escapeHtml(verseText) +
            '</div>' +
            '<div class="tafsir-modal-body" id="tafsirBody"' + (tafsir.rtl ? ' dir="rtl"' : '') + '>' +
                '<div class="tafsir-loading">' +
                    '<div class="tafsir-spinner"></div>' +
                    '<div>Loading tafsir…</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function() {
        overlay.classList.add('show');
    });

    // Close handlers
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeTafsirModal();
    });
    document.getElementById('tafsirCloseBtn').addEventListener('click', closeTafsirModal);

    // Picker change
    document.getElementById('tafsirPicker').addEventListener('change', function() {
        var newId = this.value;  // v10.3: string slug, not int
        setTafsirChoice(newId);
        var t2 = TAFSIRS.find(function(x){ return x.id === newId; });
        var src = document.getElementById('tafsirSourceLabel');
        if (src && t2) src.textContent = t2.name + ' · ' + t2.lang;
        var body = document.getElementById('tafsirBody');
        if (t2) body.dir = t2.rtl ? 'rtl' : 'ltr';
        loadTafsirContent(newId, verseKey);
    });

    // Load initial content
    loadTafsirContent(tafsirId, verseKey);

    // Keyboard close
    function escHandler(e) {
        if (e.key === 'Escape') {
            closeTafsirModal();
            document.removeEventListener('keydown', escHandler);
        }
    }
    document.addEventListener('keydown', escHandler);
}

function closeTafsirModal() {
    var m = document.getElementById('tafsirModal');
    if (m) {
        m.classList.remove('show');
        setTimeout(function() { if (m.parentNode) m.remove(); }, 200);
    }
}

function loadTafsirContent(tafsirId, verseKey) {
    var body = document.getElementById('tafsirBody');
    if (!body) return;
    body.innerHTML = '<div class="tafsir-loading"><div class="tafsir-spinner"></div><div>Loading tafsir…</div></div>';
    fetchTafsir(tafsirId, verseKey).then(function(text) {
        var bodyEl = document.getElementById('tafsirBody');
        if (!bodyEl) return;
        var safe = sanitizeTafsirHtml(text);
        bodyEl.innerHTML = safe;
    }).catch(function(err) {
        console.warn('[Tafsir] Failed:', err);
        var bodyEl = document.getElementById('tafsirBody');
        if (!bodyEl) return;
        // v10.4: Offer quick-pick of OTHER tafsirs (not the failed one)
        var alternatives = TAFSIRS.filter(function(t){ return t.id !== tafsirId; });
        var altHtml = '<div class="tafsir-error-alts">' +
                        '<div class="tafsir-error-alts-label">Try a different tafsir:</div>' +
                        alternatives.map(function(t) {
                            return '<button class="tafsir-alt-btn" data-tid="' + t.id + '">' +
                                       t.name + ' <span class="tafsir-alt-lang">' + t.lang + '</span>' +
                                   '</button>';
                        }).join('') +
                      '</div>';
        bodyEl.innerHTML =
            '<div class="tafsir-error">' +
                '<div class="tafsir-error-icon">⚠️</div>' +
                '<div class="tafsir-error-msg">Couldn\'t load this tafsir for this verse.</div>' +
                '<div class="tafsir-error-detail">It may not have content for this verse, or your network may be offline.</div>' +
                '<button class="tafsir-retry-btn">Retry</button>' +
                altHtml +
            '</div>';
        bodyEl.querySelector('.tafsir-retry-btn').addEventListener('click', function() {
            loadTafsirContent(tafsirId, verseKey);
        });
        // Wire alternative tafsir picker buttons
        bodyEl.querySelectorAll('.tafsir-alt-btn').forEach(function(b) {
            b.addEventListener('click', function() {
                var newId = this.getAttribute('data-tid');
                // Update the picker select to match
                var picker = document.getElementById('tafsirPicker');
                if (picker) picker.value = newId;
                setTafsirChoice(newId);
                var t2 = TAFSIRS.find(function(x){ return x.id === newId; });
                var src = document.getElementById('tafsirSourceLabel');
                if (src && t2) src.textContent = t2.name + ' · ' + t2.lang;
                var bodyEl2 = document.getElementById('tafsirBody');
                if (bodyEl2 && t2) bodyEl2.dir = t2.rtl ? 'rtl' : 'ltr';
                loadTafsirContent(newId, verseKey);
            });
        });
    });
}

function sanitizeTafsirHtml(html) {
    // Quran.com tafsir HTML is generally safe but let's strip <script> just in case
    var div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script, iframe, object, embed').forEach(function(el) { el.remove(); });
    // Strip any inline event handlers
    div.querySelectorAll('*').forEach(function(el) {
        for (var i = el.attributes.length - 1; i >= 0; i--) {
            var attr = el.attributes[i];
            if (attr.name.indexOf('on') === 0) el.removeAttribute(attr.name);
        }
    });
    return div.innerHTML;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function isArabicLanguage(suraId) {
    // Check if currentLanguage is arabic (rough check — assumes primary)
    return typeof currentLanguage !== 'undefined' && currentLanguage === 'arabic';
}

// ── Settings UI for tafsir ──
function appendTafsirUI(body) {
    if (!isFeatureOn('tafsir')) return;
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Tafsir (commentary)';
    sec.appendChild(lbl);

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-primary);margin-bottom:8px;opacity:0.78;line-height:1.4;';
    hint.textContent = 'Tap a verse → Save chooser → Tafsir to read classical commentary on that verse.';
    sec.appendChild(hint);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    var l = document.createElement('span');
    l.style.cssText = 'font-size:12px;color:var(--text-primary);opacity:0.85;flex-shrink:0;';
    l.textContent = 'Preferred:';
    var sel = document.createElement('select');
    sel.className = 'mob-settings-select';
    sel.style.flex = '1';
    TAFSIRS.forEach(function(t) {
        var opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name + ' (' + t.lang + ')';
        sel.appendChild(opt);
    });
    sel.value = getTafsirChoice();
    sel.addEventListener('change', function() {
        setTafsirChoice(this.value);
        showToast('Tafsir preference saved');
    });
    row.appendChild(l); row.appendChild(sel);
    sec.appendChild(row);

    // Clear cache button
    var clear = document.createElement('button');
    clear.className = 'mob-settings-btn';
    clear.style.cssText = 'margin-top:10px;background:#d9707018;border-color:#d9707040;color:#e08585;';
    clear.textContent = '🗑 Clear tafsir cache';
    clear.addEventListener('click', function() {
        try { localStorage.removeItem(TAFSIR_CACHE); } catch(e) {}
        showToast('Tafsir cache cleared');
    });
    sec.appendChild(clear);

    body.appendChild(sec);
}

// ── v10.3: Tafsir is now a standalone verse-action button (📚 Tafsir),
// no longer injected into the Save chooser. See buildVerseActions in script.js.

// ═══════════════════════════════════════════════════════════════════
// Inject Audio + Tafsir UI into settings (mobile sheet + desktop modal)
// ═══════════════════════════════════════════════════════════════════
(function injectPhase2bSettings() {
    function tryInject() {
        if (typeof buildSheetSettings === 'undefined') return false;
        if (window._phase2bSettingsInjected) return true;
        window._phase2bSettingsInjected = true;
        var origSheet = buildSheetSettings;
        window.buildSheetSettings = buildSheetSettings = function(body, title) {
            origSheet(body, title);
            appendAudioUI(body);
            appendTafsirUI(body);
        };
        if (typeof openFeaturesModal === 'function') {
            var origModal = openFeaturesModal;
            window.openFeaturesModal = function() {
                origModal();
                var body = document.getElementById('featuresModalBody');
                if (body) {
                    appendAudioUI(body);
                    appendTafsirUI(body);
                }
            };
        }
        return true;
    }
    if (!tryInject()) {
        var iv = setInterval(function() {
            if (tryInject()) clearInterval(iv);
        }, 200);
    }
}());

// ═══════════════════════════════════════════════════════════════════
// v10.3 — Verse tap-to-show actions (mobile-friendly hover replacement)
// ═══════════════════════════════════════════════════════════════════
(function verseTapToOpen() {
    document.addEventListener('click', function(e) {
        // Ignore clicks on buttons inside the verse — those have their own handlers
        if (e.target.closest('.verse-action-btn')) return;
        if (e.target.closest('.verse-chooser')) return;
        var verse = e.target.closest('.verse');
        if (!verse) {
            // Click outside any verse — close all open ones
            document.querySelectorAll('.verse.verse-actions-open').forEach(function(v) {
                v.classList.remove('verse-actions-open');
            });
            return;
        }
        // Toggle this verse, close others
        var isOpen = verse.classList.contains('verse-actions-open');
        document.querySelectorAll('.verse.verse-actions-open').forEach(function(v) {
            if (v !== verse) v.classList.remove('verse-actions-open');
        });
        if (!isOpen) verse.classList.add('verse-actions-open');
        else verse.classList.remove('verse-actions-open');
    });
}());

// ════════════════════════════════════════════════════════════════════
// v10.7 — EIGHT NEW FEATURES
// ════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────
// FEATURE 1: TOPICS / THEMES INDEX
// ──────────────────────────────────────────────────────────────────
// Curated list of themes with verse references (S:V format, 1-indexed)
const TOPICS = [
    { name: 'Patience (Sabr)',      icon: '🌱', verses: ['2:153', '2:155', '3:200', '8:46', '39:10', '94:5', '94:6', '70:5'] },
    { name: 'Mercy',                icon: '🕊', verses: ['6:54', '7:156', '21:107', '39:53', '42:5', '17:24'] },
    { name: 'Gratitude (Shukr)',    icon: '🌾', verses: ['2:152', '14:7', '16:78', '31:12', '39:7', '46:15'] },
    { name: 'Forgiveness',          icon: '🤲', verses: ['7:199', '24:22', '39:53', '42:40', '64:14', '3:135'] },
    { name: 'Charity (Sadaqah)',    icon: '🎁', verses: ['2:261', '2:267', '2:271', '9:60', '57:7', '64:16'] },
    { name: 'Parents',              icon: '👨\u200d👩\u200d👧', verses: ['17:23', '17:24', '29:8', '31:14', '31:15', '46:15'] },
    { name: 'Prayer (Salah)',       icon: '🕌', verses: ['2:43', '2:238', '4:103', '20:14', '29:45', '70:34'] },
    { name: 'Repentance (Tawbah)',  icon: '↩', verses: ['2:222', '4:17', '9:104', '24:31', '39:53', '66:8'] },
    { name: 'Hope',                 icon: '✨', verses: ['12:87', '15:56', '39:53', '94:5', '94:6', '65:7'] },
    { name: 'Trust in Allah',       icon: '⛰', verses: ['3:159', '8:2', '9:51', '11:123', '14:11', '65:3'] },
    { name: 'Knowledge',            icon: '📖', verses: ['20:114', '39:9', '58:11', '96:1', '96:4', '96:5'] },
    { name: 'Death & Afterlife',    icon: '🌌', verses: ['2:281', '3:185', '21:35', '29:57', '50:19', '56:60'] },
    { name: 'Justice',              icon: '⚖', verses: ['4:58', '4:135', '5:8', '5:42', '16:90', '49:9'] },
    { name: 'Honesty',              icon: '💬', verses: ['9:119', '33:70', '49:6', '49:12'] },
    { name: 'Trials & Tests',       icon: '🔥', verses: ['2:155', '2:156', '2:157', '29:2', '29:3', '67:2'] },
    { name: 'Faith (Iman)',         icon: '☀', verses: ['2:177', '49:14', '49:15', '8:2', '9:71'] },
    { name: 'Good Deeds',           icon: '🌿', verses: ['2:25', '2:82', '4:124', '16:97', '18:30', '99:7', '99:8'] },
    { name: 'Modesty (Haya)',       icon: '🕯', verses: ['24:30', '24:31', '33:32', '33:33'] },
    { name: 'Brotherhood',          icon: '🤝', verses: ['3:103', '49:10', '49:11', '49:13'] },
    { name: 'Wealth & Possessions', icon: '⚜', verses: ['18:46', '57:20', '63:9', '64:15', '102:1'] },
    { name: 'Marriage',             icon: '💍', verses: ['2:187', '4:19', '4:21', '7:189', '25:74', '30:21'] },
    { name: 'Orphans',              icon: '🌷', verses: ['2:220', '4:2', '4:6', '4:10', '93:9', '107:2'] },
    { name: 'Reflection (Tadabbur)',icon: '🧘', verses: ['3:191', '38:29', '47:24', '59:21'] },
    { name: 'Time',                 icon: '⏳', verses: ['3:185', '103:1', '103:2', '103:3'] },
    { name: 'Creation',             icon: '🌍', verses: ['2:117', '3:190', '36:36', '50:38', '51:47'] },
    { name: 'Allah\'s Names',       icon: '✦', verses: ['7:180', '20:8', '59:22', '59:23', '59:24'] },
    { name: 'Heart (Qalb)',         icon: '💛', verses: ['2:74', '13:28', '22:46', '47:24', '50:37'] },
    { name: 'Truth & Falsehood',    icon: '⚡', verses: ['17:81', '21:18', '34:49', '8:8'] },
    { name: 'Light (Nur)',          icon: '🌟', verses: ['24:35', '5:15', '5:16', '57:9', '57:28'] },
    { name: 'Paradise (Jannah)',    icon: '🌺', verses: ['2:25', '13:35', '32:17', '47:15', '56:10', '56:11', '56:12'] }
];

// v10.12: Topic name translations by primary language
const TOPIC_TRANSLATIONS = {
    french: {
        'Patience (Sabr)':       'Patience (Sabr)',
        'Mercy':                 'Miséricorde',
        'Gratitude (Shukr)':     'Gratitude (Shukr)',
        'Forgiveness':           'Pardon',
        'Charity (Sadaqah)':     'Charité (Sadaqah)',
        'Parents':               'Parents',
        'Prayer (Salah)':        'Prière (Salat)',
        'Repentance (Tawbah)':   'Repentir (Tawbah)',
        'Hope':                  'Espoir',
        'Trust in Allah':        'Confiance en Allah',
        'Knowledge':             'Connaissance',
        'Death & Afterlife':     'Mort & Au-delà',
        'Justice':               'Justice',
        'Honesty':               'Honnêteté',
        'Trials & Tests':        'Épreuves',
        'Faith (Iman)':          'Foi (Iman)',
        'Good Deeds':            'Bonnes actions',
        'Modesty (Haya)':        'Pudeur (Haya)',
        'Brotherhood':           'Fraternité',
        'Wealth & Possessions':  'Richesse & Biens',
        'Marriage':              'Mariage',
        'Orphans':               'Orphelins',
        'Reflection (Tadabbur)': 'Méditation (Tadabbur)',
        'Time':                  'Le Temps',
        'Creation':              'Création',
        "Allah's Names":         "Noms d'Allah",
        'Heart (Qalb)':          'Cœur (Qalb)',
        'Truth & Falsehood':     'Vérité & Mensonge',
        'Light (Nur)':           'Lumière (Nour)',
        'Paradise (Jannah)':     'Paradis (Jannah)'
    },
    spanish: {
        'Patience (Sabr)':       'Paciencia (Sabr)',
        'Mercy':                 'Misericordia',
        'Gratitude (Shukr)':     'Gratitud (Shukr)',
        'Forgiveness':           'Perdón',
        'Charity (Sadaqah)':     'Caridad (Sadaqah)',
        'Parents':               'Padres',
        'Prayer (Salah)':        'Oración (Salat)',
        'Repentance (Tawbah)':   'Arrepentimiento (Tawbah)',
        'Hope':                  'Esperanza',
        'Trust in Allah':        'Confianza en Allah',
        'Knowledge':             'Conocimiento',
        'Death & Afterlife':     'Muerte & Más allá',
        'Justice':               'Justicia',
        'Honesty':               'Honestidad',
        'Trials & Tests':        'Pruebas',
        'Faith (Iman)':          'Fe (Iman)',
        'Good Deeds':            'Buenas obras',
        'Modesty (Haya)':        'Modestia (Haya)',
        'Brotherhood':           'Hermandad',
        'Wealth & Possessions':  'Riqueza & Bienes',
        'Marriage':              'Matrimonio',
        'Orphans':               'Huérfanos',
        'Reflection (Tadabbur)': 'Reflexión (Tadabbur)',
        'Time':                  'El Tiempo',
        'Creation':              'Creación',
        "Allah's Names":         'Nombres de Allah',
        'Heart (Qalb)':          'Corazón (Qalb)',
        'Truth & Falsehood':     'Verdad & Falsedad',
        'Light (Nur)':           'Luz (Nour)',
        'Paradise (Jannah)':     'Paraíso (Jannah)'
    },
    arabic: {
        'Patience (Sabr)':       'الصبر',
        'Mercy':                 'الرحمة',
        'Gratitude (Shukr)':     'الشكر',
        'Forgiveness':           'المغفرة',
        'Charity (Sadaqah)':     'الصدقة',
        'Parents':               'الوالدان',
        'Prayer (Salah)':        'الصلاة',
        'Repentance (Tawbah)':   'التوبة',
        'Hope':                  'الأمل',
        'Trust in Allah':        'التوكل على الله',
        'Knowledge':             'العلم',
        'Death & Afterlife':     'الموت والآخرة',
        'Justice':               'العدل',
        'Honesty':               'الصدق',
        'Trials & Tests':        'الابتلاءات',
        'Faith (Iman)':          'الإيمان',
        'Good Deeds':            'الأعمال الصالحة',
        'Modesty (Haya)':        'الحياء',
        'Brotherhood':           'الأخوة',
        'Wealth & Possessions':  'المال والمتاع',
        'Marriage':              'الزواج',
        'Orphans':               'اليتامى',
        'Reflection (Tadabbur)': 'التدبر',
        'Time':                  'الزمن',
        'Creation':              'الخلق',
        "Allah's Names":         'أسماء الله الحسنى',
        'Heart (Qalb)':          'القلب',
        'Truth & Falsehood':     'الحق والباطل',
        'Light (Nur)':           'النور',
        'Paradise (Jannah)':     'الجنة'
    }
};

function getTopicName(englishName) {
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    if (lang === 'english') return englishName;
    var dict = TOPIC_TRANSLATIONS[lang];
    return (dict && dict[englishName]) || englishName;
}

function openTopicsModal() {
    if (!isFeatureOn('topicsIndex')) return;
    var existing = document.getElementById('topicsModal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'topicsModal';
    overlay.className = 'topics-modal-overlay';
    overlay.innerHTML =
        '<div class="topics-modal-box">' +
            '<div class="topics-modal-header">' +
                '<div class="topics-modal-title">' +
                    '<span class="topics-modal-icon">💡</span>' +
                    '<span>Topics</span>' +
                '</div>' +
                '<button class="topics-modal-close" id="topicsClose">✕</button>' +
            '</div>' +
            '<div class="topics-modal-subtitle">Browse verses by theme. Tap a topic to see its verses.</div>' +
            '<div class="topics-list" id="topicsList"></div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeTopicsModal();
    });
    document.getElementById('topicsClose').addEventListener('click', closeTopicsModal);

    var list = document.getElementById('topicsList');
    TOPICS.forEach(function(t, idx) {
        var item = document.createElement('button');
        item.className = 'topic-item';
        item.innerHTML =
            '<span class="topic-icon">' + t.icon + '</span>' +
            '<span class="topic-name">' + getTopicName(t.name) + '</span>' +
            '<span class="topic-count">' + t.verses.length + ' verses</span>';
        item.addEventListener('click', function() { openTopicVerses(idx); });
        list.appendChild(item);
    });
}

function closeTopicsModal() {
    var m = document.getElementById('topicsModal');
    if (m) {
        m.classList.remove('show');
        setTimeout(function(){ if (m.parentNode) m.remove(); }, 200);
    }
}

function openTopicVerses(topicIdx) {
    var topic = TOPICS[topicIdx]; if (!topic) return;
    // v10.12: If called from sidebar TOC tab, no modal exists yet — open it first
    var box = document.querySelector('#topicsModal .topics-modal-box');
    if (!box) {
        openTopicsModal();
        // Wait for modal to render, then drill into topic
        setTimeout(function() { openTopicVerses(topicIdx); }, 50);
        return;
    }
    var list = document.getElementById('topicsList');
    list.innerHTML = '<button class="topic-back" id="topicBackBtn">← All topics</button>' +
                     '<div class="topic-detail-title">' + topic.icon + ' ' + getTopicName(topic.name) + '</div>';
    topic.verses.forEach(function(ref) {
        var parts = ref.split(':');
        var sNum = parseInt(parts[0]);
        var vNum = parseInt(parts[1]);
        if (!sNum || !vNum) return;
        var sura = quranData.find(function(s){ return s.id === String(sNum - 1); });
        if (!sura || !sura.verses[vNum - 1]) return;
        var verse = sura.verses[vNum - 1];
        var card = document.createElement('button');
        card.className = 'topic-verse-card';
        card.innerHTML =
            '<div class="tvc-ref">' + sura.name + ' · ' + vNum + '</div>' +
            '<div class="tvc-text">' + escapeHtml(verse.text.length > 200 ? verse.text.slice(0, 200) + '…' : verse.text) + '</div>';
        card.addEventListener('click', function() {
            closeTopicsModal();
            if (typeof displaySingleSura === 'function') {
                displaySingleSura(sura.id);
                setTimeout(function() {
                    var container = document.getElementById('quranContainer');
                    var verses = container ? container.querySelectorAll('.verse') : [];
                    var target = verses[vNum - 1];
                    if (!target || !container) return;
                    // Scroll so the verse appears just below the sticky surah header,
                    // matching the normal reading experience.
                    var stickyEl = container.querySelector('.sura-sticky-title');
                    var stickyH = stickyEl ? stickyEl.offsetHeight : 52;
                    // Sum offsetTop values up to the container
                    var top = 0;
                    var el = target;
                    while (el && el !== container) { top += el.offsetTop; el = el.offsetParent; }
                    container.scrollTop = top - stickyH - 16;
                    target.classList.add('verse-flash');
                    setTimeout(function(){ target.classList.remove('verse-flash'); }, 1500);
                }, 350);
            }
        });
        list.appendChild(card);
    });
    document.getElementById('topicBackBtn').addEventListener('click', function() {
        openTopicsModal();
    });
}

// ──────────────────────────────────────────────────────────────────
// FEATURE 2: DAILY VERSE ON OPEN
// ──────────────────────────────────────────────────────────────────
const DAILY_VERSES = [
    '2:255',  // Ayat al-Kursi
    '2:286',  // Last verse of Al-Baqarah
    '13:28',  // Hearts find rest in remembrance of Allah
    '94:5',   // With hardship comes ease
    '39:53',  // Don't despair of Allah's mercy
    '65:2',   // Whoever fears Allah, He makes a way out
    '2:155',  // We will test you with fear and hunger
    '3:8',    // Don't let our hearts deviate
    '17:23',  // Don't say 'uff' to your parents
    '49:13',  // We made you nations to know each other
    '64:11',  // No calamity strikes except by Allah's permission
    '24:35',  // Allah is the Light of the heavens and earth
    '9:51',   // Nothing will befall us except what Allah has decreed
    '13:11',  // Allah doesn't change a people until they change themselves
    '2:152',  // Remember Me and I will remember you
    '7:199',  // Show forgiveness
    '20:114', // My Lord, increase me in knowledge
    '29:45',  // Prayer prevents immorality
    '2:286',  // Allah doesn't burden a soul beyond capacity
    '3:159',  // Be lenient
    '17:81',  // Truth has come and falsehood has perished
    '50:16',  // We are closer to him than his jugular vein
    '21:107', // We sent you only as mercy
    '6:54',   // Your Lord has prescribed mercy upon Himself
    '93:7',   // He found you lost and guided
    '93:11',  // Speak of the blessings of your Lord
    '2:216',  // You may dislike something that is good for you
    '57:20',  // Worldly life is play and amusement
    '3:185',  // Every soul will taste death
    '67:2'    // Created death and life to test you
];
const DAILY_VERSE_LAST_KEY = 'quranDailyVerseLast';

function showDailyVerseNow() {
    // Force-shows the daily verse regardless of feature-flag state (used from hamburger)
    var todayKey;
    try { todayKey = new Date().toISOString().slice(0, 10); } catch(e) { return; }
    var dayNum = parseInt(todayKey.replace(/-/g, ''), 10);
    var verseRef = DAILY_VERSES[dayNum % DAILY_VERSES.length];
    track('daily_verse_shown', { ref: verseRef, trigger: 'manual' });
    var parts = verseRef.split(':');
    var sNum = parseInt(parts[0]);
    var vNum = parseInt(parts[1]);
    var sura = (typeof quranData !== 'undefined') ? quranData.find(function(s){ return s.id === String(sNum - 1); }) : null;
    if (!sura || !sura.verses[vNum - 1]) {
        if (typeof showToast === 'function') showToast('🌅 Daily verse — load a surah first');
        return;
    }
    var verse = sura.verses[vNum - 1];
    var existing = document.getElementById('dailyVerseModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'dailyVerseModal';
    overlay.className = 'daily-verse-overlay';
    overlay.innerHTML =
        '<div class="daily-verse-box">' +
            '<div class="daily-verse-header">' +
                '<span class="dv-ornament">✦</span>' +
                '<span class="dv-label">Today\'s verse</span>' +
                '<span class="dv-ornament">✦</span>' +
            '</div>' +
            '<div class="daily-verse-text" dir="rtl">' + verse.text + '</div>' +
            '<div class="daily-verse-ref">' + sura.name + ' · ' + sNum + ':' + vNum + '</div>' +
            '<div class="daily-verse-actions">' +
                '<button class="dv-btn-secondary" id="dvDismiss2">Close</button>' +
                '<button class="dv-btn-primary" id="dvGoToVerse2">Read this verse →</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });

    function close() {
        overlay.classList.remove('show');
        setTimeout(function(){ if (overlay.parentNode) overlay.remove(); }, 200);
    }
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.getElementById('dvDismiss2').addEventListener('click', close);
    document.getElementById('dvGoToVerse2').addEventListener('click', function() {
        close();
        if (typeof displaySingleSura === 'function') {
            displaySingleSura(sura.id);
            setTimeout(function() {
                var verses = document.querySelectorAll('.sura .verse');
                if (verses[vNum - 1]) {
                    verses[vNum - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    verses[vNum - 1].classList.add('verse-flash');
                    setTimeout(function(){ verses[vNum - 1].classList.remove('verse-flash'); }, 1500);
                }
            }, 300);
        }
    });
}

function maybeShowDailyVerse() {
    if (!isFeatureOn('dailyVerse')) return;
    var todayKey;
    try { todayKey = new Date().toISOString().slice(0, 10); } catch(e) { return; }
    var last;
    try { last = localStorage.getItem(DAILY_VERSE_LAST_KEY); } catch(e) {}
    if (last === todayKey) return; // already shown today

    // Deterministic verse per day
    var dayNum = parseInt(todayKey.replace(/-/g, ''), 10);
    var verseRef = DAILY_VERSES[dayNum % DAILY_VERSES.length];
    var parts = verseRef.split(':');
    var sNum = parseInt(parts[0]);
    var vNum = parseInt(parts[1]);
    var sura = quranData.find(function(s){ return s.id === String(sNum - 1); });
    if (!sura || !sura.verses[vNum - 1]) return;
    var verse = sura.verses[vNum - 1];

    try { localStorage.setItem(DAILY_VERSE_LAST_KEY, todayKey); } catch(e) {}
    track('daily_verse_shown', { ref: verseRef, trigger: 'auto' });

    var overlay = document.createElement('div');
    overlay.id = 'dailyVerseModal';
    overlay.className = 'daily-verse-overlay';
    overlay.innerHTML =
        '<div class="daily-verse-box">' +
            '<div class="daily-verse-header">' +
                '<span class="dv-ornament">✦</span>' +
                '<span class="dv-label">Today\'s verse</span>' +
                '<span class="dv-ornament">✦</span>' +
            '</div>' +
            '<div class="daily-verse-text" dir="rtl">' + verse.text + '</div>' +
            '<div class="daily-verse-ref">' + sura.name + ' · ' + sNum + ':' + vNum + '</div>' +
            '<div class="daily-verse-actions">' +
                '<button class="dv-btn-secondary" id="dvDismiss">Maybe later</button>' +
                '<button class="dv-btn-primary" id="dvGoToVerse">Read this verse →</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });

    function close() {
        overlay.classList.remove('show');
        setTimeout(function(){ if (overlay.parentNode) overlay.remove(); }, 200);
    }
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) close();
    });
    document.getElementById('dvDismiss').addEventListener('click', close);
    document.getElementById('dvGoToVerse').addEventListener('click', function() {
        close();
        if (typeof displaySingleSura === 'function') {
            displaySingleSura(sura.id);
            setTimeout(function() {
                var verses = document.querySelectorAll('.sura .verse');
                if (verses[vNum - 1]) {
                    verses[vNum - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    verses[vNum - 1].classList.add('verse-flash');
                    setTimeout(function(){ verses[vNum - 1].classList.remove('verse-flash'); }, 1500);
                }
            }, 300);
        }
    });
}

// ──────────────────────────────────────────────────────────────────
// FEATURE 3: REFLECTION PROMPTS (end of surah)
// ──────────────────────────────────────────────────────────────────
const REFLECTION_QUESTIONS = [
    'What stood out to you in this surah?',
    'Which verse would you like to memorize?',
    'How can you apply something from this surah today?',
    'What attribute of Allah did you notice in this surah?',
    'What did this surah remind you of from your own life?',
    'If you had to share one verse with a friend, which would it be?',
    'What question does this surah raise in your heart?'
];
const REFLECTIONS_KEY = 'quranReflections';
const _reflectionShownThisSession = {};

function getReflections() {
    try { return JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || '{}'); }
    catch(e) { return {}; }
}
function saveReflection(suraId, text) {
    var refs = getReflections();
    if (text && text.trim()) {
        refs[String(suraId)] = { text: text.trim(), ts: Date.now() };
    } else {
        delete refs[String(suraId)];
    }
    try { localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(refs)); } catch(e) {}
    // v10.11: Refresh saved hub so the reflection appears/disappears immediately
    if (typeof refreshSavedHub === 'function') refreshSavedHub();
}

function maybeShowReflectionPrompt(suraId) {
    if (!isFeatureOn('reflectionPrompts')) return;
    if (_reflectionShownThisSession[suraId]) return;
    _reflectionShownThisSession[suraId] = true;
    // v10.11: Don't trigger if any other modal/sheet is currently open
    if (document.getElementById('mobileSheet') && document.getElementById('mobileSheet').classList.contains('show')) return;
    if (document.getElementById('featuresModal') && document.getElementById('featuresModal').classList.contains('show')) return;
    if (document.getElementById('tafsirModal')) return;
    if (document.getElementById('tafsirCompareModal')) return;
    if (document.getElementById('topicsModal')) return;
    if (document.getElementById('readingPlanModal')) return;
    if (document.getElementById('noteModal') && document.getElementById('noteModal').classList.contains('show')) return;
    openReflectionModal(suraId);
}

// v10.11: Always-open variant (used by Saved hub click to edit)
function openReflectionModal(suraId) {
    var sura = quranData.find(function(s){ return s.id === String(suraId); });
    if (!sura) return;
    // Close any existing reflection modal first
    var existingModal = document.getElementById('reflectionModal');
    if (existingModal) existingModal.remove();

    var questions = (typeof getReflectionQuestions === 'function') ? getReflectionQuestions() : REFLECTION_QUESTIONS;
    var labels = (typeof getReflectionLabels === 'function') ? getReflectionLabels() : { reflection: 'Reflection', placeholder: 'Take a moment to write a thought…', skip: 'Not now', save: 'Save reflection', saved: '✓ Reflection saved', cleared: 'Cleared' };
    var qIdx = (parseInt(suraId) + new Date().getDate()) % questions.length;
    var question = questions[qIdx];
    var existing = getReflections()[String(suraId)];
    var isRtl = (typeof currentLanguage !== 'undefined' && currentLanguage === 'arabic');

    var overlay = document.createElement('div');
    overlay.id = 'reflectionModal';
    overlay.className = 'reflection-overlay';
    if (isRtl) overlay.setAttribute('dir', 'rtl');
    overlay.innerHTML =
        '<div class="reflection-box">' +
            '<div class="reflection-header">' +
                '<span class="reflection-icon">\u270d\ufe0f</span>' +
                '<span class="reflection-label">' + labels.reflection + ' \u2014 ' + sura.name + '</span>' +
                '<button class="reflection-close" id="reflectionClose">\u2715</button>' +
            '</div>' +
            '<div class="reflection-question">' + question + '</div>' +
            '<textarea class="reflection-textarea" id="reflectionTextarea" placeholder="' + labels.placeholder + '">' +
                (existing ? escapeHtml(existing.text) : '') +
            '</textarea>' +
            '<div class="reflection-actions">' +
                '<button class="reflection-skip" id="reflectionSkip">' + labels.skip + '</button>' +
                '<button class="reflection-save" id="reflectionSave">' + labels.save + '</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });

    function close() {
        overlay.classList.remove('show');
        setTimeout(function(){ if (overlay.parentNode) overlay.remove(); }, 200);
    }
    document.getElementById('reflectionClose').addEventListener('click', close);
    document.getElementById('reflectionSkip').addEventListener('click', close);
    document.getElementById('reflectionSave').addEventListener('click', function() {
        var text = document.getElementById('reflectionTextarea').value;
        saveReflection(suraId, text);
        if (text.trim()) track('reflection_saved', { sura: parseInt(suraId) + 1 });
        if (typeof showToast === 'function') showToast(text.trim() ? labels.saved : labels.cleared);
        close();
    });
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) close();
    });
}

// Hook into surah scroll to detect "reached bottom"
(function hookReflectionTrigger() {
    function attach() {
        var container = document.getElementById('quranContainer');
        if (!container || container._reflectionHooked) return;
        container._reflectionHooked = true;
        container.addEventListener('scroll', function() {
            if (!isFeatureOn('reflectionPrompts')) return;
            var nearBottom = (container.scrollTop + container.clientHeight) >= (container.scrollHeight - 80);
            if (!nearBottom) return;
            var suraEl = container.querySelector('.sura');
            if (!suraEl) return;
            var suraId = suraEl.id;
            // Wait a beat to avoid showing during rapid scroll
            clearTimeout(container._refTimer);
            container._refTimer = setTimeout(function() {
                if (document.getElementById('reflectionModal')) return;
                maybeShowReflectionPrompt(suraId);
            }, 800);
        }, { passive: true });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
    setTimeout(attach, 500);
}());

// ──────────────────────────────────────────────────────────────────
// FEATURE 7: HIJRI CALENDAR AWARENESS
// ──────────────────────────────────────────────────────────────────
// Uses the browser's Intl API with the Umm al-Qura calendar (the
// official Islamic calendar reference). Falls back to the arithmetic
// approximation on very old browsers.
function gregorianToHijri(g) {
    try {
        var fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
            day: 'numeric', month: 'numeric', year: 'numeric'
        });
        var parts = fmt.formatToParts(g);
        var d = {};
        parts.forEach(function(p) {
            if (p.type === 'day')   d.day   = parseInt(p.value, 10);
            if (p.type === 'month') d.month = parseInt(p.value, 10);
            if (p.type === 'year')  d.year  = parseInt(p.value, 10);
        });
        if (d.day && d.month && d.year) return d;
    } catch(e) {}
    // Arithmetic fallback (±1-2 day approximation)
    var jd = Math.floor((g.getTime() / 86400000) + 2440587.5);
    var l = jd - 1948440 + 10632;
    var n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    var j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) +
            (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) -
            (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    var month = Math.floor((24 * l) / 709);
    var day = l - Math.floor((709 * month) / 24);
    var year = 30 * n + j - 30;
    return { day: day, month: month, year: year };
}

const HIJRI_MONTHS = [
    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal',
    'Jumada al-Thani', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal',
    'Dhu al-Qadah', 'Dhu al-Hijjah'
];

function getTodayHijri() { return gregorianToHijri(new Date()); }
function formatHijri(h) {
    return h.day + ' ' + HIJRI_MONTHS[h.month - 1] + ' ' + h.year + ' AH';
}
function getHijriSpecialDate(h) {
    if (h.month === 1 && h.day === 1) return { name: 'Islamic New Year', icon: '🌙' };
    if (h.month === 1 && h.day === 10) return { name: 'Day of Ashura', icon: '🕯' };
    if (h.month === 3 && h.day === 12) return { name: 'Mawlid an-Nabi', icon: '✦' };
    if (h.month === 7 && h.day === 27) return { name: 'Laylat al-Mi\'raj (likely)', icon: '✦' };
    if (h.month === 8 && h.day === 15) return { name: 'Laylat al-Bara\'ah', icon: '✦' };
    if (h.month === 9) {
        if (h.day === 1) return { name: 'First day of Ramadan', icon: '🌙' };
        // Last 10 nights — odd nights are the likely candidates for Laylat al-Qadr
        if (h.day === 21 || h.day === 23 || h.day === 25 || h.day === 29) {
            return { name: 'Last 10 of Ramadan · possible Laylat al-Qadr · day ' + h.day, icon: '⭐' };
        }
        if (h.day === 27) return { name: 'Laylat al-Qadr (most likely) · 27 Ramadan', icon: '⭐' };
        if (h.day >= 20) return { name: 'Last 10 of Ramadan · day ' + h.day, icon: '🌙' };
        return { name: 'Ramadan · day ' + h.day, icon: '🌙' };
    }
    if (h.month === 10 && h.day === 1) return { name: 'Eid al-Fitr', icon: '🎉' };
    if (h.month === 10 && h.day === 2) return { name: 'Eid al-Fitr · day 2', icon: '🎉' };
    if (h.month === 10 && h.day === 3) return { name: 'Eid al-Fitr · day 3', icon: '🎉' };
    if (h.month === 12) {
        // Hajj season — multi-day pilgrimage 8-13 Dhul-Hijjah
        if (h.day >= 1 && h.day <= 7) return { name: 'Dhul-Hijjah · first 10 days · day ' + h.day, icon: '⛰' };
        if (h.day === 8) return { name: 'Yawm at-Tarwiyah · Hajj begins', icon: '⛰' };
        if (h.day === 9) return { name: 'Day of Arafah · climax of Hajj', icon: '⛰' };
        if (h.day === 10) return { name: 'Eid al-Adha · 10 Dhul-Hijjah', icon: '🎉' };
        if (h.day >= 11 && h.day <= 13) return { name: 'Days of Tashriq · Hajj · day ' + h.day, icon: '⛰' };
    }
    return null;
}

function appendHijriBadge() {
    // Prefer the API-fetched date (window._hijriToday) so badge matches the displayed date.
    // Fall back to the local approximation only when the API hasn't responded yet.
    var h = window._hijriToday || getTodayHijri();
    var label = formatHijri(h);
    var special = getHijriSpecialDate(h);
    var bannerHost = document.querySelector('.settings-meditation');
    if (!bannerHost || bannerHost.querySelector('.hijri-badge')) return;
    var badge = document.createElement('div');
    badge.className = 'hijri-badge';
    if (special) {
        badge.innerHTML = '<span class="hijri-icon">' + special.icon + '</span>' +
                          '<span class="hijri-text"><strong>' + special.name + '</strong> · ' + label + '</span>';
        badge.classList.add('hijri-badge-special');
    } else {
        badge.innerHTML = '<span class="hijri-icon">🌙</span><span class="hijri-text">' + label + '</span>';
    }
    bannerHost.appendChild(badge);
}

// ──────────────────────────────────────────────────────────────────
// FEATURE 9: VERSE COMPARISON VIEW (compare all tafsirs)
// ──────────────────────────────────────────────────────────────────
function openTafsirComparison(suraId, verseIdx, verseText, suraName) {
    if (!isFeatureOn('verseComparison')) return;
    var existing = document.getElementById('tafsirCompareModal');
    if (existing) existing.remove();
    var verseKey = (parseInt(suraId) + 1) + ':' + (verseIdx + 1);

    var overlay = document.createElement('div');
    overlay.id = 'tafsirCompareModal';
    overlay.className = 'tafsir-compare-overlay';
    overlay.innerHTML =
        '<div class="tafsir-compare-box">' +
            '<div class="tafsir-compare-header">' +
                '<span class="tafsir-compare-title">🔀 Comparing all tafsirs · ' + suraName + ' (' + verseKey + ')</span>' +
                '<button class="tafsir-compare-close" id="tafsirCompareClose">✕</button>' +
            '</div>' +
            '<div class="tafsir-compare-verse" dir="rtl">' + escapeHtml(verseText) + '</div>' +
            '<div class="tafsir-compare-body" id="tafsirCompareBody"></div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeTafsirCompare();
    });
    document.getElementById('tafsirCompareClose').addEventListener('click', closeTafsirCompare);

    var body = document.getElementById('tafsirCompareBody');
    // Render a card per tafsir; load each in parallel
    TAFSIRS.forEach(function(t) {
        var card = document.createElement('div');
        card.className = 'tafsir-compare-card';
        card.innerHTML =
            '<div class="tcc-header">' +
                '<span class="tcc-name">' + t.name + '</span>' +
                '<span class="tcc-lang">' + t.lang + '</span>' +
            '</div>' +
            '<div class="tcc-content" dir="' + (t.rtl ? 'rtl' : 'ltr') + '"><div class="tafsir-spinner-small"></div></div>';
        body.appendChild(card);
        var content = card.querySelector('.tcc-content');
        fetchTafsir(t.id, verseKey).then(function(text) {
            content.innerHTML = sanitizeTafsirHtml(text);
        }).catch(function(err) {
            content.innerHTML = '<span class="tcc-error">Couldn\'t load this tafsir for this verse.</span>';
        });
    });
}

function closeTafsirCompare() {
    var m = document.getElementById('tafsirCompareModal');
    if (m) {
        m.classList.remove('show');
        setTimeout(function(){ if (m.parentNode) m.remove(); }, 200);
    }
}

// Inject "Compare all" button into the tafsir modal header
(function injectCompareButton() {
    var origOpen = window.openTafsirModal;
    if (typeof origOpen !== 'function') return;
    window.openTafsirModal = function(suraId, verseIdx, verseText, suraName) {
        origOpen(suraId, verseIdx, verseText, suraName);
        if (!isFeatureOn('verseComparison')) return;
        setTimeout(function() {
            var header = document.querySelector('#tafsirModal .tafsir-modal-header');
            if (!header || header.querySelector('.tafsir-compare-btn')) return;
            var btn = document.createElement('button');
            btn.className = 'tafsir-compare-btn';
            btn.innerHTML = '🔀 Compare all';
            btn.title = 'Show all tafsirs side by side';
            btn.addEventListener('click', function() {
                closeTafsirModal();
                openTafsirComparison(suraId, verseIdx, verseText, suraName);
            });
            // Insert before close button
            var closeBtn = header.querySelector('.tafsir-modal-close');
            header.insertBefore(btn, closeBtn);
        }, 50);
    };
}());

// ──────────────────────────────────────────────────────────────────
// FEATURE 10: PRINT / PDF EXPORT
// ──────────────────────────────────────────────────────────────────
function printCurrentSurah() {
    if (!isFeatureOn('pdfExport')) return;
    var suraEl = document.querySelector('.sura');
    if (!suraEl) {
        if (typeof showToast === 'function') showToast('Open a surah first');
        return;
    }
    var suraId = suraEl.id;
    var sura = quranData.find(function(s){ return s.id === String(suraId); });
    if (!sura) return;

    track('print_exported', { sura: parseInt(suraId) + 1 });
    // Build a clean print body
    document.body.classList.add('printing-surah');
    // Inject a print-only "user notes" panel if reflection or notes exist for this surah
    var oldPanel = document.getElementById('printNotesPanel');
    if (oldPanel) oldPanel.remove();
    var panel = document.createElement('div');
    panel.id = 'printNotesPanel';
    panel.className = 'print-only-block';
    var refl = getReflections()[String(suraId)];
    var hasContent = false;
    var html = '<h3>Your reflections & notes</h3>';
    if (refl) {
        html += '<div class="print-reflection"><strong>Reflection:</strong> ' + escapeHtml(refl.text) + '</div>';
        hasContent = true;
    }
    // Per-verse notes
    var notes = (typeof getNotes === 'function') ? getNotes() : {};
    sura.verses.forEach(function(v, i) {
        var n = notes[suraId + ':' + i];
        if (n) {
            html += '<div class="print-note">Verse ' + (i + 1) + ': ' + escapeHtml(n) + '</div>';
            hasContent = true;
        }
    });
    if (hasContent) {
        panel.innerHTML = html;
        document.querySelector('.sura').appendChild(panel);
    }

    setTimeout(function() {
        window.print();
        // Cleanup after print dialog
        setTimeout(function() {
            document.body.classList.remove('printing-surah');
            var p = document.getElementById('printNotesPanel');
            if (p) p.remove();
        }, 500);
    }, 100);
}

// ──────────────────────────────────────────────────────────────────
// FEATURE 11: READING TIME ANALYTICS
// ──────────────────────────────────────────────────────────────────
const READING_TIME_KEY = 'quranReadingTime';
var _readingTimeStart = null;

function getReadingTime() {
    try { return JSON.parse(localStorage.getItem(READING_TIME_KEY) || '{}'); }
    catch(e) { return {}; }
}
function saveReadingTime(data) {
    try { localStorage.setItem(READING_TIME_KEY, JSON.stringify(data)); } catch(e) {}
}
function getCurrentWeekKey() {
    var d = new Date();
    // ISO week start (Monday)
    var dayNum = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayNum);
    return d.toISOString().slice(0, 10);
}

function startReadingTimer() {
    if (_readingTimeStart) return;
    _readingTimeStart = Date.now();
}
function stopReadingTimer() {
    if (!_readingTimeStart) return;
    var elapsed = Date.now() - _readingTimeStart;
    _readingTimeStart = null;
    if (elapsed < 1000) return;
    var minutes = elapsed / 60000;
    var data = getReadingTime();
    var weekKey = getCurrentWeekKey();
    data[weekKey] = (data[weekKey] || 0) + minutes;
    saveReadingTime(data);
}

function flushReadingTimer() {
    if (!_readingTimeStart) return;
    stopReadingTimer();
    startReadingTimer();
}

(function wireReadingTimer() {
    function init() {
        startReadingTimer();
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) stopReadingTimer();
            else startReadingTimer();
        });
        window.addEventListener('beforeunload', stopReadingTimer);
        window.addEventListener('pagehide', stopReadingTimer);
        // Periodic flush every 30s so data is saved even if page never hides
        setInterval(function() {
            if (!document.hidden) flushReadingTimer();
        }, 30000);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());

function fmtTime(min) {
    var m = Math.round(min);
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return h + ':' + (mm < 10 ? '0' + mm : mm);
}

function getReadingTimeSummary() {
    var data = getReadingTime();
    var thisWeek = data[getCurrentWeekKey()] || 0;
    // Compute current session's running time
    if (_readingTimeStart) {
        thisWeek += (Date.now() - _readingTimeStart) / 60000;
    }
    // Average over last 4 weeks
    var weeks = Object.keys(data).sort().slice(-4);
    var total = 0;
    weeks.forEach(function(k){ total += data[k] || 0; });
    return { thisWeek: Math.round(thisWeek), avg4w: weeks.length > 0 ? Math.round(total / weeks.length) : 0 };
}

// ──────────────────────────────────────────────────────────────────
// FEATURE 12: VOICE SEARCH
// ──────────────────────────────────────────────────────────────────
function getSpeechRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function attachVoiceSearchButton(inputEl) {
    if (!isFeatureOn('voiceSearch')) return;
    if (!inputEl || inputEl._voiceAttached) return;
    var Rec = getSpeechRecognition();
    if (!Rec) return; // browser doesn't support
    inputEl._voiceAttached = true;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'voice-search-btn';
    btn.title = 'Voice search';
    btn.innerHTML = '🎤';
    // Insert next to the input (sibling)
    if (inputEl.parentNode) {
        inputEl.parentNode.insertBefore(btn, inputEl.nextSibling);
    }
    btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var recognition = new Rec();
        // Pick recognition language from current primary
        var langMap = { arabic: 'ar-SA', french: 'fr-FR', english: 'en-US', spanish: 'es-ES' };
        recognition.lang = langMap[currentLanguage] || 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        btn.classList.add('voice-listening');
        recognition.onresult = function(ev) {
            var text = ev.results[0][0].transcript;
            inputEl.value = text;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            // For search inputs that require Enter
            inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
        };
        recognition.onerror = function(ev) {
            console.warn('Voice search error:', ev.error);
            if (typeof showToast === 'function') showToast('Voice: ' + ev.error);
        };
        recognition.onend = function() {
            btn.classList.remove('voice-listening');
        };
        try {
            recognition.start();
        } catch(err) {
            btn.classList.remove('voice-listening');
            console.warn('Voice search start failed:', err);
        }
    });
}

// Attach voice button to all known search inputs
(function attachVoiceToSearches() {
    function attach() {
        if (!isFeatureOn('voiceSearch')) return;
        ['search-input', 'mob-search-input'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) attachVoiceSearchButton(el);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
    setTimeout(attach, 500);
    setTimeout(attach, 1500); // mobile inputs may be built dynamically
}());

// ──────────────────────────────────────────────────────────────────
// HOOKS: Run features that need quranData on load
// ──────────────────────────────────────────────────────────────────
(function v107InitHooks() {
    var tries = 0;
    var iv = setInterval(function() {
        tries++;
        if (typeof quranData !== 'undefined' && quranData.length > 0) {
            clearInterval(iv);
            setTimeout(function() {
                maybeShowDailyVerse();
                appendHijriBadge();
            }, 1200);
        } else if (tries > 100) {
            clearInterval(iv);
        }
    }, 200);
}());

// ════════════════════════════════════════════════════════════════════
// v10.7 — Settings UI integration
// ════════════════════════════════════════════════════════════════════
function appendV107SettingsUI(body) {
    // v10.12: Topics moved to the Surahs sheet (mobile) and TOC tab (desktop) —
    // removed from Settings to avoid duplication. Print stays as a quick action.
    if (!isFeatureOn('pdfExport')) {
        return; // nothing to add
    }
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Quick actions';
    sec.appendChild(lbl);

    var printBtn = document.createElement('button');
    printBtn.className = 'mob-settings-btn';
    printBtn.textContent = '🖨 Print / Export this surah';
    printBtn.addEventListener('click', function() {
        if (typeof closeMobileSheet === 'function') closeMobileSheet();
        setTimeout(printCurrentSurah, 300);
    });
    sec.appendChild(printBtn);

    body.appendChild(sec);
    // v10.12: Reading-time section moved to appendReadingPlanUI (lives right under Reading Plan)
}

// Inject the v10.7 settings UI into both mobile sheet and desktop modal
(function injectV107SettingsUI() {
    function tryInject() {
        if (typeof buildSheetSettings === 'undefined') return false;
        if (window._v107SettingsInjected) return true;
        window._v107SettingsInjected = true;
        var origSheet = buildSheetSettings;
        window.buildSheetSettings = buildSheetSettings = function(body, title) {
            origSheet(body, title);
            appendV107SettingsUI(body);
        };
        if (typeof openFeaturesModal === 'function') {
            var origModal = openFeaturesModal;
            window.openFeaturesModal = function() {
                origModal();
                var body = document.getElementById('featuresModalBody');
                if (body) appendV107SettingsUI(body);
            };
        }
        return true;
    }
    if (!tryInject()) {
        var iv = setInterval(function() {
            if (tryInject()) clearInterval(iv);
        }, 200);
    }
}());

// Reactive toggle handlers for the v10.7 features
(function v107ReactiveToggles() {
    document.addEventListener('change', function(e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains('feature-toggle-input')) return;
        var key = e.target.getAttribute('data-feature-key');
        if (key === 'dailyVerse' && e.target.checked) {
            // If enabled now, allow showing today's verse on next page load
            // (don't show immediately — feels intrusive mid-session)
        }
        if (key === 'hijriAwareness') {
            // Remove existing badge if disabling, or add if enabling
            var existing = document.querySelector('.hijri-badge');
            if (existing) existing.remove();
            if (e.target.checked) setTimeout(appendHijriBadge, 100);
        }
        if (key === 'voiceSearch' && e.target.checked) {
            ['search-input', 'mob-search-input'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) attachVoiceSearchButton(el);
            });
        }
        if (key === 'voiceSearch' && !e.target.checked) {
            document.querySelectorAll('.voice-search-btn').forEach(function(b){ b.remove(); });
            document.querySelectorAll('input[id*="search"]').forEach(function(i){ delete i._voiceAttached; });
        }
        if (key === 'topicsIndex' && !e.target.checked) {
            closeTopicsModal();
        }
    });
}());

// ════════════════════════════════════════════════════════════════════
// v10.8 — Reactive feature gating via body classes
// CSS rules hide gated elements; flipping the body class is instant
// ════════════════════════════════════════════════════════════════════
function applyFeatureBodyClasses() {
    var f = getFeatures();
    var body = document.body;
    var pairs = [
        ['saveTools',         'feature-off-savetools'],
        ['copyShareVerse',    'feature-off-share'],
        ['tafsir',            'feature-off-tafsir'],
        ['focusMode',         'feature-off-focusmode'],
        ['audioRecitation',   'feature-off-audio'],
        ['voiceSearch',       'feature-off-voice'],
        ['topicsIndex',       'feature-off-topics'],
        ['pdfExport',         'feature-off-print'],
        ['readingTimeAnalytics','feature-off-readingtime'],
        ['hijriAwareness',    'feature-off-hijri'],
        ['khatmTracker',      'feature-off-khatm']
    ];
    pairs.forEach(function(p) {
        body.classList.toggle(p[1], !f[p[0]]);
    });
}

// Apply on init and on every toggle change
(function wireFeatureBodyClasses() {
    function init() {
        applyFeatureBodyClasses();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    // Refresh after every feature toggle (listen at the document level so we catch all)
    document.addEventListener('change', function(e) {
        // Toggle inputs live inside .feature-toggle-row
        if (e.target && e.target.type === 'checkbox' && e.target.closest('.feature-toggle-row')) {
            setTimeout(applyFeatureBodyClasses, 50);
        }
    });
}());

// v10.8: Reset reflection session flag so toggle ON works immediately
(function reflectionResetOnToggle() {
    document.addEventListener('change', function(e) {
        if (!e.target || e.target.type !== 'checkbox') return;
        if (!e.target.closest('.feature-toggle-row')) return;
        var f = getFeatures();
        if (!f.reflectionPrompts) return;
        // Clear session flags so reflection can re-trigger
        if (typeof _reflectionShownThisSession !== 'undefined') {
            Object.keys(_reflectionShownThisSession).forEach(function(k){ delete _reflectionShownThisSession[k]; });
        }
        // If we're near the bottom of a surah right now, trigger immediately
        setTimeout(function() {
            var container = document.getElementById('quranContainer');
            if (!container) return;
            var nearBottom = (container.scrollTop + container.clientHeight) >= (container.scrollHeight - 80);
            if (!nearBottom) return;
            var suraEl = container.querySelector('.sura');
            if (!suraEl) return;
            if (typeof maybeShowReflectionPrompt === 'function') maybeShowReflectionPrompt(suraEl.id);
        }, 200);
    });
}());

// v10.8: Reflection questions in all supported languages
const REFLECTION_QUESTIONS_BY_LANG = {
    english: [
        'What stood out to you in this surah?',
        'Which verse would you like to memorize?',
        'How can you apply something from this surah today?',
        'What attribute of Allah did you notice in this surah?',
        'What did this surah remind you of from your own life?',
        'If you had to share one verse with a friend, which would it be?',
        'What question does this surah raise in your heart?'
    ],
    french: [
        'Qu\'est-ce qui vous a marqué dans cette sourate ?',
        'Quel verset aimeriez-vous mémoriser ?',
        'Comment pouvez-vous appliquer quelque chose de cette sourate aujourd\'hui ?',
        'Quel attribut d\'Allah avez-vous remarqué dans cette sourate ?',
        'Que cette sourate vous a-t-elle rappelé de votre propre vie ?',
        'Si vous deviez partager un verset avec un ami, lequel serait-ce ?',
        'Quelle question cette sourate soulève-t-elle dans votre cœur ?'
    ],
    spanish: [
        '\u00bfQu\u00e9 te llam\u00f3 la atenci\u00f3n en esta sura?',
        '\u00bfQu\u00e9 vers\u00edculo te gustar\u00eda memorizar?',
        '\u00bfC\u00f3mo puedes aplicar algo de esta sura hoy?',
        '\u00bfQu\u00e9 atributo de Allah notaste en esta sura?',
        '\u00bfQu\u00e9 te record\u00f3 esta sura de tu propia vida?',
        'Si tuvieras que compartir un vers\u00edculo con un amigo, \u00bfcu\u00e1l ser\u00eda?',
        '\u00bfQu\u00e9 pregunta plantea esta sura en tu coraz\u00f3n?'
    ],
    arabic: [
        '\u0645\u0627 \u0627\u0644\u0630\u064a \u0644\u0641\u062a \u0627\u0646\u062a\u0628\u0627\u0647\u0643 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0633\u0648\u0631\u0629\u061f',
        '\u0623\u064a \u0622\u064a\u0629 \u062a\u0648\u062f\u0651 \u062d\u0641\u0638\u0647\u0627\u061f',
        '\u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0643 \u062a\u0637\u0628\u064a\u0642 \u0634\u064a\u0621 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0633\u0648\u0631\u0629 \u0627\u0644\u064a\u0648\u0645\u061f',
        '\u0645\u0627 \u0627\u0644\u0635\u0641\u0629 \u0645\u0646 \u0635\u0641\u0627\u062a \u0627\u0644\u0644\u0647 \u0627\u0644\u062a\u064a \u0644\u0627\u062d\u0638\u062a\u0647\u0627 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0633\u0648\u0631\u0629\u061f',
        '\u0628\u0645\u0627\u0630\u0627 \u0630\u0643\u0651\u0631\u062a\u0643 \u0647\u0630\u0647 \u0627\u0644\u0633\u0648\u0631\u0629 \u0645\u0646 \u062d\u064a\u0627\u062a\u0643\u061f',
        '\u0644\u0648 \u0623\u0631\u062f\u062a \u0623\u0646 \u062a\u0634\u0627\u0631\u0643 \u0635\u062f\u064a\u0642\u064b\u0627 \u0622\u064a\u0629 \u0648\u0627\u062d\u062f\u0629\u060c \u0641\u0623\u064a\u0647\u0627 \u062a\u062e\u062a\u0627\u0631\u061f',
        '\u0645\u0627 \u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u0630\u064a \u0623\u062b\u0627\u0631\u062a\u0647 \u0647\u0630\u0647 \u0627\u0644\u0633\u0648\u0631\u0629 \u0641\u064a \u0642\u0644\u0628\u0643\u061f'
    ]
};

const REFLECTION_LABELS = {
    english: { reflection: 'Reflection', placeholder: 'Take a moment to write a thought\u2026', skip: 'Not now', save: 'Save reflection', saved: '\u2713 Reflection saved', cleared: 'Cleared' },
    french:  { reflection: 'R\u00e9flexion',  placeholder: 'Prenez un moment pour \u00e9crire une pens\u00e9e\u2026', skip: 'Pas maintenant', save: 'Enregistrer', saved: '\u2713 R\u00e9flexion enregistr\u00e9e', cleared: 'Effac\u00e9' },
    spanish: { reflection: 'Reflexi\u00f3n',  placeholder: 'T\u00f3mate un momento para escribir un pensamiento\u2026', skip: 'Ahora no', save: 'Guardar reflexi\u00f3n', saved: '\u2713 Reflexi\u00f3n guardada', cleared: 'Borrado' },
    arabic:  { reflection: '\u062a\u0623\u0645\u0644',       placeholder: '\u062e\u0630 \u0644\u062d\u0638\u0629 \u0644\u062a\u062f\u0648\u064a\u0646 \u0641\u0643\u0631\u0629\u2026', skip: '\u0644\u064a\u0633 \u0627\u0644\u0622\u0646', save: '\u062d\u0641\u0638 \u0627\u0644\u062a\u0623\u0645\u0644', saved: '\u2713 \u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0623\u0645\u0644', cleared: '\u062a\u0645 \u0627\u0644\u0645\u0633\u062d' }
};

function getReflectionQuestions() {
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    return REFLECTION_QUESTIONS_BY_LANG[lang] || REFLECTION_QUESTIONS_BY_LANG.english;
}
function getReflectionLabels() {
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    return REFLECTION_LABELS[lang] || REFLECTION_LABELS.english;
}

// ════════════════════════════════════════════════════════════════════
// v10.8 — Wire top access bar (Reading-time display)
// v10.13: Topics button removed — Topics is accessible via TOC tab
// ════════════════════════════════════════════════════════════════════
(function wireTopAccessBar() {
    function attach() {
        var widget = document.getElementById('topReadingTime');
        // Restore hidden state from localStorage
        var hidden = false;
        try { hidden = localStorage.getItem('quranHideReadingWidget') === '1'; } catch(e) {}
        if (widget && hidden) widget.style.display = 'none';

        // X button \u2014 hide widget
        var closeBtn = document.getElementById('trtCloseBtn');
        if (closeBtn) closeBtn.addEventListener('click', function() {
            try { localStorage.setItem('quranHideReadingWidget', '1'); } catch(e) {}
            if (widget) widget.style.display = 'none';
        });

        // Sidebar Reset button
        var resetBtn = document.getElementById('trtResetBtn');
        if (resetBtn) resetBtn.addEventListener('click', function() {
            var data = getReadingTime();
            var weeksCount = Object.keys(data).length;
            var msg = 'Erase reading-time history (' + weeksCount + ' week' + (weeksCount === 1 ? '' : 's') + ')? Cannot be undone.';
            if (typeof showConfirm === 'function') {
                showConfirm('Reset reading time?', msg, function() {
                    try { localStorage.removeItem(READING_TIME_KEY); } catch(e) {}
                    _readingTimeStart = Date.now();
                    refreshTopReadingTime();
                    if (typeof showToast === 'function') showToast('Reading time reset');
                });
            } else if (confirm(msg)) {
                try { localStorage.removeItem(READING_TIME_KEY); } catch(e) {}
                _readingTimeStart = Date.now();
                refreshTopReadingTime();
            }
        });

        refreshTopReadingTime();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
    // Refresh every 60s while page is visible
    setInterval(function() {
        if (!document.hidden) refreshTopReadingTime();
    }, 60000);
}());

function refreshTopReadingTime() {
    var el = document.getElementById('topReadingTime');
    if (!el) return;
    if (typeof getReadingTimeSummary !== 'function') return;
    var s = getReadingTimeSummary();
    var valEl = el.querySelector('.trt-val');
    var avgEl = el.querySelector('.trt-avg');
    if (valEl) valEl.textContent = fmtTime(s.thisWeek);
    if (avgEl) avgEl.textContent = fmtTime(s.avg4w) + '/week';
}

// Refresh after every navigation
(function hookRefreshReadingTime() {
    var hooked = false;
    function tryHook() {
        if (hooked || typeof displaySingleSura === 'undefined') return;
        hooked = true;
        var orig = displaySingleSura;
        window.displaySingleSura = displaySingleSura = function(suraId) {
            orig(suraId);
            setTimeout(refreshTopReadingTime, 100);
        };
    }
    if (!tryHook()) {
        var iv = setInterval(function(){ tryHook(); if (hooked) clearInterval(iv); }, 200);
    }
}());

// ════════════════════════════════════════════════════════════════════
// v10.13 — New version available notification
// Shows a pill banner when the service worker detects an update
// ════════════════════════════════════════════════════════════════════
(function initUpdateNotification() {
    if (!('serviceWorker' in navigator)) return;

    function showUpdateBanner() {
        if (document.getElementById('updateBanner')) return;
        var banner = document.createElement('div');
        banner.id = 'updateBanner';
        banner.className = 'update-banner';
        banner.innerHTML =
            '<span class="update-banner-text">✨ New version available</span>' +
            '<button class="update-banner-btn" id="updateBannerBtn">Reload</button>' +
            '<button class="update-banner-close" id="updateBannerClose">✕</button>';
        document.body.appendChild(banner);
        setTimeout(function() { banner.classList.add('show'); }, 50);
        document.getElementById('updateBannerBtn').addEventListener('click', function() {
            window.location.reload();
        });
        document.getElementById('updateBannerClose').addEventListener('click', function() {
            banner.classList.remove('show');
            setTimeout(function() { if (banner.parentNode) banner.remove(); }, 300);
        });
    }

    // React when new SW takes control
    navigator.serviceWorker.addEventListener('controllerchange', function() {
        showUpdateBanner();
    });

    // Also check on load if there's a waiting SW (user had the page open during update)
    navigator.serviceWorker.ready.then(function(reg) {
        if (reg.waiting) {
            showUpdateBanner();
        }
        reg.addEventListener('updatefound', function() {
            var installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', function() {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateBanner();
                }
            });
        });
    }).catch(function() {});
}());

// ════════════════════════════════════════════════════════════════════
// v10.10 — Final injection layer: Export & Data section always at the
// bottom of Settings (mobile sheet AND desktop modal)
// ════════════════════════════════════════════════════════════════════
(function injectDataLast() {
    function tryInject() {
        if (typeof buildSheetSettings === 'undefined' || typeof appendDataUI !== 'function') return false;
        if (window._dataLastInjected) return true;
        window._dataLastInjected = true;

        var origSheet = buildSheetSettings;
        window.buildSheetSettings = buildSheetSettings = function(body, title) {
            origSheet(body, title);
            // Defer so this runs after any other injection layers that wrap origSheet
            setTimeout(function() {
                // Defensive: don't double-add
                if (!body.querySelector('.data-section-marker')) {
                    appendDataUI(body);
                    var marker = body.lastElementChild;
                    if (marker) marker.classList.add('data-section-marker');
                }
            }, 0);
        };
        if (typeof openFeaturesModal === 'function') {
            var origModal = openFeaturesModal;
            window.openFeaturesModal = function() {
                origModal();
                setTimeout(function() {
                    var body = document.getElementById('featuresModalBody');
                    if (body && !body.querySelector('.data-section-marker')) {
                        appendDataUI(body);
                        var marker = body.lastElementChild;
                        if (marker) marker.classList.add('data-section-marker');
                    }
                }, 50);
            };
        }
        return true;
    }
    if (!tryInject()) {
        var iv = setInterval(function() {
            if (tryInject()) clearInterval(iv);
        }, 200);
    }
}());

// ════════════════════════════════════════════════════════════════════
// v10.13 — Daily verse notification via Web Push
// ════════════════════════════════════════════════════════════════════
var PUSH_SERVER_URL  = 'https://quran-push-server-production.up.railway.app';
var VAPID_PUBLIC_KEY = 'BFZJh92I-qypfw2ZKsJoBbD0IwN7O13EBvFWE_GIVGbtQSfMrnxNR5Re3DP-Ex1uQdF-xtiKXD-ijbocrYzTleE';
var PUSH_NOTIF_HOUR_KEY = 'quranNotifHour';

function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var output = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) { output[i] = rawData.charCodeAt(i); }
    return output;
}

function showNotifTimePicker(onConfirm, onCancel) {
    var savedHour = 8;
    try { savedHour = parseInt(localStorage.getItem(PUSH_NOTIF_HOUR_KEY) || '8'); } catch(e) {}
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var defaultVal = pad(savedHour) + ':00';
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    var overlay = document.createElement('div');
    overlay.className = 'notif-time-overlay';
    overlay.innerHTML =
        '<div class="notif-time-card">' +
            '<h3>🔔 Daily notification time</h3>' +
            '<p>Choose when you\'d like to receive your daily Quran verse.' +
            (tz ? '<br><small>Your timezone: ' + tz + '</small>' : '') + '</p>' +
            '<input class="notif-time-input" type="time" value="' + defaultVal + '" />' +
            '<div class="notif-time-actions">' +
                '<button class="btn-cancel">Cancel</button>' +
                '<button class="btn-confirm">Confirm</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('.btn-cancel').addEventListener('click', function() {
        document.body.removeChild(overlay);
        if (onCancel) onCancel();
    });

    overlay.querySelector('.btn-confirm').addEventListener('click', function() {
        var val = overlay.querySelector('.notif-time-input').value || '08:00';
        var hour = parseInt(val.split(':')[0]);
        try { localStorage.setItem(PUSH_NOTIF_HOUR_KEY, String(hour)); } catch(e) {}
        document.body.removeChild(overlay);
        if (onConfirm) onConfirm(hour);
    });
}

async function doSubscribe(notifHour) {
    var tzOffset = new Date().getTimezoneOffset();
    var reg = await navigator.serviceWorker.ready;
    var existing = await reg.pushManager.getSubscription();
    if (existing) {
        // Update hour on server even if already subscribed
        var payload = Object.assign(JSON.parse(JSON.stringify(existing)), { notifHour: notifHour, tzOffset: tzOffset });
        await fetch(PUSH_SERVER_URL + '/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return true;
    }
    var subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    var payload = Object.assign(JSON.parse(JSON.stringify(subscription)), { notifHour: notifHour, tzOffset: tzOffset });
    await fetch(PUSH_SERVER_URL + '/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return true;
}

async function setupDailyVerseNotification(skipPicker) {
    if (!isFeatureOn('dailyVerseNotification')) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (typeof showToast === 'function') showToast('Push notifications not supported on this browser');
        return false;
    }
    if (Notification.permission === 'denied') {
        if (typeof showToast === 'function') showToast('Notifications blocked — enable in browser settings');
        return false;
    }
    if (Notification.permission === 'default') {
        try {
            var perm = await Notification.requestPermission();
            if (perm !== 'granted') {
                if (typeof showToast === 'function') showToast('Notifications denied');
                return false;
            }
        } catch(e) { return false; }
    }

    var savedHour = null;
    try { var s = localStorage.getItem(PUSH_NOTIF_HOUR_KEY); if (s !== null) savedHour = parseInt(s); } catch(e) {}

    if (!skipPicker && savedHour === null) {
        showNotifTimePicker(async function(hour) {
            try {
                await doSubscribe(hour);
                var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
                if (typeof showToast === 'function') showToast('Notifications set for ' + pad(hour) + ':00 every day');
            } catch(err) {
                console.warn('[Notif] subscription failed', err);
                if (typeof showToast === 'function') showToast('Could not enable notifications');
            }
        }, function() {
            // User cancelled — turn the feature back off
            var f = getFeatures(); f.dailyVerseNotification = false; saveFeatures(f);
        });
    } else {
        var hour = savedHour !== null ? savedHour : 8;
        try {
            await doSubscribe(hour);
            if (!skipPicker) {
                var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
                if (typeof showToast === 'function') showToast('Notifications set for ' + pad(hour) + ':00 every day');
            }
        } catch(e) {
            console.warn('[Notif] subscription failed', e);
            if (typeof showToast === 'function') showToast('Could not enable notifications');
        }
    }
    return true;
}

async function teardownDailyVerseNotification() {
    try {
        if (!('serviceWorker' in navigator)) return;
        var reg = await navigator.serviceWorker.ready;
        var subscription = await reg.pushManager.getSubscription();
        if (!subscription) return;
        await fetch(PUSH_SERVER_URL + '/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
        try { localStorage.removeItem(PUSH_NOTIF_HOUR_KEY); } catch(e) {}
    } catch(e) {
        console.warn('[Notif] unsubscribe failed', e);
    }
}

// Note: subscribe/unsubscribe on toggle is handled directly by the
// notifInp change listener in the notification card (appendFeaturesUI).

// On app load, if the feature is on and permission granted, ensure subscribed (skip picker)
(function notifInitOnLoad() {
    function init() {
        if (isFeatureOn('dailyVerseNotification') && 'Notification' in window && Notification.permission === 'granted') {
            setupDailyVerseNotification(true);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else setTimeout(init, 1500);
}());



// ════════════════════════════════════════════════════════════════════
// v10.15.2 — HELP & TUTORIAL modal (multilingual, desktop + mobile)
// ════════════════════════════════════════════════════════════════════
// Action key for each card (same order across all languages)
var CARD_ACTIONS = [
    'navigation', 'themes', 'search', 'audio', 'resume',
    'saved', 'lang', 'share', 'yt', 'kbd'
];

// "Show me" label per language
var SHOW_ME_LABEL = {
    english: '→ Show me',
    french:  '→ Voir',
    arabic:  '← أرني',
    spanish: '→ Mostrar'
};

function featureSpotlight(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function() {
        var rect = el.getBoundingClientRect();
        var pad  = 14;
        // Spotlight lens: transparent window — huge box-shadow dims everything outside
        var lens = document.createElement('div');
        lens.className = 'feature-spotlight-lens';
        lens.style.top    = (rect.top    - pad) + 'px';
        lens.style.left   = (rect.left   - pad) + 'px';
        lens.style.width  = (rect.width  + pad * 2) + 'px';
        lens.style.height = (rect.height + pad * 2) + 'px';
        document.body.appendChild(lens);
        requestAnimationFrame(function() { lens.classList.add('show'); });
        // Pulse the target (visible through the transparent lens)
        el.classList.add('feature-highlighted');
        // Remove everything after 3 pulse cycles × 0.9 s
        setTimeout(function() {
            lens.classList.remove('show');
            el.classList.remove('feature-highlighted');
            setTimeout(function() { if (lens.parentNode) lens.remove(); }, 350);
        }, 2800);
    }, 350);
}

function ensureSidebarOpen() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('open')) {
        if (typeof openSidebar === 'function') openSidebar();
    }
}

function expandSideGroupOf(el) {
    if (!el) return;
    var group = el.closest('.side-group');
    if (group && !group.classList.contains('side-group-open')) {
        group.classList.add('side-group-open');
    }
}

function executeFeatureAction(key) {
    switch (key) {
        case 'navigation':
            var toc = document.getElementById('tocContainer');
            if (toc) featureSpotlight(document.getElementById('tocTabRow') || toc);
            break;
        case 'themes':
            featureSpotlight(document.getElementById('themeSwitcher'));
            break;
        case 'search':
            ensureSidebarOpen();
            var si = document.getElementById('search-input');
            if (si) {
                expandSideGroupOf(si);
                featureSpotlight(si.closest('.side-group-body') || si);
                setTimeout(function() { si.focus(); }, 700);
            }
            break;
        case 'audio':
            var ab = document.querySelector('.verse-audio-btn');
            if (ab) featureSpotlight(ab);
            else if (typeof showToast === 'function') showToast('🔊 Tap the speaker icon on any verse');
            break;
        case 'resume':
            if (typeof showToast === 'function') showToast('🎵 Play a verse — the position saves automatically');
            break;
        case 'saved':
            var bBtn = document.getElementById('bookmarksBtn');
            if (bBtn) { bBtn.click(); setTimeout(function() { featureSpotlight(document.getElementById('bookmarksPanel')); }, 400); }
            break;
        case 'lang':
            ensureSidebarOpen();
            var ls = document.getElementById('languageSelector');
            if (ls) { expandSideGroupOf(ls); featureSpotlight(ls.closest('.side-group-body') || ls); }
            break;
        case 'share':
            var va = document.querySelector('.verse-actions');
            if (va) featureSpotlight(va);
            else if (typeof showToast === 'function') showToast('📤 Tap any verse to reveal share actions');
            break;
        case 'yt':
            var yts = document.getElementById('ytFrSection');
            if (yts) featureSpotlight(yts);
            else if (typeof showToast === 'function') showToast('▶ Switch to French to see YouTube links');
            break;
        case 'kbd':
            if (typeof toggleShortcutsHelp === 'function') toggleShortcutsHelp();
            break;
    }
}

var HELP_STRINGS = {
    english: {
        title:  'Help & Tutorial',
        intro:  'Welcome to Quran Display — your complete Quran companion. Here is a quick guide to every feature.',
        sections: {
            reading:   'Reading',
            tools:     'Tools & Saved',
            settings:  'Settings',
            desktop:   'Desktop Shortcuts'
        },
        cards: [
            {
                icon: '📖',
                title: 'Navigation',
                desc: 'Use the right-hand panel to browse all 114 Surahs, 30 Juz, Revelation order, or curated Topics. Tap any entry to jump directly to that chapter.',
                mock: 'tabs',
                tabs: ['Surahs','Juz','Revelation','Topics']
            },
            {
                icon: '🌓',
                title: 'Themes & Font',
                desc: 'Choose between Manuscript (sepia), Minimal (light), and Scholar (dark) themes using the top switcher. Adjust Arabic and translation font sizes from the Display panel.',
                mock: 'themes'
            },
            {
                icon: '🔍',
                title: 'Search',
                desc: 'Search across the full Quran or within a single Surah. Your last 10 searches are saved as quick-access chips.',
                mock: 'search'
            },
            {
                icon: '🔊',
                title: 'Audio Recitation',
                desc: 'Tap the 🔊 icon next to any verse to listen. A mini-player appears at the bottom with controls for Play, Previous, Next, Speed and auto-advance. Choose your reciter in Settings.',
                mock: 'player'
            },
            {
                icon: '🎵',
                title: 'Resume Audio',
                desc: 'When you return to the app after listening, a banner at the bottom offers to resume from exactly where you left off. Tap ▶ Reprendre to continue.',
                mock: 'resume'
            },
            {
                icon: '🔖',
                title: 'Bookmarks & Notes',
                desc: 'Tap the bookmark icon on any verse to save it. Add personal notes, highlight verses, and record reflections. Access everything from the Saved panel (📁).',
                mock: 'saved'
            },
            {
                icon: '🌐',
                title: 'Languages',
                desc: 'Change the primary Quran language (Arabic, French, English, Spanish) or add multiple translations side-by-side from the Languages panel in the sidebar.',
                mock: 'lang'
            },
            {
                icon: '📤',
                title: 'Share a Verse',
                desc: 'Tap a verse to select it, then tap the share icon to copy or share via your device\'s share sheet. Deep links let you share a direct link to any verse.',
                mock: 'share'
            },
            {
                icon: '▶',
                title: 'YouTube Videos',
                desc: 'When reading in French, a link to watch the full Surah on our YouTube channel appears above the verses.',
                mock: 'yt'
            },
            {
                icon: '⌨️',
                title: 'Keyboard Shortcuts',
                desc: 'On desktop: ← → to move between Surahs, F for Focus mode, ? to show shortcuts, Escape to close any panel.',
                mock: 'kbd'
            }
        ]
    },
    french: {
        title:  'Aide & Tutoriel',
        intro:  'Bienvenue dans Coran Display — votre compagnon complet du Coran. Voici un guide rapide de chaque fonctionnalité.',
        sections: {
            reading:   'Lecture',
            tools:     'Outils & Favoris',
            settings:  'Paramètres',
            desktop:   'Raccourcis clavier'
        },
        cards: [
            {
                icon: '📖',
                title: 'Navigation',
                desc: 'Utilisez le panneau de droite pour parcourir les 114 Sourates, les 30 Juz, l\'ordre de révélation ou des thèmes. Appuyez sur une entrée pour y accéder directement.',
                mock: 'tabs',
                tabs: ['Sourates','Juz','Révélation','Thèmes']
            },
            {
                icon: '🌓',
                title: 'Thèmes & Polices',
                desc: 'Choisissez entre Manuscrit (sépia), Minimal (clair) et Érudit (sombre) via le sélecteur en haut. Ajustez la taille des polices arabe et traduction dans le panneau Affichage.',
                mock: 'themes'
            },
            {
                icon: '🔍',
                title: 'Recherche',
                desc: 'Recherchez dans tout le Coran ou dans une seule Sourate. Vos 10 dernières recherches sont sauvegardées en accès rapide.',
                mock: 'search'
            },
            {
                icon: '🔊',
                title: 'Récitation audio',
                desc: 'Appuyez sur 🔊 à côté d\'un verset pour écouter. Un mini-lecteur apparaît en bas avec les contrôles. Choisissez votre récitateur dans les paramètres.',
                mock: 'player'
            },
            {
                icon: '🎵',
                title: 'Reprendre la récitation',
                desc: 'Quand vous revenez dans l\'application après avoir écouté, une bannière propose de reprendre là où vous en étiez. Appuyez sur ▶ Reprendre.',
                mock: 'resume'
            },
            {
                icon: '🔖',
                title: 'Favoris & Notes',
                desc: 'Appuyez sur l\'icône marque-page d\'un verset pour le sauvegarder. Ajoutez des notes, surlignez des versets et enregistrez des réflexions. Tout est accessible depuis Enregistrés (📁).',
                mock: 'saved'
            },
            {
                icon: '🌐',
                title: 'Langues',
                desc: 'Changez la langue principale (arabe, français, anglais, espagnol) ou ajoutez plusieurs traductions côte à côte depuis le panneau Langues.',
                mock: 'lang'
            },
            {
                icon: '📤',
                title: 'Partager un verset',
                desc: 'Appuyez sur un verset pour le sélectionner, puis sur l\'icône de partage pour copier ou partager. Les liens profonds permettent de partager un accès direct à n\'importe quel verset.',
                mock: 'share'
            },
            {
                icon: '▶',
                title: 'Vidéos YouTube',
                desc: 'En français, un lien pour regarder la Sourate complète sur notre chaîne YouTube apparaît au-dessus des versets.',
                mock: 'yt'
            },
            {
                icon: '⌨️',
                title: 'Raccourcis clavier',
                desc: 'Sur ordinateur : ← → pour changer de Sourate, F pour le mode Focus, ? pour voir les raccourcis, Échap pour fermer tout panneau.',
                mock: 'kbd'
            }
        ]
    },
    arabic: {
        title:  'المساعدة والدليل',
        intro:  'مرحباً بك في عرض القرآن — رفيقك الكامل للقرآن الكريم. إليك دليلاً سريعاً لكل ميزة.',
        sections: {
            reading:   'القراءة',
            tools:     'الأدوات والمحفوظات',
            settings:  'الإعدادات',
            desktop:   'اختصارات لوحة المفاتيح'
        },
        cards: [
            {
                icon: '📖',
                title: 'التنقل',
                desc: 'استخدم اللوحة اليمنى للتصفح بين السور الـ114 والأجزاء الـ30 وترتيب النزول والمواضيع. انقر على أي عنصر للانتقال إليه مباشرة.',
                mock: 'tabs',
                tabs: ['السور','الأجزاء','الوحي','المواضيع']
            },
            {
                icon: '🌓',
                title: 'المظاهر والخط',
                desc: 'اختر بين مظهر المخطوطة (بني) والبسيط (فاتح) والعالم (داكن) عبر أزرار التبديل في الأعلى. اضبط حجم الخط من لوحة العرض.',
                mock: 'themes'
            },
            {
                icon: '🔍',
                title: 'البحث',
                desc: 'ابحث في القرآن كله أو داخل سورة واحدة. تُحفظ آخر 10 عمليات بحث كاختصارات سريعة.',
                mock: 'search'
            },
            {
                icon: '🔊',
                title: 'التلاوة الصوتية',
                desc: 'انقر على 🔊 بجانب أي آية للاستماع. يظهر مشغل صغير في الأسفل مع أزرار التحكم. اختر القارئ من الإعدادات.',
                mock: 'player'
            },
            {
                icon: '🎵',
                title: 'استئناف التلاوة',
                desc: 'عند العودة للتطبيق بعد الاستماع، تظهر لافتة في الأسفل تتيح الاستئناف من حيث توقفت.',
                mock: 'resume'
            },
            {
                icon: '🔖',
                title: 'الإشارات والملاحظات',
                desc: 'انقر على أيقونة الإشارة بجانب أي آية لحفظها. أضف ملاحظات وسلّط الضوء على الآيات وسجّل تأملاتك. كل شيء متاح من المحفوظات (📁).',
                mock: 'saved'
            },
            {
                icon: '🌐',
                title: 'اللغات',
                desc: 'غيّر لغة القرآن الرئيسية أو أضف ترجمات متعددة جنباً إلى جنب من لوحة اللغات في الشريط الجانبي.',
                mock: 'lang'
            },
            {
                icon: '📤',
                title: 'مشاركة آية',
                desc: 'انقر على آية لتحديدها ثم على أيقونة المشاركة للنسخ أو المشاركة. تتيح الروابط العميقة مشاركة رابط مباشر لأي آية.',
                mock: 'share'
            },
            {
                icon: '▶',
                title: 'فيديوهات يوتيوب',
                desc: 'عند القراءة باللغة الفرنسية يظهر رابط لمشاهدة السورة كاملة على قناتنا في يوتيوب.',
                mock: 'yt'
            },
            {
                icon: '⌨️',
                title: 'اختصارات لوحة المفاتيح',
                desc: 'على الحاسوب: ← → للتنقل بين السور، F لوضع التركيز، ? لعرض الاختصارات، Escape لإغلاق أي لوحة.',
                mock: 'kbd'
            }
        ]
    },
    spanish: {
        title:  'Ayuda y Tutorial',
        intro:  'Bienvenido a Corán Display — tu compañero completo del Corán. Aquí tienes una guía rápida de cada función.',
        sections: {
            reading:   'Lectura',
            tools:     'Herramientas y Guardados',
            settings:  'Ajustes',
            desktop:   'Atajos de teclado'
        },
        cards: [
            {
                icon: '📖',
                title: 'Navegación',
                desc: 'Usa el panel derecho para explorar las 114 Suras, los 30 Juz, el orden de revelación o Temas. Toca cualquier entrada para ir directamente al capítulo.',
                mock: 'tabs',
                tabs: ['Suras','Juz','Revelación','Temas']
            },
            {
                icon: '🌓',
                title: 'Temas y Fuente',
                desc: 'Elige entre Manuscrito (sepia), Minimal (claro) y Erudito (oscuro) con el selector superior. Ajusta el tamaño de fuente desde el panel Visualización.',
                mock: 'themes'
            },
            {
                icon: '🔍',
                title: 'Búsqueda',
                desc: 'Busca en todo el Corán o dentro de una sola Sura. Tus últimas 10 búsquedas se guardan como acceso rápido.',
                mock: 'search'
            },
            {
                icon: '🔊',
                title: 'Recitación de audio',
                desc: 'Toca 🔊 junto a cualquier versículo para escuchar. Aparece un mini reproductor con controles. Elige tu recitador en Ajustes.',
                mock: 'player'
            },
            {
                icon: '🎵',
                title: 'Reanudar audio',
                desc: 'Al volver a la app tras escuchar, aparece un banner para reanudar desde donde lo dejaste.',
                mock: 'resume'
            },
            {
                icon: '🔖',
                title: 'Marcadores y Notas',
                desc: 'Toca el icono de marcador en cualquier versículo para guardarlo. Añade notas, resalta versículos y registra reflexiones. Todo accesible desde Guardados (📁).',
                mock: 'saved'
            },
            {
                icon: '🌐',
                title: 'Idiomas',
                desc: 'Cambia el idioma principal del Corán o añade varias traducciones en paralelo desde el panel de Idiomas.',
                mock: 'lang'
            },
            {
                icon: '📤',
                title: 'Compartir versículo',
                desc: 'Toca un versículo para seleccionarlo y luego el icono de compartir. Los enlaces profundos te permiten compartir acceso directo a cualquier versículo.',
                mock: 'share'
            },
            {
                icon: '▶',
                title: 'Vídeos YouTube',
                desc: 'Al leer en francés, aparece un enlace para ver la Sura completa en nuestro canal de YouTube.',
                mock: 'yt'
            },
            {
                icon: '⌨️',
                title: 'Atajos de teclado',
                desc: 'En escritorio: ← → para cambiar de Sura, F para Modo Enfoque, ? para ver atajos, Escape para cerrar cualquier panel.',
                mock: 'kbd'
            }
        ]
    }
};

function buildHelpMock(type, tabs) {
    var m = document.createElement('div');
    m.className = 'help-mock';
    if (type === 'tabs') {
        var row = document.createElement('div');
        row.className = 'help-mock-tabs';
        (tabs || ['Tab 1','Tab 2','Tab 3','Tab 4']).forEach(function(t, i) {
            var tab = document.createElement('div');
            tab.className = 'help-mock-tab' + (i === 0 ? ' active' : '');
            tab.textContent = t;
            row.appendChild(tab);
        });
        m.appendChild(row);
    } else if (type === 'themes') {
        var row = document.createElement('div');
        row.className = 'help-mock-theme-row';
        [['#3a2a1a','#c9a444'],['#f5f0e8','#8a6a2a'],['#1a1a2e','#c9a444']].forEach(function(c, i) {
            var sw = document.createElement('div');
            sw.className = 'help-mock-swatch' + (i === 0 ? ' active' : '');
            sw.style.background = c[0];
            sw.style.borderColor = i === 0 ? c[1] : 'var(--accent-faint)';
            row.appendChild(sw);
        });
        m.appendChild(row);
    } else if (type === 'search') {
        var srch = document.createElement('div');
        srch.className = 'help-mock-search';
        srch.innerHTML = '🔍 <span>Search the Quran…</span>';
        var r1 = document.createElement('div');
        r1.className = 'help-mock-list-item';
        r1.innerHTML = '<span class="help-mock-badge">2:255</span> Ayat al-Kursi…';
        m.appendChild(srch); m.appendChild(r1);
    } else if (type === 'player') {
        var pl = document.createElement('div');
        pl.className = 'help-mock-player';
        pl.innerHTML = '<span class="help-mock-play-btn">⏸</span><span class="help-mock-verse-info">Al-Baqarah · v.255</span><span style="color:var(--accent);font-size:10px;font-weight:700;">1×</span>';
        m.appendChild(pl);
    } else if (type === 'resume') {
        var rb = document.createElement('div');
        rb.className = 'help-mock-player';
        rb.innerHTML = '<span style="font-size:11px;flex:1;color:var(--text-secondary);">🎵 Al-Baqarah · v.42</span><span style="background:var(--accent);color:var(--bg-content);border-radius:99px;padding:2px 8px;font-size:10px;font-weight:700;">▶ Resume</span>';
        m.appendChild(rb);
    } else if (type === 'saved') {
        var items = [['🔖','Al-Ikhlas · v.1'],['📝','My note here…'],['✦','Al-Fatiha · v.7']];
        items.forEach(function(it) {
            var li = document.createElement('div');
            li.className = 'help-mock-list-item';
            li.innerHTML = '<span>' + it[0] + '</span><span>' + it[1] + '</span>';
            m.appendChild(li);
        });
    } else if (type === 'lang') {
        var opts = [['🇸🇦','العربية'],['🇫🇷','Français'],['🇬🇧','English']];
        opts.forEach(function(o) {
            var li = document.createElement('div');
            li.className = 'help-mock-list-item';
            li.innerHTML = '<span>' + o[0] + '</span><span>' + o[1] + '</span>';
            m.appendChild(li);
        });
    } else if (type === 'share') {
        var v = document.createElement('div');
        v.className = 'help-mock-verse';
        v.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
        var acts = document.createElement('div');
        acts.className = 'help-mock-actions';
        acts.innerHTML = '<span class="help-mock-action-btn">📋 Copy</span><span class="help-mock-action-btn">📤 Share</span><span class="help-mock-action-btn">🔗 Link</span>';
        m.appendChild(v); m.appendChild(acts);
    } else if (type === 'yt') {
        var yt = document.createElement('div');
        yt.className = 'help-mock-player';
        yt.innerHTML = '<span style="background:#f00;color:#fff;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;">▶</span><span style="flex:1;color:var(--text-secondary);margin-left:6px;">Regarder la sourate sur YouTube</span>';
        m.appendChild(yt);
    } else if (type === 'kbd') {
        var krow = document.createElement('div');
        krow.className = 'help-mock-player';
        krow.style.flexWrap = 'wrap';
        krow.style.gap = '4px';
        [['←','Prev'],['→','Next'],['F','Focus'],['?','Help'],['Esc','Close']].forEach(function(k) {
            krow.innerHTML += '<span class="help-mock-kbd">' + k[0] + '</span><span style="color:var(--text-muted);font-size:10px;margin-right:6px;">' + k[1] + '</span>';
        });
        m.appendChild(krow);
    }
    return m;
}

function openHelpModal() {
    if (document.getElementById('helpOverlay')) return;
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    track('help_opened', { lang: lang });
    var strings = HELP_STRINGS[lang] || HELP_STRINGS.english;
    var isRTL = (lang === 'arabic');

    var overlay = document.createElement('div');
    overlay.id = 'helpOverlay';
    overlay.className = 'help-overlay';

    var box = document.createElement('div');
    box.className = 'help-box';
    if (isRTL) box.setAttribute('dir', 'rtl');

    // Header
    var hdr = document.createElement('div');
    hdr.className = 'help-header';
    hdr.innerHTML =
        '<span class="help-title">❓ ' + strings.title + '</span>' +
        '<button class="help-close" title="Close">✕</button>';
    box.appendChild(hdr);

    // Body
    var body = document.createElement('div');
    body.className = 'help-body';

    // Intro
    var intro = document.createElement('div');
    intro.className = 'help-intro';
    intro.textContent = strings.intro;
    body.appendChild(intro);

    // Cards (click-to-navigate disabled — will be re-enabled in a later version)
    var grid = document.createElement('div');
    grid.className = 'help-grid';
    strings.cards.forEach(function(c) {
        var card = document.createElement('div');
        card.className = 'help-card';
        var top = document.createElement('div');
        top.className = 'help-card-top';
        top.innerHTML = '<span class="help-card-icon">' + c.icon + '</span><span class="help-card-title">' + c.title + '</span>';
        var desc = document.createElement('div');
        desc.className = 'help-card-desc';
        desc.textContent = c.desc;
        card.appendChild(top);
        card.appendChild(desc);
        if (c.mock) card.appendChild(buildHelpMock(c.mock, c.tabs));
        grid.appendChild(card);
    });
    body.appendChild(grid);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close() {
        overlay.classList.remove('show');
        setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 280);
    }
    hdr.querySelector('.help-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    requestAnimationFrame(function() { overlay.classList.add('show'); });
}

// Wire desktop Help & Feedback buttons
(function wireDesktopSupport() {
    function attach() {
        var helpBtn = document.getElementById('desktopHelpBtn');
        if (helpBtn && !helpBtn._wired) {
            helpBtn._wired = true;
            helpBtn.addEventListener('click', openHelpModal);
        }
        var fbBtn = document.getElementById('desktopFeedbackBtn');
        if (fbBtn && !fbBtn._wired) {
            fbBtn._wired = true;
            fbBtn.addEventListener('click', function() {
                var v = 'v11.0.0';
                window.open('mailto:contact@amcreatives.ca?subject=Quran%20App%20Feedback&body=Version%3A%20' + v + '%0A%0A', '_blank');
            });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
}());

// ════════════════════════════════════════════════════════════════════
// v10.15 — YOUTUBE CHANNEL (French recitation videos)
// Per-surah full-video link shown only in French view.
// Also surfaces a "Notre chaîne YouTube" entry in Settings (all languages).
//
// SETUP: open data/youtube_fr.json and paste your YouTube URL for each
// surah (key = 0-indexed surah ID as a string, "0" = Al-Fatiha, etc.)
// Surahs with no entry simply show no video section.
// ════════════════════════════════════════════════════════════════════
const YT_CHANNEL_URL = 'https://www.youtube.com/@islampaixducoeur';
var _ytFrData = null;

function loadYtFrData(cb) {
    if (_ytFrData !== null) { if (cb) cb(_ytFrData); return; }
    fetch('./data/youtube_fr.json')
        .then(function(r) { return r.json(); })
        .then(function(d) { _ytFrData = d; if (cb) cb(d); })
        .catch(function() { _ytFrData = {}; });
}

function injectYtSection(suraId) {
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : '';
    if (lang !== 'french') return;
    loadYtFrData(function(data) {
        var url = data[String(parseInt(suraId) + 1)];
        var old = document.getElementById('ytFrSection');
        if (old) old.remove();
        if (!url || !url.trim()) return;
        var suraEl = document.getElementById(String(suraId));
        if (!suraEl) return;
        var sec = document.createElement('div');
        sec.id = 'ytFrSection';
        sec.className = 'yt-fr-section';
        var a = document.createElement('a');
        a.href = url.trim();
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'yt-fr-link';
        a.innerHTML = '<span class="yt-fr-icon">&#9654;</span> Regarder la sourate sur YouTube';
        a.addEventListener('click', function() {
            track('youtube_link_clicked', { sura: parseInt(suraId) + 1, type: 'surah' });
        });
        sec.appendChild(a);
        var firstVerse = suraEl.querySelector('.verse');
        if (firstVerse) suraEl.insertBefore(sec, firstVerse);
        else suraEl.appendChild(sec);
    });
}

// Hook into displaySingleSura to inject the per-surah YouTube link
(function hookYtSection() {
    function tryHook() {
        if (typeof displaySingleSura === 'undefined') return false;
        if (window._ytHooked) return true;
        window._ytHooked = true;
        var orig = displaySingleSura;
        window.displaySingleSura = displaySingleSura = function(suraId) {
            orig(suraId);
            setTimeout(function() { injectYtSection(suraId); }, 120);
        };
        var firstSura = document.querySelector('.sura');
        if (firstSura) setTimeout(function() { injectYtSection(firstSura.id); }, 400);
        return true;
    }
    if (!tryHook()) {
        var iv = setInterval(function() { if (tryHook()) clearInterval(iv); }, 200);
    }
}());

// Inject "Notre chaîne YouTube" into mobile sheet + desktop modal
function appendYtChannelUI(body) {
    if (body.querySelector('.yt-channel-link')) return;
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var a = document.createElement('a');
    a.href = YT_CHANNEL_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'yt-channel-link';
    a.innerHTML =
        '<span class="yt-channel-logo">&#9654;</span>' +
        '<span class="yt-channel-text">Notre chaîne YouTube</span>' +
        '<span class="yt-channel-arr">&#x2197;</span>';
    a.addEventListener('click', function() {
        track('youtube_link_clicked', { type: 'channel' });
    });
    sec.appendChild(a);
    body.appendChild(sec);
}

(function injectYtChannelUI() {
    function tryInject() {
        if (typeof buildSheetSettings === 'undefined') return false;
        if (window._ytChannelInjected) return true;
        window._ytChannelInjected = true;
        var origSheet = buildSheetSettings;
        window.buildSheetSettings = buildSheetSettings = function(body, title) {
            origSheet(body, title);
            setTimeout(function() { appendYtChannelUI(body); }, 10);
        };
        if (typeof openFeaturesModal === 'function') {
            var origModal = openFeaturesModal;
            window.openFeaturesModal = function() {
                origModal();
                setTimeout(function() {
                    var b = document.getElementById('featuresModalBody');
                    if (b) appendYtChannelUI(b);
                }, 60);
            };
        }
        return true;
    }
    if (!tryInject()) {
        var iv = setInterval(function() { if (tryInject()) clearInterval(iv); }, 200);
    }
}());

// ════════════════════════════════════════════════════════════════════
// v10.14 — Final settings cleanup: reorders Install + version footer
// ════════════════════════════════════════════════════════════════════
(function finalSettingsCleanup() {
    function reorder(body) {
        if (!body) return;

        // Move Install as app to right after the meditation banner
        var installSec = body.querySelector('[data-install-section]');
        var medBanner  = body.querySelector('.settings-meditation');
        if (installSec && medBanner && medBanner.nextSibling !== installSec) {
            body.insertBefore(installSec, medBanner.nextSibling);
        }

        // Ensure version footer is the last child and always shows the current version
        var vEl = body.querySelector('.app-version-footer') || body.querySelector('.mob-settings-version');
        if (!vEl) {
            vEl = document.createElement('div');
            vEl.className = 'app-version-footer';
        }
        vEl.textContent = 'Quran Display v10.18';
        body.appendChild(vEl);
    }

    function tryCleanup() {
        if (typeof buildSheetSettings === 'undefined') return false;
        if (window._finalCleanupInjected) return true;
        window._finalCleanupInjected = true;

        var origSheet = buildSheetSettings;
        window.buildSheetSettings = buildSheetSettings = function(body, title) {
            origSheet(body, title);
            setTimeout(function() { reorder(body); }, 250);
        };

        if (typeof openFeaturesModal === 'function') {
            var origModal = openFeaturesModal;
            window.openFeaturesModal = function() {
                origModal();
                setTimeout(function() {
                    reorder(document.getElementById('featuresModalBody'));
                }, 250);
            };
        }
        return true;
    }

    if (!tryCleanup()) {
        var iv = setInterval(function() { if (tryCleanup()) clearInterval(iv); }, 200);
    }
}());

// ════════════════════════════════════════════════════════════════════
// v10.11 — Global Escape handler: closes all open modals/sheets/overlays
// ════════════════════════════════════════════════════════════════════
(function globalEscapeHandler() {
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        // Ignore if typing in an input (let the input lose focus instead)
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            return;
        }
        // Close known modals/sheets in priority order (top-most first)
        var closed = false;
        // Confirm overlay (highest z-index)
        var confirmO = document.getElementById('confirmOverlay');
        if (confirmO && confirmO.classList.contains('show')) {
            confirmO.classList.remove('show');
            setTimeout(function(){ if (confirmO.parentNode) confirmO.remove(); }, 200);
            closed = true;
        }
        if (closed) return;
        // Note modal
        var noteModal = document.getElementById('noteModal');
        if (noteModal && noteModal.classList.contains('show')) {
            if (typeof closeNoteModal === 'function') closeNoteModal();
            closed = true;
        }
        if (closed) return;
        // Verse chooser
        if (typeof closeVerseChooser === 'function') {
            var chooser = document.querySelector('.verse-chooser');
            if (chooser) { closeVerseChooser(); closed = true; }
        }
        if (closed) return;
        // Reflection modal
        var refl = document.getElementById('reflectionModal');
        if (refl) { refl.classList.remove('show'); setTimeout(function(){ if (refl.parentNode) refl.remove(); }, 200); closed = true; }
        if (closed) return;
        // Daily verse modal
        var dv = document.getElementById('dailyVerseModal');
        if (dv) { dv.classList.remove('show'); setTimeout(function(){ if (dv.parentNode) dv.remove(); }, 200); closed = true; }
        if (closed) return;
        // Topics modal (and its drill-down stays in same overlay)
        if (typeof closeTopicsModal === 'function' && document.getElementById('topicsModal')) {
            closeTopicsModal(); closed = true;
        }
        if (closed) return;
        // Tafsir compare modal
        if (typeof closeTafsirCompare === 'function' && document.getElementById('tafsirCompareModal')) {
            closeTafsirCompare(); closed = true;
        }
        if (closed) return;
        // Tafsir modal
        if (typeof closeTafsirModal === 'function' && document.getElementById('tafsirModal')) {
            closeTafsirModal(); closed = true;
        }
        if (closed) return;
        // Reading plan modal
        var rpm = document.getElementById('readingPlanModal');
        if (rpm) { rpm.classList.remove('show'); setTimeout(function(){ if (rpm.parentNode) rpm.remove(); }, 200); closed = true; }
        if (closed) return;
        // Install modal
        var inst = document.getElementById('installModal');
        if (inst) { inst.classList.remove('show'); setTimeout(function(){ if (inst.parentNode) inst.remove(); }, 200); closed = true; }
        if (closed) return;
        // Features modal (desktop Settings)
        var feat = document.getElementById('featuresModal');
        if (feat && feat.classList.contains('show')) {
            feat.classList.remove('show'); closed = true;
        }
        if (closed) return;
        // Mobile sheet
        var sheet = document.getElementById('mobileSheet');
        if (sheet && sheet.classList.contains('show')) {
            if (typeof closeMobileSheet === 'function') closeMobileSheet();
            closed = true;
        }
        if (closed) return;
        // Sidebar (mobile)
        var sb = document.getElementById('sidebar');
        if (sb && sb.classList.contains('open')) {
            sb.classList.remove('open');
            var ov = document.getElementById('sidebarOverlay');
            if (ov) ov.classList.remove('show');
        }
    });
}());

// ════════════════════════════════════════════════════════════════════
// v10.11 — Khatm sidebar button → modal (desktop)
// ════════════════════════════════════════════════════════════════════
function openKhatmModal() {
    if (!isFeatureOn('khatmTracker')) {
        if (typeof showToast === 'function') showToast('Enable Khatm tracker in Settings first');
        return;
    }
    var existing = document.getElementById('khatmModal');
    if (existing) existing.remove();

    // v10.12: Multi-language labels
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    var labels = {
        arabic:  { title: '🎯 متتبع الختمات', reset: '🗑 إعادة تعيين', resetTitle: 'إعادة تعيين متتبع الختمات', resetConfirm: 'سيتم حذف عداد الختمات وسجل القراءة بالكامل. هل أنت متأكد؟', done: 'تمت إعادة التعيين', close: '✕' },
        french:  { title: '🎯 Suivi des Khatm', reset: '🗑 Réinitialiser', resetTitle: 'Réinitialiser le suivi des Khatm', resetConfirm: 'Cela effacera complètement votre compteur de Khatm et votre historique de lecture. Êtes-vous sûr ?', done: 'Réinitialisé', close: '✕' },
        english: { title: '🎯 Khatm tracker', reset: '🗑 Reset tracker', resetTitle: 'Reset Khatm tracker', resetConfirm: 'This will fully erase your Khatm counter and reading history. Are you sure?', done: 'Tracker reset', close: '✕' },
        spanish: { title: '🎯 Rastreador de Khatm', reset: '🗑 Reiniciar', resetTitle: 'Reiniciar rastreador de Khatm', resetConfirm: 'Esto borrará por completo su contador de Khatm y su historial de lectura. ¿Está seguro?', done: 'Rastreador reiniciado', close: '✕' }
    };
    var L = labels[lang] || labels.english;
    var isRtl = (lang === 'arabic');

    var overlay = document.createElement('div');
    overlay.id = 'khatmModal';
    overlay.className = 'khatm-modal-overlay';
    if (isRtl) overlay.setAttribute('dir', 'rtl');
    overlay.innerHTML =
        '<div class="khatm-modal-box">' +
            '<div class="khatm-modal-header">' +
                '<span class="khatm-modal-title">' + L.title + '</span>' +
                '<div class="khatm-modal-header-actions">' +
                    '<button class="khatm-modal-reset" id="khatmModalReset" title="' + L.resetTitle + '">' + L.reset + '</button>' +
                    '<button class="khatm-modal-close" id="khatmModalClose">' + L.close + '</button>' +
                '</div>' +
            '</div>' +
            '<div class="khatm-modal-body" id="khatmModalBody"></div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function(){ overlay.classList.add('show'); });

    function close() {
        overlay.classList.remove('show');
        document.removeEventListener('keydown', khatmEscHandler);
        setTimeout(function(){ if (overlay.parentNode) overlay.remove(); }, 200);
    }
    function khatmEscHandler(e) {
        if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', khatmEscHandler);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) close();
    });
    document.getElementById('khatmModalClose').addEventListener('click', close);

    // Reset tracker
    document.getElementById('khatmModalReset').addEventListener('click', function() {
        if (typeof showConfirm === 'function') {
            showConfirm(L.resetTitle, L.resetConfirm, function() {
                try {
                    localStorage.removeItem('quranReadingHistory');
                    localStorage.removeItem('quranKhatmCount');
                    localStorage.removeItem('quranKhatmLog');
                } catch(e) {}
                if (typeof showToast === 'function') showToast(L.done);
                // Re-render
                var body = document.getElementById('khatmModalBody');
                if (body) { body.innerHTML = ''; if (typeof appendKhatmUI === 'function') appendKhatmUI(body); }
            });
        } else if (confirm(L.resetConfirm)) {
            try {
                localStorage.removeItem('quranReadingHistory');
                localStorage.removeItem('quranKhatmCount');
                localStorage.removeItem('quranKhatmLog');
            } catch(e) {}
            var body2 = document.getElementById('khatmModalBody');
            if (body2) { body2.innerHTML = ''; if (typeof appendKhatmUI === 'function') appendKhatmUI(body2); }
        }
    });

    // Populate body using the existing appendKhatmUI helper (which renders heatmap + streak + mark button)
    var body = document.getElementById('khatmModalBody');
    if (typeof appendKhatmUI === 'function') appendKhatmUI(body);
}

// Wire the sidebar button
(function wireKhatmBtn() {
    function attach() {
        var btn = document.getElementById('khatmBtn');
        if (!btn || btn._wired) return;
        btn._wired = true;
        btn.addEventListener('click', openKhatmModal);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
    setTimeout(attach, 300);
}());

// Reactive: when khatm toggle changes, refresh open Settings panel + close modal if disabled
document.addEventListener('change', function(e) {
    if (!e.target || e.target.type !== 'checkbox') return;
    if (!e.target.closest('.feature-toggle-row')) return;
    setTimeout(function() {
        var f = getFeatures();
        // If Khatm was just turned off, close the modal
        if (!f.khatmTracker) {
            var m = document.getElementById('khatmModal');
            if (m) m.remove();
        }
        // If a Features modal is open, re-render so the Khatm section appears/disappears
        var fm = document.getElementById('featuresModal');
        if (fm && fm.classList.contains('show') && typeof openFeaturesModal === 'function') {
            openFeaturesModal();
        }
    }, 80);
});

// ════════════════════════════════════════════════════════════════════
// v10.15.8 — SURAH COMPLETION CONFETTI CELEBRATION
// YouTube-style milestone: pieces rain from the top with tumble + drift.
// Called from script.js via IntersectionObserver on the last verse.
// ════════════════════════════════════════════════════════════════════
function triggerSurahCompleteFX() {
    // Colours: gold-themed + celebration palette
    var palette = [
        '#c9a444','#e8c85a','#f5ecce',  // app gold tones
        '#f43f5e','#fb923c','#facc15',  // warm
        '#4ade80','#38bdf8','#a78bfa',  // cool
        '#fb7185','#ffffff'             // pink + white
    ];
    var TOTAL = 45;

    for (var i = 0; i < TOTAL; i++) {
        (function(idx) {
            // Stagger launches: most in first 600 ms, a few late stragglers
            var delay = idx * 35 + Math.random() * 180;
            setTimeout(function() {
                var piece   = document.createElement('div');
                piece.className = 'confetti-piece';

                var color   = palette[Math.floor(Math.random() * palette.length)];
                var isCirc  = Math.random() < 0.22;
                var isStrm  = !isCirc && Math.random() < 0.35;  // thin streamer
                var w       = isCirc ? 8  : (isStrm ? 4 : 6 + Math.floor(Math.random() * 6));
                var h       = isCirc ? 8  : (isStrm ? 14 + Math.floor(Math.random() * 10) : w);
                var left    = 2  + Math.random() * 96;           // 2–98 vw
                var dur     = 1.5 + Math.random() * 1.5;         // 1.5–3 s
                var rot     = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540);
                var drift   = (Math.random() - 0.5) * 160;       // ±80 px horizontal
                var flip    = 0.5 + Math.random() * 0.8;         // scaleX wobble end-state

                piece.style.cssText = [
                    'left:'    + left + 'vw',
                    'top:-20px',
                    'width:'   + w + 'px',
                    'height:'  + h + 'px',
                    'background:' + color,
                    'border-radius:' + (isCirc ? '50%' : isStrm ? '1px' : '2px'),
                    '--cdur:'   + dur   + 's',
                    '--cdrift:' + drift + 'px',
                    '--crot:'   + rot   + 'deg',
                    '--cflip:'  + flip,
                    'animation-duration:' + dur + 's'
                ].join(';');

                document.body.appendChild(piece);
                setTimeout(function() { if (piece.parentNode) piece.remove(); }, (dur + 0.4) * 1000);
            }, delay);
        })(i);
    }
}

// ════════════════════════════════════════════════════════════════════
// v10.15.7 — DAILY READING STREAK BADGE
// Tracks consecutive days the app is opened; shows 🔥 N in sidebar.
// ════════════════════════════════════════════════════════════════════
var STREAK_STORE_KEY = 'quranStreak';

var _STREAK_LABEL = {
    english: 'day streak',
    french:  'jours consécutifs',
    arabic:  'يوم متواصل',
    spanish: 'días seguidos'
};

function updateDailyStreak() {
    var data = lsGet(STREAK_STORE_KEY, { current: 0, lastSeen: '' });
    var today = new Date().toISOString().slice(0, 10);
    if (data.lastSeen === today) return data.current;
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    data.current = (data.lastSeen === yesterday) ? data.current + 1 : 1;
    data.lastSeen = today;
    lsSet(STREAK_STORE_KEY, data);
    return data.current;
}

function renderStreakBadge() {
    var old = document.getElementById('sidebarStreakBadge');
    if (old) old.remove();
    var streak = updateDailyStreak();
    var hijriEl = document.getElementById('hijriMonth');
    if (!hijriEl) return;
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    var label = _STREAK_LABEL[lang] || _STREAK_LABEL.english;
    var badge = document.createElement('div');
    badge.id = 'sidebarStreakBadge';
    badge.className = 'sidebar-streak-badge';
    badge.title = streak + ' consecutive days of reading';
    badge.innerHTML =
        '<span class="ssb-flame">🔥</span>' +
        '<span class="ssb-num">' + streak + '</span>' +
        '<span class="ssb-label">' + label + '</span>';
    hijriEl.appendChild(badge);
}

// Also refresh the streak label when language changes
(function() {
    var _origApplyUI = window.applyUILanguage;
    if (typeof _origApplyUI === 'function') {
        window.applyUILanguage = function(language) {
            _origApplyUI.call(this, language);
            renderStreakBadge();
        };
    }
})();

// ── 24h Hijri event alert — called once both scripts are loaded ───────────────
window.addEventListener('load', function() {
    setTimeout(function() {
        if (typeof checkHijriEventAlert === 'function') checkHijriEventAlert();
    }, 1200);
    // Streak badge — give the app 700 ms to finish rendering
    setTimeout(renderStreakBadge, 700);
});
