'use strict';

// ═══════════════════════════════════════════════════════════════════
// QURAN APP v9.9 — Phase 1 Features Module
// ═══════════════════════════════════════════════════════════════════
// All features can be toggled in Settings → Features
// Defaults are conservative — power features are opt-in
// ═══════════════════════════════════════════════════════════════════

const FEATURES_KEY = 'quranFeaturesV1';

// Default feature flags (user can toggle in settings)
const DEFAULT_FEATURES = {
    // v10.9: Off by default — user can opt in
    keyboardShortcuts: false,        // #2
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
    dailyVerseNotification:false      // v10.10 — opt-in (requires notification permission)
};

// v10.9: One-time migration — for users upgrading from v10.8 or earlier,
// reset the now-default-OFF flags to false (user-friendly fresh experience).
// They can opt back in via Settings if they want.
(function v109DefaultsMigration() {
    try {
        if (localStorage.getItem('quranV109Migrated') === '1') return;
        var saved = JSON.parse(localStorage.getItem(FEATURES_KEY) || '{}');
        // Force these to off (matches new defaults)
        saved.keyboardShortcuts = false;
        saved.lastReadBanner    = false;
        saved.khatmTracker      = false;
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
        if (!isFeatureOn('keyboardShortcuts')) return;
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
    if (document.body.classList.contains('focus-mode')) {
        document.body.classList.remove('focus-mode');
    } else {
        document.body.classList.add('focus-mode');
        window._focusModeActivatedAt = Date.now();
    }
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

    // Show last 3 months (current + 2 prior)
    var monthsToShow = [];
    for (var m = 2; m >= 0; m--) {
        var d = new Date(today.getFullYear(), today.getMonth() - m, 1);
        monthsToShow.push(d);
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
    var banner = document.getElementById('khatmDetailBanner');
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
    // Highlight selected cell
    document.querySelectorAll('.khatm-cell.khatm-selected').forEach(function(c) {
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
    if (!isFeatureOn('arabicFontChoice')) return;
    var font = ARABIC_FONTS[key] || ARABIC_FONTS.amiri;
    document.documentElement.style.setProperty('--font-arabic', font.css);
    try { localStorage.setItem('quranArabicFont', key); } catch(e) {}
}

function loadArabicFontChoice() {
    if (!isFeatureOn('arabicFontChoice')) return;
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
        appendKhatmUI(body);
        // v10.10: appendDataUI moved to a final injection layer (always last)
    };
}());

function appendFeaturesUI(body) {
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Features';
    sec.appendChild(lbl);

    var f = getFeatures();
    var FEATURE_LABELS = {
        keyboardShortcuts:  ['⌨️ Keyboard shortcuts',     'Use ←/→ ? F on desktop'],
        copyShareVerse:     ['📋 Copy & share verse',     'Adds copy / share / link buttons under each verse'],
        searchAsYouType:    ['⚡ Search as you type',     'Auto-runs search 350ms after you stop typing'],
        lastReadBanner:     ['📍 "Continue reading" banner','Shows previously-read surah at top so you can jump back'],
        saveTools:          ['🔖 Save tools',              'Show Highlight, Bookmark, and Note buttons on each verse'],
        khatmTracker:       ['🎯 Khatm tracker',          'Daily reading heatmap + completion count'],
        arabicFontChoice:   ['🔤 Arabic font choice',      'Pick from Amiri / Scheherazade / Naskh / Lateef'],
        focusMode:          ['🧘 Focus mode',              'Hides everything except verses (key: F)'],
        autoDarkTheme:      ['🌗 Auto dark theme',         'Switches to Scholar after 7pm, Manuscript before'],
        browserLangDefault: ['🌐 Browser language default','Picks French/English/Spanish/Arabic from device'],
        verseNavigation:    ['⇆ Verse navigation buttons', 'Floating prev / next / jump-to-verse buttons'],
        notesExportImport:  ['💾 Backup / restore data',   'Adds export / import buttons in settings'],
        audioRecitation:    ['🔊 Audio recitation',         'Play verses with multiple reciters · needs internet'],
        tafsir:             ['📚 Tafsir (commentary)',      'Tap a verse to read classical commentary · needs internet'],
        topicsIndex:           ['💡 Topics index',           'Browse verses by theme — patience, mercy, gratitude…'],
        dailyVerse:            ['🌅 Daily verse',            'A contemplative verse shown once per day on open'],
        dailyVerseNotification:['🔔 Daily verse notification','Schedules a daily notification (best-effort: works only on installed PWA on Android Chrome)'],
        reflectionPrompts:     ['✍️ Reflection prompts',     'Optional reflection question after finishing a surah'],
        hijriAwareness:        ['🌙 Hijri calendar',         'Marks special Islamic dates (Ramadan, Hajj, Laylat al-Qadr…)'],
        verseComparison:       ['🔀 Compare tafsirs',         'Adds "Compare all" button in the tafsir modal'],
        pdfExport:             ['🖨 Print / PDF export',     'Print the current surah with your notes'],
        readingTimeAnalytics:  ['⏱ Reading time',            'Tracks minutes read per week · shown in top bar'],
        voiceSearch:           ['🎤 Voice search',           'Tap the mic to speak a search query']
    };

    Object.keys(FEATURE_LABELS).forEach(function(key) {
        var labelData = FEATURE_LABELS[key];
        var row = document.createElement('label');
        row.className = 'feature-toggle-row';
        var labelWrap = document.createElement('span');
        labelWrap.className = 'feature-toggle-lbl-wrap';
        var span = document.createElement('span');
        span.className = 'feature-toggle-lbl';
        span.textContent = labelData[0];
        var sub = document.createElement('span');
        sub.className = 'feature-toggle-sub';
        sub.textContent = labelData[1];
        labelWrap.appendChild(span);
        labelWrap.appendChild(sub);
        var swWrap = document.createElement('span');
        swWrap.className = 'feature-toggle-sw';
        var inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.checked = f[key];
        inp.addEventListener('change', function() {
            var current = getFeatures();
            current[key] = this.checked;
            saveFeatures(current);
            // Re-apply features that need to react
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
            // v10.2: Audio + tafsir reactive
            if (key === 'audioRecitation') {
                if (this.checked) {
                    if (typeof attachAudioButtons === 'function') attachAudioButtons();
                } else {
                    if (typeof stopAudio === 'function') stopAudio();
                    document.querySelectorAll('.verse-audio-btn').forEach(function(b){ b.remove(); });
                }
            }
            if (key === 'tafsir' && !this.checked) {
                if (typeof closeTafsirModal === 'function') closeTafsirModal();
            }
            // v10.7 reactive toggles
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
            if (key === 'topicsIndex' && !this.checked) {
                if (typeof closeTopicsModal === 'function') closeTopicsModal();
            }
            if (key === 'verseComparison' && !this.checked) {
                if (typeof closeTafsirCompare === 'function') closeTafsirCompare();
            }
            showToast(this.checked ? '✓ Enabled' : '✗ Disabled');
            hapticTap(10);
        });
        var slider = document.createElement('span');
        slider.className = 'feature-toggle-slider';
        swWrap.appendChild(inp);
        swWrap.appendChild(slider);
        row.appendChild(labelWrap);
        row.appendChild(swWrap);
        sec.appendChild(row);
    });

    // Arabic font picker (conditional)
    if (isFeatureOn('arabicFontChoice')) {
        var fontSec = document.createElement('div');
        fontSec.className = 'feature-sub-row';
        var fontLbl = document.createElement('div');
        fontLbl.className = 'feature-sub-lbl';
        fontLbl.textContent = 'Arabic font';
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
        fontSel.addEventListener('change', function() { applyArabicFont(this.value); });
        fontSec.appendChild(fontSel);
        sec.appendChild(fontSec);
    }

    body.appendChild(sec);
}

function appendDataUI(body) {
    if (!isFeatureOn('notesExportImport')) return;
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Export notes & data';
    sec.appendChild(lbl);

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-bottom:8px;opacity:0.85;line-height:1.4;';
    hint.textContent = 'Saves all your notes, bookmarks, highlights, and reading history as a JSON file.';
    sec.appendChild(hint);

    var exp = document.createElement('button');
    exp.className = 'mob-settings-btn';
    exp.textContent = '💾 Export notes & bookmarks (JSON)';
    exp.addEventListener('click', exportAllData);
    sec.appendChild(exp);

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
    sec.appendChild(impLbl);

    body.appendChild(sec);
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
    var translation = medTranslations[lang] || medTranslations.french;
    var showTranslation = (lang !== 'arabic');
    med.innerHTML =
        '<div class="med-ornament">✦</div>' +
        '<div class="med-arabic" dir="rtl">أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ أَمْ عَلَىٰ قُلُوبٍ أَقْفَالُهَا</div>' +
        (showTranslation ? '<div class="med-translation">' + translation + '</div>' : '') +
        '<div class="med-citation">— Quran 47:24</div>';
    body.appendChild(med);
    // Reuse the same UI builders the mobile sheet uses
    if (typeof appendFeaturesUI      === 'function') appendFeaturesUI(body);
    if (typeof appendFocusModeButton === 'function') appendFocusModeButton(body);
    if (typeof appendKhatmUI         === 'function') appendKhatmUI(body);
    // v10.10: appendDataUI moved to final injection layer (always last)
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
(function sidebarGroups() {
    var SIDE_GROUPS_KEY = 'quranSideGroupsOpen';

    function getOpenState() {
        try { return JSON.parse(localStorage.getItem(SIDE_GROUPS_KEY) || '{}'); }
        catch(e) { return {}; }
    }
    function saveOpenState(state) {
        try { localStorage.setItem(SIDE_GROUPS_KEY, JSON.stringify(state)); } catch(e) {}
    }

    function init() {
        var groups = document.querySelectorAll('.side-group');
        if (!groups.length) return;
        var saved = getOpenState();
        groups.forEach(function(g, i) {
            var header = g.querySelector('.side-group-header');
            var body = g.querySelector('.side-group-body');
            if (!header || !body) return;
            var label = g.querySelector('.side-group-label');
            var key = label ? label.textContent.trim().toLowerCase() : 'group_' + i;
            // Apply saved state, fall back to data-default
            var open = (key in saved) ? saved[key] : (g.getAttribute('data-default') !== 'closed');
            if (open) g.classList.add('side-group-open');
            header.addEventListener('click', function() {
                var nowOpen = !g.classList.contains('side-group-open');
                g.classList.toggle('side-group-open', nowOpen);
                var state = getOpenState();
                state[key] = nowOpen;
                saveOpenState(state);
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

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'mob-settings-btn';
        cancelBtn.style.background = '#d9707018';
        cancelBtn.style.borderColor = '#d9707040';
        cancelBtn.style.color = '#e08585';
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
        sec.appendChild(cancelBtn);
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
}

function startPlan(planType, customDays) {
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

                // Check for updates periodically (every hour)
                setInterval(function() { reg.update(); }, 60 * 60 * 1000);

                // Listen for updates
                reg.addEventListener('updatefound', function() {
                    var newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // A new version is ready — notify user
                            if (typeof showToast === 'function') {
                                var bar = document.createElement('div');
                                bar.className = 'pwa-update-bar';
                                bar.innerHTML = '<span>📦 New version available</span><button class="pwa-update-btn">Reload</button><button class="pwa-update-dismiss">✕</button>';
                                document.body.appendChild(bar);
                                bar.querySelector('.pwa-update-btn').addEventListener('click', function() {
                                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                                    location.reload();
                                });
                                bar.querySelector('.pwa-update-dismiss').addEventListener('click', function() {
                                    bar.remove();
                                });
                            }
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

// ── v10.5: Update visibility of install banner — show on ALL mobile devices ──
// We don't wait for beforeinstallprompt because some browsers (Samsung Internet,
// older Android Chrome) don't fire it reliably or don't fire it at all.
window.updateInstallPill = function() {
    var btn = document.getElementById('headerInstallBtn');
    if (!btn) return;
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;
    var dismissed = false;
    try { dismissed = localStorage.getItem('installBannerDismissed') === '1'; } catch(e) {}
    if (isStandalone || dismissed) {
        btn.style.display = 'none';
        return;
    }
    // Show on all phones AND when desktop has triggered beforeinstallprompt
    var isMobile = window.innerWidth <= 900;
    var shouldShow = isMobile || window._pwaInstallable === true;
    btn.style.display = shouldShow ? '' : 'none';
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
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
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
        hint.textContent = '✓ App is installed and running in standalone mode. Reading also works offline once you\'ve loaded each language at least once.';
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

const AUDIO_KEY  = 'quranAudioPrefs';
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
        _audio.pause();
        _audio.src = '';
    }
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

    if (prefs.autoAdvance) {
        nextAudio();
    } else {
        updateMiniPlayer();
        updateVersePlayButtons();
    }
}

function onAudioError(e) {
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
function attachAudioButtons() {
    if (!isFeatureOn('audioRecitation')) return;
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
    if (!isFeatureOn('audioRecitation')) return;
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Audio recitation';
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
    [['none','No repeat'],['verse','Repeat verse'],['surah','Repeat surah']].forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p[0]; opt.textContent = p[1];
        rptSel.appendChild(opt);
    });
    rptSel.value = prefs.repeat;
    rptSel.addEventListener('change', function() {
        var pp = getAudioPrefs();
        pp.repeat = this.value;
        saveAudioPrefs(pp);
    });
    rptRow.appendChild(rptLbl); rptRow.appendChild(rptSel);
    sec.appendChild(rptRow);

    body.appendChild(sec);
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
            '<span class="topic-name">' + t.name + '</span>' +
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
    // Replace the list with verse details for this topic
    var box = document.querySelector('#topicsModal .topics-modal-box');
    if (!box) return;
    var list = document.getElementById('topicsList');
    list.innerHTML = '<button class="topic-back" id="topicBackBtn">← All topics</button>' +
                     '<div class="topic-detail-title">' + topic.icon + ' ' + topic.name + '</div>';
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
                    var verses = document.querySelectorAll('.sura .verse');
                    if (verses[vNum - 1]) {
                        verses[vNum - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        verses[vNum - 1].classList.add('verse-flash');
                        setTimeout(function(){ verses[vNum - 1].classList.remove('verse-flash'); }, 1500);
                    }
                }, 300);
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
}

function maybeShowReflectionPrompt(suraId) {
    if (!isFeatureOn('reflectionPrompts')) return;
    if (_reflectionShownThisSession[suraId]) return;
    _reflectionShownThisSession[suraId] = true;

    var sura = quranData.find(function(s){ return s.id === String(suraId); });
    if (!sura) return;
    // v10.8: Language-aware questions and labels
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
// Simple Umm al-Qura-style conversion (approximation, ±1 day)
function gregorianToHijri(g) {
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
    if (!isFeatureOn('hijriAwareness')) return;
    var h = getTodayHijri();
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
    if (!isFeatureOn('readingTimeAnalytics')) return;
    if (_readingTimeStart) return;
    _readingTimeStart = Date.now();
}
function stopReadingTimer() {
    if (!_readingTimeStart) return;
    var elapsed = Date.now() - _readingTimeStart;
    _readingTimeStart = null;
    if (elapsed < 5000) return; // ignore <5s sessions (just opened then closed)
    var minutes = elapsed / 60000;
    var data = getReadingTime();
    var weekKey = getCurrentWeekKey();
    data[weekKey] = (data[weekKey] || 0) + minutes;
    saveReadingTime(data);
}

(function wireReadingTimer() {
    function init() {
        if (!isFeatureOn('readingTimeAnalytics')) return;
        startReadingTimer();
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) stopReadingTimer();
            else startReadingTimer();
        });
        window.addEventListener('beforeunload', stopReadingTimer);
        window.addEventListener('pagehide', stopReadingTimer);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());

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
    var sec = document.createElement('div');
    sec.className = 'mob-settings-section';
    var lbl = document.createElement('div');
    lbl.className = 'mob-settings-lbl';
    lbl.textContent = 'Explore';
    sec.appendChild(lbl);

    // Topics button
    if (isFeatureOn('topicsIndex')) {
        var topicsBtn = document.createElement('button');
        topicsBtn.className = 'mob-settings-btn';
        topicsBtn.textContent = '💡 Browse topics';
        topicsBtn.addEventListener('click', function() {
            if (typeof closeMobileSheet === 'function') closeMobileSheet();
            closeTafsirModal && closeTafsirModal();
            setTimeout(openTopicsModal, 250);
        });
        sec.appendChild(topicsBtn);
    }

    // Print / Export current surah
    if (isFeatureOn('pdfExport')) {
        var printBtn = document.createElement('button');
        printBtn.className = 'mob-settings-btn';
        printBtn.textContent = '🖨 Print / Export this surah';
        printBtn.addEventListener('click', function() {
            if (typeof closeMobileSheet === 'function') closeMobileSheet();
            setTimeout(printCurrentSurah, 300);
        });
        sec.appendChild(printBtn);
    }

    body.appendChild(sec);

    // Reading-time summary section
    if (isFeatureOn('readingTimeAnalytics')) {
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
            '<div class="rt-row"><span class="rt-key">This week</span><span class="rt-val">' + s.thisWeek + ' min</span></div>' +
            '<div class="rt-row"><span class="rt-key">4-week average</span><span class="rt-val">' + s.avg4w + ' min/week</span></div>' +
            '<div class="rt-footer"><button class="rt-reset-link" type="button">🗑 Reset</button></div>';
        rtSec.appendChild(rtBox);
        var rtReset = rtBox.querySelector('.rt-reset-link');
        rtReset.addEventListener('click', function() {
            var data = getReadingTime();
            var weeksCount = Object.keys(data).length;
            var totalMin = 0;
            Object.values(data).forEach(function(m){ totalMin += m; });
            var msg = 'This will erase your reading-time history (' + weeksCount + ' week' + (weeksCount === 1 ? '' : 's') + ' · ' + Math.round(totalMin) + ' total minutes). This cannot be undone.';
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
        body.appendChild(rtSec);
    }
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
        ['hijriAwareness',    'feature-off-hijri']
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
// v10.8 — Wire top access bar (Topics button + Reading-time display)
// ════════════════════════════════════════════════════════════════════
(function wireTopAccessBar() {
    function attach() {
        var topicsBtn = document.getElementById('topTopicsBtn');
        if (topicsBtn && !topicsBtn._wired) {
            topicsBtn._wired = true;
            topicsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof openTopicsModal === 'function') openTopicsModal();
            });
        }
        refreshTopReadingTime();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
    // Refresh reading-time every 60s while page is visible
    setInterval(function() {
        if (!document.hidden) refreshTopReadingTime();
    }, 60000);
}());

function refreshTopReadingTime() {
    var el = document.getElementById('topReadingTime');
    if (!el) return;
    var valEl = el.querySelector('.trt-val');
    if (!valEl) return;
    if (typeof getReadingTimeSummary !== 'function') {
        valEl.textContent = '\u2014';
        return;
    }
    var s = getReadingTimeSummary();
    valEl.textContent = s.thisWeek + ' min';
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
// v10.10 — Daily verse notification (best-effort)
// (a) When toggled ON, request permission
// (b) If installed PWA + Notification Triggers API available (Chrome
//     Android), schedule a notification for tomorrow 8am
// (c) Always fall back to "show on next open" — handled by maybeShowDailyVerse
// ════════════════════════════════════════════════════════════════════
const DAILY_NOTIF_LAST_SCHEDULED = 'quranDailyNotifLastScheduled';

async function setupDailyVerseNotification() {
    if (!isFeatureOn('dailyVerseNotification')) return;
    if (!('Notification' in window)) {
        if (typeof showToast === 'function') showToast('Notifications not supported on this browser');
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
        } catch(e) {
            return false;
        }
    }
    // Schedule for tomorrow 8 AM (or 8 AM today if it's before 8 AM)
    await scheduleNextDailyNotification();
    return true;
}

async function scheduleNextDailyNotification() {
    try {
        if (!('serviceWorker' in navigator)) return;
        var reg = await navigator.serviceWorker.ready;
        // Check for Notification Triggers API support (experimental, Chrome Android)
        if (!('showTrigger' in Notification.prototype) && !('TimestampTrigger' in window)) {
            // Browser doesn't support scheduled notifications — we'll rely on the
            // "show on next open" fallback (which works via maybeShowDailyVerse).
            return;
        }
        // Compute next 8 AM
        var now = new Date();
        var target = new Date();
        target.setHours(8, 0, 0, 0);
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }
        // Don't reschedule if we already scheduled for this exact time
        var lastScheduled = null;
        try { lastScheduled = parseInt(localStorage.getItem(DAILY_NOTIF_LAST_SCHEDULED) || '0'); } catch(e) {}
        if (lastScheduled === target.getTime()) return;
        try {
            var TT = window.TimestampTrigger;
            await reg.showNotification('🌅 Today\'s verse', {
                body: 'Your daily Quran reflection is waiting.',
                icon: 'img/icon-192.png',
                badge: 'img/icon-192.png',
                tag: 'daily-verse',
                showTrigger: TT ? new TT(target.getTime()) : undefined
            });
            localStorage.setItem(DAILY_NOTIF_LAST_SCHEDULED, String(target.getTime()));
        } catch(err) {
            console.warn('[Notif] scheduling failed', err);
        }
    } catch(e) {
        console.warn('[Notif] setup error', e);
    }
}

// When the feature toggle flips ON, request permission and schedule
(function reactiveNotifToggle() {
    document.addEventListener('change', function(e) {
        if (!e.target || e.target.type !== 'checkbox') return;
        if (!e.target.closest('.feature-toggle-row')) return;
        // Detect which feature changed
        setTimeout(function() {
            if (isFeatureOn('dailyVerseNotification') && Notification && Notification.permission !== 'granted') {
                setupDailyVerseNotification();
            }
        }, 100);
    });
}());

// On app load, if the feature is on, try to (re)schedule
(function notifInitOnLoad() {
    function init() {
        if (isFeatureOn('dailyVerseNotification') && 'Notification' in window && Notification.permission === 'granted') {
            scheduleNextDailyNotification();
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else setTimeout(init, 1500);
}());

// ════════════════════════════════════════════════════════════════════
// v10.10 — appendDataUI as the FINAL injection layer
// (Export & data section sits at the very bottom of Settings)
// ════════════════════════════════════════════════════════════════════
(function injectDataLast() {
    function tryInject() {
        if (typeof buildSheetSettings === 'undefined') return false;
        if (window._dataLastInjected) return true;
        window._dataLastInjected = true;
        var origSheet = buildSheetSettings;
        // Wrap whatever buildSheetSettings already is (including prior monkey-patches)
        window.buildSheetSettings = buildSheetSettings = function(body, title) {
            origSheet(body, title);
            // Defer so all other appended sections finish first
            setTimeout(function() {
                // Avoid double-add if the chain ran twice
                if (body.querySelector('.data-section-marker')) return;
                if (typeof appendDataUI === 'function') {
                    var before = body.children.length;
                    appendDataUI(body);
                    // Mark the last appended section so we don't re-add
                    if (body.children.length > before) {
                        var last = body.children[body.children.length - 1];
                        if (last) last.classList.add('data-section-marker');
                    }
                }
            }, 0);
        };
        if (typeof openFeaturesModal === 'function') {
            var origModal = openFeaturesModal;
            window.openFeaturesModal = function() {
                origModal();
                setTimeout(function() {
                    var body = document.getElementById('featuresModalBody');
                    if (!body) return;
                    if (body.querySelector('.data-section-marker')) return;
                    if (typeof appendDataUI === 'function') {
                        var before = body.children.length;
                        appendDataUI(body);
                        if (body.children.length > before) {
                            var last = body.children[body.children.length - 1];
                            if (last) last.classList.add('data-section-marker');
                        }
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

