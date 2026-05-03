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
    keyboardShortcuts: true,        // #2
    copyShareVerse:    true,         // #3
    swipeBetweenSurahs:true,         // #4 (mobile)
    searchAsYouType:   true,         // #5
    lastReadBanner:    true,         // #6
    bookmarkTags:      true,         // #12
    khatmTracker:      true,         // #13
    loadingSkeletons:  true,         // #14
    arabicFontChoice:  true,         // #17
    focusMode:         true,         // #18
    autoDarkTheme:     false,        // #19 (off by default — opinionated)
    browserLangDefault:false,        // #20 (off by default — Arabic is best default)
    pullToRefresh:     true,         // #21 (mobile)
    hapticFeedback:    true,         // #22 (mobile)
    landscapeLayout:   true,         // #23 (mobile)
    verseNavigation:   true,         // #1
    deepLinks:         true,         // #15
    notesExportImport: true,         // #7
    betterErrorStates: true          // #16
};

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

// Quick helper
function hapticTap(ms) {
    if (!isFeatureOn('hapticFeedback')) return;
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
    if (!isFeatureOn('deepLinks')) return null;
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
// #14 — Loading skeletons
// ═══════════════════════════════════════════════════════════════════
function showSkeleton(targetEl) {
    if (!isFeatureOn('loadingSkeletons')) return;
    if (!targetEl) return;
    targetEl.innerHTML =
        '<div class="skeleton-wrap">' +
        '<div class="skeleton-line skeleton-title"></div>' +
        '<div class="skeleton-verse"><div class="skeleton-line skeleton-ar"></div><div class="skeleton-line skeleton-tr"></div></div>' +
        '<div class="skeleton-verse"><div class="skeleton-line skeleton-ar" style="width:75%"></div><div class="skeleton-line skeleton-tr"></div></div>' +
        '<div class="skeleton-verse"><div class="skeleton-line skeleton-ar"></div><div class="skeleton-line skeleton-tr" style="width:60%"></div></div>' +
        '</div>';
}

// ═══════════════════════════════════════════════════════════════════
// #16 — Better error states
// ═══════════════════════════════════════════════════════════════════
function showError(targetEl, message, retryFn) {
    if (!isFeatureOn('betterErrorStates')) {
        if (targetEl) targetEl.innerHTML = '<p>' + message + '</p>';
        return;
    }
    if (!targetEl) return;
    var html =
        '<div class="error-state">' +
        '<div class="error-icon">⚠️</div>' +
        '<div class="error-msg">' + message + '</div>';
    if (retryFn) {
        html += '<button class="error-retry">Retry</button>';
    }
    html += '</div>';
    targetEl.innerHTML = html;
    if (retryFn) {
        var btn = targetEl.querySelector('.error-retry');
        if (btn) btn.addEventListener('click', retryFn);
    }
}

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
    // Add additional translations if any
    var verses = document.querySelectorAll('#' + suraId + ' .verse');
    if (verses[verseIdx]) {
        var secondaries = verses[verseIdx].querySelectorAll('.secondary-verse');
        if (secondaries.length > 0) {
            lines.push('');
            secondaries.forEach(function(s) { lines.push(s.textContent); });
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
    var url = isFeatureOn('deepLinks') ? buildDeepLink(suraId, verseIdx + 1) : location.href;
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
        if (!isFeatureOn('swipeBetweenSurahs')) return;
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
        if (!isFeatureOn('pullToRefresh')) return;
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
    wrap.className = 'khatm-heatmap';
    var title = document.createElement('div');
    title.className = 'khatm-title';
    title.innerHTML = '<span>Reading activity (last 90 days)</span><span class="khatm-completions">' + k.completions.length + ' khatm</span>';
    wrap.appendChild(title);
    var grid = document.createElement('div');
    grid.className = 'khatm-grid';
    var today = new Date();
    for (var i = 89; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var key = d.toISOString().slice(0, 10);
        var count = k.daily[key] || 0;
        var cell = document.createElement('div');
        cell.className = 'khatm-cell';
        cell.title = key + (count ? ' · ' + count + ' surahs read' : ' · no activity');
        cell.setAttribute('data-level', count === 0 ? '0' : count < 3 ? '1' : count < 6 ? '2' : count < 10 ? '3' : '4');
        grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    var legend = document.createElement('div');
    legend.className = 'khatm-legend';
    legend.innerHTML = 'Less <span class="kl" data-level="0"></span><span class="kl" data-level="1"></span><span class="kl" data-level="2"></span><span class="kl" data-level="3"></span><span class="kl" data-level="4"></span> More';
    wrap.appendChild(legend);
    return wrap;
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
        appendDataUI(body);
        appendKhatmUI(body);
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
        keyboardShortcuts:  ['⌨️ Keyboard shortcuts',     'Use ←/→ ? F / on desktop'],
        copyShareVerse:     ['📋 Copy & share verse',     'Adds copy / share / link buttons under each verse'],
        swipeBetweenSurahs: ['👆 Swipe between surahs',   'Swipe left / right to switch surah on phone'],
        searchAsYouType:    ['⚡ Search as you type',     'Auto-runs search 350ms after you stop typing'],
        lastReadBanner:     ['📍 "Continue reading" banner','Shows previously-read surah at top so you can jump back'],
        bookmarkTags:       ['🏷️ Bookmark tags',          'Categorize saved verses (e.g. "patience", "prayer")'],
        khatmTracker:       ['🎯 Khatm tracker',          'Daily reading heatmap + completion count'],
        loadingSkeletons:   ['✨ Loading animations',      'Shimmer effect while content loads'],
        arabicFontChoice:   ['🔤 Arabic font choice',      'Pick from Amiri / Scheherazade / Naskh / Lateef'],
        focusMode:          ['🧘 Focus mode',              'Hides everything except verses (key: F)'],
        autoDarkTheme:      ['🌗 Auto dark theme',         'Switches to Scholar after 7pm, Manuscript before'],
        browserLangDefault: ['🌐 Browser language default','Picks French/English/Spanish/Arabic from device'],
        pullToRefresh:      ['↻ Pull to refresh',         'Pull down at top of reading to refresh on mobile'],
        hapticFeedback:     ['📳 Haptic feedback',         'Subtle vibration on taps (mobile only)'],
        landscapeLayout:    ['📐 Landscape layout',        'Compact spacing in landscape on mobile'],
        verseNavigation:    ['⇆ Verse navigation buttons', 'Floating prev / next / jump-to-verse buttons'],
        deepLinks:          ['🔗 Verse deep links',        'Adds 🔗 button per verse to copy a shareable URL'],
        notesExportImport:  ['💾 Backup / restore data',   'Adds export / import buttons in settings'],
        betterErrorStates:  ['⚠️ Friendly error messages', 'Replaces blank failures with helpful retry']
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

    var heatmap = buildKhatmHeatmap();
    if (heatmap) sec.appendChild(heatmap);

    var btn = document.createElement('button');
    btn.className = 'mob-settings-btn';
    btn.textContent = '🎉 Mark Khatm as completed';
    btn.addEventListener('click', recordKhatmCompletion);
    sec.appendChild(btn);

    body.appendChild(sec);
}

// ═══════════════════════════════════════════════════════════════════
// Initial wiring on DOM ready
// ═══════════════════════════════════════════════════════════════════
function initFeatures() {
    loadArabicFontChoice();
    applyAutoTheme();
    applyBrowserLangDefault();

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
    // Reuse the same UI builders the mobile sheet uses
    if (typeof appendFeaturesUI      === 'function') appendFeaturesUI(body);
    if (typeof appendFocusModeButton === 'function') appendFocusModeButton(body);
    if (typeof appendDataUI          === 'function') appendDataUI(body);
    if (typeof appendKhatmUI         === 'function') appendKhatmUI(body);
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
