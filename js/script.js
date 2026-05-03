'use strict';

// ═══════════════════════════════════════════════════════════════════
// QURAN DISPLAY v9
// Features: Juz nav · Search history · Bookmarks · Reading history
//           Verse highlighting · Personal notes · Font size slider
// ═══════════════════════════════════════════════════════════════════

// ─── App state ────────────────────────────────────────────────────
let quranData           = [];
let currentLanguage     = 'arabic';
let isArabic            = false;
let isOriginalOrder     = true;
let additionalLanguages = [];
let contextOpen         = false;
let contextSuraIndex    = null;
let activeTocTab        = 'surah';   // 'surah' | 'juz' | 'revelation'

// ─── Persistent stores (localStorage keys) ────────────────────────
const STATE_KEY      = 'quranAppState';
const BOOKMARKS_KEY  = 'quranBookmarks';   // [{suraId, verseIdx, text, suraName}]
const HIGHLIGHTS_KEY = 'quranHighlights';  // {suraId_verseIdx: true}
const NOTES_KEY      = 'quranNotes';       // {suraId_verseIdx: 'note text'}
const HISTORY_KEY    = 'quranReadHistory'; // {suraId: timestamp}
const SEARCH_HX_KEY  = 'quranSearchHx';   // [term, term, ...]
const FONT_KEY       = 'quranFontSizes';   // {arabic: 2.8, trans: 1.87}


// ═══════════════════════════════════════════════════════════════════
// v9.5 — Confirm dialog
// ═══════════════════════════════════════════════════════════════════
function showConfirm(title, text, onConfirm) {
    var overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent  = text;
    var okBtn = document.getElementById('confirmOK');
    // Replace OK button to clear old listeners
    var newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    newOk.addEventListener('click', function() {
        overlay.classList.remove('show');
        if (onConfirm) onConfirm();
    });
    overlay.classList.add('show');
}

function cancelConfirm(e) {
    // Only cancel if clicking the overlay itself, not the box
    if (e && e.target && !e.target.classList.contains('confirm-overlay')) return;
    document.getElementById('confirmOverlay').classList.remove('show');
}

// ─── Load helpers ─────────────────────────────────────────────────
function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
}
function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

// ─── Main state save/load ─────────────────────────────────────────
function saveState() {
    const suraEl      = document.querySelector('.sura');
    const container   = document.getElementById('quranContainer');
    const searchTerm  = document.getElementById('search-input').value.trim();
    const resultsOpen = !document.getElementById('resultsContainerID').classList.contains('eraseDiv');
    lsSet(STATE_KEY, {
        language:            currentLanguage,
        additionalLanguages: additionalLanguages.slice(),
        suraId:              suraEl ? suraEl.getAttribute('id') : '0',
        isOriginalOrder:     isOriginalOrder,
        scrollTop:           container ? container.scrollTop : 0,
        theme:               document.documentElement.getAttribute('data-theme') || 'manuscript',
        tocWidth:            document.getElementById('tocContainer').offsetWidth,
        searchTerm:          searchTerm,
        searchOpen:          resultsOpen,
        contextOpen:         contextOpen,
        contextSuraIndex:    contextSuraIndex,
        activeTocTab:        activeTocTab
    });
}

function loadState() { return lsGet(STATE_KEY, null); }

// ─── XML cache ────────────────────────────────────────────────────
const xmlCache = {};

async function fetchAndParseQuran(language) {
    if (xmlCache[language]) return xmlCache[language];
    const response = await fetch('data/quran-' + language + '.xml');
    if (!response.ok) throw new Error('HTTP error ' + response.status);
    const xmlString = await response.text();
    const parser    = new DOMParser();
    const xmlDoc    = parser.parseFromString(xmlString, 'text/xml');
    const data = Array.from(xmlDoc.getElementsByTagName('sura')).map(function(sura, index) {
        return {
            id:     String(index),
            name:   sura.getAttribute('name'),
            city:   sura.getAttribute('city'),
            verses: Array.from(sura.getElementsByTagName('aya')).map(function(aya) {
                return { number: aya.getAttribute('index'), text: aya.getAttribute('text') };
            })
        };
    });
    xmlCache[language] = data;
    return data;
}

// ─── Hijri calendar ───────────────────────────────────────────────
const HijriMonths = [
    'Muharram','Safar','Rabi al-Awwal','Rabi ath-Thani',
    'Jumada al-Awwal','Jumada ath-Thani','Rajab','Shaban',
    'Ramadan','Shawwal','Dhu al-Qadah','Dhu al-Hijjah'
];

async function getHijriCalendarForMonth() {
    const now   = new Date();
    const day   = String(now.getDate()).padStart(2,'0');
    const month = String(now.getMonth()+1).padStart(2,'0');
    const el    = document.getElementById('hijriMonth');
    el.querySelector('.date-gregorian').textContent =
        now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    try {
        const resp = await fetch('https://api.aladhan.com/v1/gToH/'+day+'-'+month+'-'+now.getFullYear());
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.code === 200) {
            const h = data.data.hijri;
            el.querySelector('.date-hijri').textContent =
                h.day + ' ' + HijriMonths[h.month.number-1] + ' ' + h.year + ' هـ';
        }
    } catch(e) {}
}

// ─── UI label translations ─────────────────────────────────────────
const uiTranslations = {
    arabic:  { toggleOrder:'ترتيب الوحي', context:'سياق السورة', searchbutton:'بحث في القرآن', surahSearch:'بحث في السورة', bookmarks:'🔖 المرجعيات', rtl:true },
    french:  { toggleOrder:'Ordre de révélation', context:'Contexte de la sourate', searchbutton:'Recherche dans le Coran', surahSearch:'Recherche dans la Sourate', bookmarks:'🔖 Signets', rtl:false },
    english: { toggleOrder:'Revelation Order', context:'Surah Context', searchbutton:'Quran Search', surahSearch:'Surah Search', bookmarks:'🔖 Bookmarks', rtl:false },
    spanish: { toggleOrder:'Orden de revelación', context:'Contexto de la sura', searchbutton:'Búsqueda en el Corán', surahSearch:'Búsqueda en la Sura', bookmarks:'🔖 Marcadores', rtl:false }
};

function applyUILanguage(language) {
    const t   = uiTranslations[language] || uiTranslations['english'];
    const dir = t.rtl ? 'rtl' : 'ltr';
    const aln = t.rtl ? 'right' : 'left';
    [['toggleOrder',t.toggleOrder],['context',t.context],['searchbutton',t.searchbutton],
     ['searchButtonSourats',t.surahSearch],['bookmarksBtn',t.bookmarks]]
    .forEach(function(pair){
        const el = document.getElementById(pair[0]);
        if (!el) return;
        el.textContent   = pair[1];
        el.style.direction  = dir;
        el.style.textAlign  = aln;
    });
    const inp = document.getElementById('search-input');
    if (inp) { inp.style.direction = dir; if (t.rtl) inp.placeholder = 'ابحث في القرآن…'; }
    if (!isOriginalOrder) {
        const tog = document.getElementById('toggleOrder');
        if (tog) {
            const cl = t.rtl ? 'الترتيب الكلاسيكي' : (language==='french'?'Ordre classique':language==='spanish'?'Orden clásico':'Classic Order');
            tog.textContent = cl; tog.style.direction = dir; tog.style.textAlign = aln;
        }
    }
}

// ─── Diacritics ───────────────────────────────────────────────────
function removeDiacritics(text) { return text.replace(/[\u064B-\u0652]/g,''); }
function normalize(text, ignoreDia) { return ignoreDia ? removeDiacritics(text) : text; }
function getIgnoreDiacritics() {
    return currentLanguage === 'arabic' && document.getElementById('ignore-diacritics').checked;
}

// ═══════════════════════════════════════════════════════════════════
// FONT SIZE SLIDER
// ═══════════════════════════════════════════════════════════════════
// v9.11: Mobile default smaller than desktop (2.8rem is too big on phone)
const _isPhone = window.innerWidth <= 600;
let fontSizes = lsGet(FONT_KEY, _isPhone ? { arabic: 1.6, trans: 1.0 } : { arabic: 2.8, trans: 1.87 });

function applyFontSizes() {
    document.documentElement.style.setProperty('--verse-font-size', fontSizes.arabic + 'rem');
    document.documentElement.style.setProperty('--trans-font-size', fontSizes.trans + 'rem');
    document.getElementById('arabicFontVal').textContent = fontSizes.arabic.toFixed(1);
    document.getElementById('transFontVal').textContent  = fontSizes.trans.toFixed(2);
    document.getElementById('arabicFontSlider').value    = fontSizes.arabic;
    document.getElementById('transFontSlider').value     = fontSizes.trans;
}

document.getElementById('arabicFontSlider').addEventListener('input', function() {
    fontSizes.arabic = parseFloat(this.value);
    lsSet(FONT_KEY, fontSizes);
    applyFontSizes();
});

document.getElementById('transFontSlider').addEventListener('input', function() {
    fontSizes.trans = parseFloat(this.value);
    lsSet(FONT_KEY, fontSizes);
    applyFontSizes();
});

// ═══════════════════════════════════════════════════════════════════
// SEARCH HISTORY
// ═══════════════════════════════════════════════════════════════════
function getSearchHistory() { return lsGet(SEARCH_HX_KEY, []); }

function addToSearchHistory(term) {
    if (!term) return;
    let hx = getSearchHistory().filter(function(t){ return t !== term; });
    hx.unshift(term);
    if (hx.length > 10) hx = hx.slice(0, 10);
    lsSet(SEARCH_HX_KEY, hx);
    renderSearchHistory();
}

function renderSearchHistory() {
    const row = document.getElementById('searchHistoryRow');
    row.innerHTML = '';
    const hx = getSearchHistory();
    hx.forEach(function(term) {
        const chip = document.createElement('span');
        chip.className   = 'search-chip';
        chip.textContent = term;
        chip.title       = term;
        chip.addEventListener('click', function() {
            document.getElementById('search-input').value = term;
            searchQuran(term);
        });
        row.appendChild(chip);
    });
}

// ═══════════════════════════════════════════════════════════════════
// READING HISTORY
// ═══════════════════════════════════════════════════════════════════
function markSuraAsRead(suraId) {
    const hx = lsGet(HISTORY_KEY, {});
    hx[String(suraId)] = Date.now();
    lsSet(HISTORY_KEY, hx);
}

function hasSuraBeenRead(suraId) {
    const hx = lsGet(HISTORY_KEY, {});
    return !!hx[String(suraId)];
}

// ═══════════════════════════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════════════════════════
function getBookmarks() { return lsGet(BOOKMARKS_KEY, []); }

function verseKey(suraId, verseIdx) { return suraId + '_' + verseIdx; }

function isBookmarked(suraId, verseIdx) {
    return getBookmarks().some(function(b){ return b.key === verseKey(suraId, verseIdx); });
}

function addBookmark(suraId, verseIdx, verseText, suraName) {
    const bms = getBookmarks();
    const key = verseKey(suraId, verseIdx);
    if (bms.some(function(b){ return b.key === key; })) return;
    bms.unshift({ key: key, suraId: suraId, verseIdx: verseIdx, text: verseText, suraName: suraName });
    lsSet(BOOKMARKS_KEY, bms);
    renderBookmarksList();
}

function removeBookmark(key) {
    const bms = getBookmarks().filter(function(b){ return b.key !== key; });
    lsSet(BOOKMARKS_KEY, bms);
    renderBookmarksList();
    // Update button state if visible
    const suraEl = document.querySelector('.sura');
    if (suraEl) reapplyVerseActions(suraEl.id);
}

// v9.6: Desktop saved hub — bookmarks / notes / highlights
var _desktopSavedTab = 'bookmarks';

function renderSavedHubDesktop(tab) {
    if (tab) _desktopSavedTab = tab;
    const list = document.getElementById('bookmarks-list');
    list.innerHTML = '';

    const bms      = getBookmarks();
    const notesArr = getNotesList();
    const hlArr    = getHighlightsList();

    // Update tab counts
    document.querySelectorAll('.saved-tab').forEach(function(b) {
        var t = b.getAttribute('data-savedtab');
        var count = t === 'bookmarks' ? bms.length : t === 'notes' ? notesArr.length : hlArr.length;
        var icon = t === 'bookmarks' ? '🔖 Bookmarks' : t === 'notes' ? '📝 Notes' : '✦ Highlights';
        b.textContent = icon + (count ? ' (' + count + ')' : '');
        b.classList.toggle('active', t === _desktopSavedTab);
    });

    var lbl = document.getElementById('bookmarks-label');
    var resetBtn = document.getElementById('bookmarksReset');

    if (_desktopSavedTab === 'bookmarks') {
        if (lbl) lbl.textContent = '🔖 Bookmarks' + (bms.length ? ' (' + bms.length + ')' : '');
        if (resetBtn) {
            resetBtn.style.display = bms.length ? '' : 'none';
            resetBtn.title = 'Clear all bookmarks';
        }
        if (bms.length === 0) {
            list.innerHTML = '<div class="bookmarks-empty"><div class="bookmarks-empty-icon">🔖</div><div>No bookmarks yet</div><div class="bookmarks-empty-hint">Hover a verse and click 🔖 to save it.</div></div>';
            return;
        }
        bms.forEach(function(b) {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            const removeBtn = document.createElement('button');
            removeBtn.className = 'bookmark-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function(e){ e.stopPropagation(); removeBookmark(b.key); });
            const surahEl = document.createElement('div');
            surahEl.className = 'bookmark-surah';
            surahEl.textContent = b.suraName + ' · v.' + (b.verseIdx + 1);
            const verseEl = document.createElement('div');
            verseEl.className = 'bookmark-verse';
            verseEl.textContent = b.text;
            item.appendChild(removeBtn); item.appendChild(surahEl); item.appendChild(verseEl);
            item.addEventListener('click', function() {
                displaySingleSura(b.suraId);
                setTimeout(function() {
                    const verses = document.querySelectorAll('.verse');
                    if (verses[b.verseIdx]) verses[b.verseIdx].scrollIntoView({ behavior:'smooth' });
                }, 100);
            });
            list.appendChild(item);
        });

    } else if (_desktopSavedTab === 'notes') {
        if (lbl) lbl.textContent = '📝 Notes' + (notesArr.length ? ' (' + notesArr.length + ')' : '');
        if (resetBtn) {
            resetBtn.style.display = notesArr.length ? '' : 'none';
            resetBtn.title = 'Clear all notes';
        }
        if (notesArr.length === 0) {
            list.innerHTML = '<div class="bookmarks-empty"><div class="bookmarks-empty-icon">📝</div><div>No notes yet</div><div class="bookmarks-empty-hint">Hover a verse and click 📝 to add a note.</div></div>';
            return;
        }
        notesArr.forEach(function(n) {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            const actions = document.createElement('div');
            actions.className = 'note-actions-row';
            const editBtn = document.createElement('button');
            editBtn.className = 'note-edit-btn'; editBtn.textContent = '✎'; editBtn.title = 'Edit note';
            editBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                displaySingleSura(n.suraId);
                setTimeout(function() {
                    const verses = document.querySelectorAll('.verse');
                    if (verses[n.verseIdx]) {
                        verses[n.verseIdx].scrollIntoView({ behavior: 'smooth' });
                        var noteBtn = verses[n.verseIdx].querySelector('.verse-action-btn:nth-child(3)');
                        if (noteBtn) setTimeout(function(){ openNoteModal(n.suraId, n.verseIdx, noteBtn); }, 200);
                    }
                }, 100);
            });
            const removeBtn = document.createElement('button');
            removeBtn.className = 'bookmark-remove'; removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function(e){
                e.stopPropagation();
                deleteNoteByKey(n.key);
                renderSavedHubDesktop();
            });
            actions.appendChild(editBtn); actions.appendChild(removeBtn);
            item.appendChild(actions);
            const surahEl = document.createElement('div');
            surahEl.className = 'bookmark-surah';
            surahEl.textContent = n.suraName + ' · v.' + (n.verseIdx + 1);
            const noteText = document.createElement('div');
            noteText.className = 'note-text-preview';
            noteText.textContent = n.text;
            const verseText = document.createElement('div');
            verseText.className = 'bookmark-verse';
            verseText.style.opacity = '0.55';
            verseText.style.fontSize = '12px';
            verseText.style.marginTop = '4px';
            verseText.textContent = n.verseText;
            item.appendChild(surahEl); item.appendChild(noteText); item.appendChild(verseText);
            item.addEventListener('click', function() {
                displaySingleSura(n.suraId);
                setTimeout(function() {
                    const verses = document.querySelectorAll('.verse');
                    if (verses[n.verseIdx]) verses[n.verseIdx].scrollIntoView({ behavior:'smooth' });
                }, 100);
            });
            list.appendChild(item);
        });

    } else { // highlights
        if (lbl) lbl.textContent = '✦ Highlights' + (hlArr.length ? ' (' + hlArr.length + ')' : '');
        if (resetBtn) {
            resetBtn.style.display = hlArr.length ? '' : 'none';
            resetBtn.title = 'Clear all highlights';
        }
        if (hlArr.length === 0) {
            list.innerHTML = '<div class="bookmarks-empty"><div class="bookmarks-empty-icon">✦</div><div>No highlights yet</div><div class="bookmarks-empty-hint">Hover a verse and click ✦ Highlight.</div></div>';
            return;
        }
        hlArr.forEach(function(h) {
            const item = document.createElement('div');
            item.className = 'bookmark-item bookmark-highlight';
            const removeBtn = document.createElement('button');
            removeBtn.className = 'bookmark-remove'; removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function(e){
                e.stopPropagation();
                deleteHighlightByKey(h.key);
                renderSavedHubDesktop();
            });
            item.appendChild(removeBtn);
            const surahEl = document.createElement('div');
            surahEl.className = 'bookmark-surah';
            surahEl.textContent = h.suraName + ' · v.' + (h.verseIdx + 1);
            const verseEl = document.createElement('div');
            verseEl.className = 'bookmark-verse';
            verseEl.textContent = h.verseText;
            item.appendChild(surahEl); item.appendChild(verseEl);
            item.addEventListener('click', function() {
                displaySingleSura(h.suraId);
                setTimeout(function() {
                    const verses = document.querySelectorAll('.verse');
                    if (verses[h.verseIdx]) verses[h.verseIdx].scrollIntoView({ behavior:'smooth' });
                }, 100);
            });
            list.appendChild(item);
        });
    }
}

// Compatibility wrapper — renderBookmarksList now delegates to the hub
function renderBookmarksList() {
    renderSavedHubDesktop(_desktopSavedTab);
}


// ── v9.5: Reset all bookmarks (with confirmation) ─────────────────
function resetAllBookmarks() {
    var bms = getBookmarks();
    if (bms.length === 0) return;
    showConfirm(
        'Clear all bookmarks?',
        'This removes all ' + bms.length + ' saved verse' + (bms.length === 1 ? '' : 's') + '. You can\'t undo this action.',
        function() {
            lsSet(BOOKMARKS_KEY, []);
            renderBookmarksList();
            var suraEl = document.querySelector('.sura');
            if (suraEl) reapplyVerseActions(suraEl.id);
            refreshSavedHub();
        }
    );
}

// Wire desktop tab switching
document.querySelectorAll('.saved-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        _desktopSavedTab = btn.getAttribute('data-savedtab');
        renderSavedHubDesktop();
    });
});

// Reset button on desktop should now be tab-aware
document.getElementById('bookmarksReset').onclick = function() {
    if (_desktopSavedTab === 'notes')           resetAllNotes();
    else if (_desktopSavedTab === 'highlights') resetAllHighlights();
    else                                        resetAllBookmarks();
};

// ═══════════════════════════════════════════════════════════════════
// VERSE HIGHLIGHTING
// ═══════════════════════════════════════════════════════════════════
function getHighlights() { return lsGet(HIGHLIGHTS_KEY, {}); }

function isHighlighted(suraId, verseIdx) {
    return !!getHighlights()[verseKey(suraId, verseIdx)];
}

function toggleHighlight(suraId, verseIdx, verseEl, btn) {
    const hl  = getHighlights();
    const key = verseKey(suraId, verseIdx);
    if (hl[key]) {
        delete hl[key];
        verseEl.classList.remove('verse-highlighted');
        btn.classList.remove('active');
    } else {
        hl[key] = true;
        verseEl.classList.add('verse-highlighted');
        btn.classList.add('active');
    }
    lsSet(HIGHLIGHTS_KEY, hl);
}

// ═══════════════════════════════════════════════════════════════════
// PERSONAL NOTES
// ═══════════════════════════════════════════════════════════════════
function getNotes() { return lsGet(NOTES_KEY, {}); }

let noteModalTarget = null; // {suraId, verseIdx, noteBtn}

function openNoteModal(suraId, verseIdx, noteBtn) {
    noteModalTarget = { suraId: suraId, verseIdx: verseIdx, noteBtn: noteBtn };
    const notes = getNotes();
    const key   = verseKey(suraId, verseIdx);
    document.getElementById('noteModalText').value  = notes[key] || '';
    document.getElementById('noteModalTitle').textContent = 'Note — verse ' + (verseIdx + 1);
    document.getElementById('noteModal').style.display = 'flex';
    document.getElementById('noteModalText').focus();
}

function closeNoteModal() {
    document.getElementById('noteModal').style.display = 'none';
    noteModalTarget = null;
}

document.getElementById('noteModalClose').addEventListener('click', closeNoteModal);

document.getElementById('noteModalSave').addEventListener('click', function() {
    if (!noteModalTarget) return;
    const notes = getNotes();
    const key   = verseKey(noteModalTarget.suraId, noteModalTarget.verseIdx);
    const text  = document.getElementById('noteModalText').value.trim();
    if (text) {
        notes[key] = text;
        noteModalTarget.noteBtn.classList.add('active');
        // Add/update dot
        let dot = noteModalTarget.noteBtn.querySelector('.note-dot');
        if (!dot) { dot = document.createElement('span'); dot.className = 'note-dot'; noteModalTarget.noteBtn.appendChild(dot); }
    } else {
        delete notes[key];
        noteModalTarget.noteBtn.classList.remove('active');
        const dot = noteModalTarget.noteBtn.querySelector('.note-dot');
        if (dot) dot.remove();
    }
    lsSet(NOTES_KEY, notes);
    closeNoteModal();
});

document.getElementById('noteModalDelete').addEventListener('click', function() {
    if (!noteModalTarget) return;
    const notes = getNotes();
    const key   = verseKey(noteModalTarget.suraId, noteModalTarget.verseIdx);
    delete notes[key];
    lsSet(NOTES_KEY, notes);
    noteModalTarget.noteBtn.classList.remove('active');
    const dot = noteModalTarget.noteBtn.querySelector('.note-dot');
    if (dot) dot.remove();
    closeNoteModal();
});

// Close on overlay click
document.getElementById('noteModal').addEventListener('click', function(e) {
    if (e.target === this) closeNoteModal();
});


// ── v9.6: Notes list helpers ──────────────────────────────────────
function getNotesList() {
    var notes = getNotes();
    var arr = [];
    Object.keys(notes).forEach(function(key) {
        var parts = key.split('_'); // suraId_verseIdx
        var suraId = parts[0];
        var verseIdx = parseInt(parts[1]);
        var sura = quranData.find(function(s){ return s.id === String(suraId); });
        if (!sura) return;
        var verseText = sura.verses[verseIdx] ? sura.verses[verseIdx].text : '';
        arr.push({ key: key, suraId: suraId, verseIdx: verseIdx, text: notes[key], suraName: sura.name, verseText: verseText });
    });
    return arr;
}

function deleteNoteByKey(key) {
    var notes = getNotes();
    delete notes[key];
    lsSet(NOTES_KEY, notes);
    var suraEl = document.querySelector('.sura');
    if (suraEl) reapplyVerseActions(suraEl.id);
}

function resetAllNotes() {
    var notes = getNotes();
    var count = Object.keys(notes).length;
    if (count === 0) return;
    showConfirm(
        'Clear all notes?',
        'This removes all ' + count + ' note' + (count === 1 ? '' : 's') + '. You can\'t undo this action.',
        function() {
            lsSet(NOTES_KEY, {});
            var suraEl = document.querySelector('.sura');
            if (suraEl) reapplyVerseActions(suraEl.id);
            // Refresh saved hub if open
            refreshSavedHub();
            renderDesktopNotesList();
        }
    );
}

// ── v9.6: Highlights list helpers ─────────────────────────────────
function getHighlightsList() {
    var hl = getHighlights();
    var arr = [];
    Object.keys(hl).forEach(function(key) {
        var parts = key.split('_');
        var suraId = parts[0];
        var verseIdx = parseInt(parts[1]);
        var sura = quranData.find(function(s){ return s.id === String(suraId); });
        if (!sura) return;
        var verseText = sura.verses[verseIdx] ? sura.verses[verseIdx].text : '';
        arr.push({ key: key, suraId: suraId, verseIdx: verseIdx, suraName: sura.name, verseText: verseText });
    });
    return arr;
}

function deleteHighlightByKey(key) {
    var hl = getHighlights();
    delete hl[key];
    lsSet(HIGHLIGHTS_KEY, hl);
    var suraEl = document.querySelector('.sura');
    if (suraEl) reapplyVerseActions(suraEl.id);
}

function resetAllHighlights() {
    var hl = getHighlights();
    var count = Object.keys(hl).length;
    if (count === 0) return;
    showConfirm(
        'Clear all highlights?',
        'This removes all ' + count + ' highlight' + (count === 1 ? '' : 's') + '. You can\'t undo this action.',
        function() {
            lsSet(HIGHLIGHTS_KEY, {});
            var suraEl = document.querySelector('.sura');
            if (suraEl) reapplyVerseActions(suraEl.id);
            refreshSavedHub();
            renderDesktopNotesList();
        }
    );
}

function refreshSavedHub() {
    var sheet = document.getElementById('mobileSheet');
    if (sheet && sheet.classList.contains('open') && _sheetCurrentAction === 'bookmarks') {
        var body = document.getElementById('mobileSheetBody');
        var title = document.getElementById('mobileSheetTitle');
        if (body && title) { body.innerHTML = ''; buildSheetBookmarks(body, title); }
    }
}

function renderDesktopNotesList() {
    // Hook for desktop notes panel update — implemented if panel is visible
    var panel = document.getElementById('savedHubPanel');
    if (panel && panel.classList.contains('savedHubContainer')) {
        renderSavedHubDesktop(_savedHubActiveTab || 'bookmarks');
    }
}

// ═══════════════════════════════════════════════════════════════════
// MULTI-LANGUAGE
// ═══════════════════════════════════════════════════════════════════
const langLabels = { arabic:'Arabic', french:'Français', english:'English', spanish:'Español' };
const langColors  = ['#7ab8d4','#a0c878','#d4a07a','#c87aab','#a07ad4'];

function getLangColor(code) {
    const idx = additionalLanguages.indexOf(code);
    return langColors[Math.max(0,idx) % langColors.length];
}

function applyLanguageToVerses(langCode) {
    const data   = xmlCache[langCode]; if (!data) return;
    const suraEl = document.querySelector('.sura'); if (!suraEl) return;
    const sura   = data[parseInt(suraEl.id)]; if (!sura) return;
    const color  = getLangColor(langCode);
    document.querySelectorAll('.verse').forEach(function(verseEl, i) {
        if (sura.verses[i]) {
            const p = document.createElement('p');
            p.className = 'secondary-verse'; p.dataset.lang = langCode;
            p.textContent = sura.verses[i].text; p.style.color = color;
            // Insert before verse-actions if present
            const actions = verseEl.querySelector('.verse-actions');
            if (actions) verseEl.insertBefore(p, actions);
            else verseEl.appendChild(p);
        }
    });
}

function removeLanguageFromVerses(langCode) {
    document.querySelectorAll('[data-lang="'+langCode+'"]').forEach(function(el){ el.remove(); });
}

function removeAllSecondaryVerses() {
    document.querySelectorAll('.secondary-verse').forEach(function(el){ el.remove(); });
}

async function addSecondaryLanguage(langCode) {
    if (additionalLanguages.indexOf(langCode) !== -1) return;
    additionalLanguages.push(langCode);
    if (!xmlCache[langCode]) {
        try { await fetchAndParseQuran(langCode); } catch(e) { console.error('Error', langCode, e); return; }
    }
    applyLanguageToVerses(langCode); addLangTagToUI(langCode); saveState();
}

function removeSecondaryLanguage(langCode) {
    additionalLanguages = additionalLanguages.filter(function(c){ return c !== langCode; });
    removeLanguageFromVerses(langCode); removeLangTagFromUI(langCode); restoreLangOption(langCode); saveState();
}

function clearAllSecondaryLanguages() {
    additionalLanguages.slice().forEach(restoreLangOption);
    additionalLanguages = []; removeAllSecondaryVerses();
    document.getElementById('langTagsContainer').innerHTML = '';
}

function addLangTagToUI(langCode) {
    const container = document.getElementById('langTagsContainer');
    const row = document.createElement('div');
    row.className = 'lang-tag-row'; row.id = 'lang-tag-' + langCode;
    const color = getLangColor(langCode); row.style.borderColor = color + '40';
    const label = document.createElement('span');
    label.className = 'lang-tag-label'; label.textContent = langLabels[langCode]||langCode; label.style.color = color;
    const btn = document.createElement('button');
    btn.className = 'lang-tag-remove'; btn.textContent = '✕';
    btn.addEventListener('click', function(){ removeSecondaryLanguage(langCode); });
    row.appendChild(label); row.appendChild(btn); container.appendChild(row);
    removeLangOption(langCode);
}

function removeLangTagFromUI(langCode) { const t = document.getElementById('lang-tag-'+langCode); if (t) t.remove(); }

function removeLangOption(langCode) {
    const sel = document.getElementById('SurahLanguageSelector');
    const opt = sel.querySelector('option[value="'+langCode+'"]'); if (opt) opt.remove();
}

function restoreLangOption(langCode) {
    const sel = document.getElementById('SurahLanguageSelector');
    if (langCode === currentLanguage) return;
    if (sel.querySelector('option[value="'+langCode+'"]')) return;
    const opt = document.createElement('option'); opt.value = langCode;
    opt.textContent = langLabels[langCode]||langCode; sel.appendChild(opt);
}

// ═══════════════════════════════════════════════════════════════════
// LOAD QURAN DATA
// ═══════════════════════════════════════════════════════════════════
async function loadQuranData(targetSuraId) {
    clearSuraContext(); isArabic = (currentLanguage === 'arabic');
    const suraEl = document.querySelector('.sura');
    const suraToShow = (targetSuraId !== undefined && targetSuraId !== null)
        ? targetSuraId : (suraEl ? +suraEl.getAttribute('id') : 0);
    try {
        quranData = await fetchAndParseQuran(currentLanguage);
        renderCurrentTOC();
        displaySingleSura(suraToShow);
        document.getElementById('arabic-options').style.display = isArabic ? 'block' : 'none';
        saveState();
    } catch(e) { console.error('Error loading:', e); }
}

async function loadRevelationOrderQuranData() {
    isArabic = (currentLanguage === 'arabic');
    try {
        quranData = await fetchAndParseQuran(currentLanguage);
        generateRevelationTOC();
        document.getElementById('arabic-options').style.display = isArabic ? 'block' : 'none';
        saveState();
    } catch(e) { console.error('Error loading:', e); }
}

// ═══════════════════════════════════════════════════════════════════
// JUZ DATA
// Each entry: [juzNumber, arabicName, suraIndex(0-based), ayahNumber(1-based), startSuraName]
// ═══════════════════════════════════════════════════════════════════
const JUZ_DATA = [
    [1,  'الجزء الأول',    0,  1,  'Al-Fatiha'],
    [2,  'الجزء الثاني',   1,  142,'Al-Baqara'],
    [3,  'الجزء الثالث',   1,  253,'Al-Baqara'],
    [4,  'الجزء الرابع',   2,  92, 'Al-Imran'],
    [5,  'الجزء الخامس',   3,  24, 'An-Nisa'],
    [6,  'الجزء السادس',   3,  148,'An-Nisa'],
    [7,  'الجزء السابع',   4,  82, 'Al-Maidah'],
    [8,  'الجزء الثامن',   5,  111,'Al-An\'am'],
    [9,  'الجزء التاسع',   6,  88, 'Al-A\'raf'],
    [10, 'الجزء العاشر',   7,  41, 'Al-Anfal'],
    [11, 'الجزء الحادي عشر', 8, 93, 'At-Tawbah'],
    [12, 'الجزء الثاني عشر',10,  6, 'Hud'],
    [13, 'الجزء الثالث عشر',11, 53, 'Yusuf'],
    [14, 'الجزء الرابع عشر',14,  1, 'Al-Hijr'],
    [15, 'الجزء الخامس عشر',16,  1, 'Al-Isra'],
    [16, 'الجزء السادس عشر',17, 75, 'Al-Kahf'],
    [17, 'الجزء السابع عشر',20,  1, 'Al-Anbiya'],
    [18, 'الجزء الثامن عشر',22,  1, 'Al-Muminun'],
    [19, 'الجزء التاسع عشر',24, 21, 'Al-Furqan'],
    [20, 'الجزء العشرون',  26, 56, 'An-Naml'],
    [21, 'الجزء الحادي والعشرون',28,46,'Al-Ankabut'],
    [22, 'الجزء الثاني والعشرون',32,31,'Al-Ahzab'],
    [23, 'الجزء الثالث والعشرون',35,28,'Ya-Sin'],
    [24, 'الجزء الرابع والعشرون',38,32,'Az-Zumar'],
    [25, 'الجزء الخامس والعشرون',40,47,'Fussilat'],
    [26, 'الجزء السادس والعشرون',45, 1,'Al-Ahqaf'],
    [27, 'الجزء السابع والعشرون',50,31,'Adh-Dhariyat'],
    [28, 'الجزء الثامن والعشرون',57, 1,'Al-Mujadila'],
    [29, 'الجزء التاسع والعشرون',66, 1,'Al-Mulk'],
    [30, 'الجزء الثلاثون',  77, 1,'An-Naba']
];

// ═══════════════════════════════════════════════════════════════════
// TOC BUILDERS
// ═══════════════════════════════════════════════════════════════════
function makeCityIcon(city) {
    const img = document.createElement('img');
    img.src   = city === 'Makkah' ? 'img/makkah-icon.png' : 'img/madinah-icon.png';
    img.alt   = city; img.title = city; img.classList.add('city-icon');
    return img;
}

function buildTocItem(name, city, displayIndex, clickHandler, suraId) {
    const item  = document.createElement('div');
    item.classList.add('toc-item');
    const left  = document.createElement('span');
    left.classList.add('toc-item-left');
    left.appendChild(makeCityIcon(city));
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('toc-item-name');
    nameSpan.textContent = (displayIndex + 1) + '. ' + name;
    // Reading history dot
    if (suraId !== undefined && hasSuraBeenRead(suraId)) {
        const dot = document.createElement('span');
        dot.className = 'history-dot'; dot.title = 'Previously read';
        nameSpan.appendChild(dot);
    }
    left.appendChild(nameSpan);
    const right = document.createElement('span');
    right.classList.add('toc-item-right');
    const num = document.createElement('span');
    num.classList.add('toc-num'); num.textContent = displayIndex + 1;
    right.appendChild(num);
    item.appendChild(left); item.appendChild(right);
    item.addEventListener('click', clickHandler);
    return item;
}

function setActiveTocItem(el) {
    document.querySelectorAll('.toc-item, .juz-item').forEach(function(i){ i.classList.remove('toc-active'); });
    if (el) el.classList.add('toc-active');
}

function getScrollWrap() {
    const sw = document.getElementById('toc-scroll');
    if (sw) { sw.innerHTML = ''; return sw; }
    // Fallback: create fresh scroll area in tocContainer
    const container = document.getElementById('tocContainer');
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'toc-scroll'; scrollWrap.id = 'toc-scroll';
    container.appendChild(scrollWrap);
    return scrollWrap;
}

function setTocLabel(text) {
    const lbl = document.getElementById('toc-section-label');
    if (lbl) lbl.textContent = text;
}

function generateTOC() {
    activeTocTab = 'surah';
    setTocTabActive('surah');
    setTocLabel('📖 114 Surahs');
    const sw = getScrollWrap();
    quranData.forEach(function(sura, index) {
        const item = buildTocItem(sura.name, sura.city, index, function() {
            clearSuraContext(); clearAllSecondaryLanguages(); closeSearchResults();
            displaySingleSura(index); setActiveTocItem(item);
        }, index);
        sw.appendChild(item);
    });
    applyTocWidth();
}

const RevelationOrder = [96,68,73,74,1,111,81,87,92,89,93,94,103,100,108,102,107,109,105,113,114,112,53,80,97,91,85,95,106,101,75,104,77,50,90,86,54,38,7,72,36,25,35,19,20,56,26,27,28,17,10,11,12,15,6,37,31,34,39,40,41,42,43,44,45,46,51,88,18,16,71,14,21,23,32,52,67,69,70,78,79,82,84,30,29,83,2,8,3,33,60,4,99,57,47,13,55,76,65,98,59,24,22,63,58,49,66,64,61,62,48,5,9,110];

function generateRevelationTOC() {
    activeTocTab = 'revelation';
    setTocTabActive('revelation');
    setTocLabel('📖 Revelation Order');
    const sw = getScrollWrap();
    RevelationOrder.forEach(function(suraNum, index) {
        const source = quranData[suraNum - 1]; if (!source) return;
        const item = buildTocItem(source.name, source.city, index, function() {
            clearAllSecondaryLanguages(); closeSearchResults();
            displaySingleRevelationSura(suraNum); setActiveTocItem(item);
        }, suraNum - 1);
        sw.appendChild(item);
    });
    applyTocWidth();
}

function generateJuzTOC() {
    activeTocTab = 'juz';
    setTocTabActive('juz');
    setTocLabel('📚 30 Juz (أجزاء)');
    const sw = getScrollWrap();
    JUZ_DATA.forEach(function(juz) {
        const juzNum    = juz[0];
        const juzAr     = juz[1];
        const suraIdx   = juz[2];
        const ayahNum   = juz[3];
        const startName = juz[4];
        const item = document.createElement('div');
        item.classList.add('juz-item');
        const numEl = document.createElement('span');
        numEl.classList.add('juz-num'); numEl.textContent = juzNum;
        const info = document.createElement('span');
        info.classList.add('juz-info');
        const nameEl = document.createElement('span');
        nameEl.classList.add('juz-name'); nameEl.textContent = juzAr;
        const subEl = document.createElement('span');
        subEl.classList.add('juz-sub'); subEl.textContent = 'Starts: ' + startName + (ayahNum > 1 ? ' v.' + ayahNum : '');
        info.appendChild(nameEl); info.appendChild(subEl);
        item.appendChild(numEl); item.appendChild(info);
        item.addEventListener('click', function() {
            clearAllSecondaryLanguages(); closeSearchResults(); clearSuraContext();
            displaySingleSura(suraIdx);
            setActiveTocItem(item);
            // Scroll to correct ayah after render
            if (ayahNum > 1) {
                setTimeout(function() {
                    const verses = document.querySelectorAll('.verse');
                    const target = verses[ayahNum - 1];
                    if (target) target.scrollIntoView({ behavior:'smooth' });
                }, 150);
            }
        });
        sw.appendChild(item);
    });
    applyTocWidth();
}

function renderCurrentTOC() {
    if (activeTocTab === 'juz')        generateJuzTOC();
    else if (activeTocTab === 'revelation') generateRevelationTOC();
    else                                generateTOC();
}

function setTocTabActive(tab) {
    document.querySelectorAll('.toc-tab').forEach(function(btn) {
        btn.classList.toggle('toc-tab-active', btn.getAttribute('data-tab') === tab);
    });
}

function applyTocWidth() {
    try {
        const sw = parseInt(localStorage.getItem('quranTocWidth'), 10);
        if (sw && sw >= 140) scaleTocFont(sw);
    } catch(e) {}
}

// Tab click listeners
document.querySelectorAll('.toc-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const tab = btn.getAttribute('data-tab');
        if (tab === 'surah')       generateTOC();
        else if (tab === 'juz')    generateJuzTOC();
        else                       generateRevelationTOC();
        saveState();
    });
});

// ═══════════════════════════════════════════════════════════════════
// VERSE RENDERING WITH ACTIONS
// ═══════════════════════════════════════════════════════════════════
function buildVerseActions(suraId, verseIdx, verseText, suraName) {
    const actions = document.createElement('div');
    actions.classList.add('verse-actions');

    // Highlight button
    const hlBtn = document.createElement('button');
    hlBtn.className   = 'verse-action-btn';
    hlBtn.textContent = '✦ Highlight';
    if (isHighlighted(suraId, verseIdx)) hlBtn.classList.add('active');
    hlBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleHighlight(suraId, verseIdx, hlBtn.closest('.verse'), hlBtn);
    });

    // Bookmark button
    const bkBtn = document.createElement('button');
    bkBtn.className   = 'verse-action-btn';
    bkBtn.textContent = '🔖';
    if (isBookmarked(suraId, verseIdx)) bkBtn.classList.add('active');
    bkBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isBookmarked(suraId, verseIdx)) {
            removeBookmark(verseKey(suraId, verseIdx));
            bkBtn.classList.remove('active');
        } else {
            addBookmark(suraId, verseIdx, verseText, suraName);
            bkBtn.classList.add('active');
        }
    });

    // Note button
    const noteBtn = document.createElement('button');
    noteBtn.className   = 'verse-action-btn';
    noteBtn.textContent = '📝';
    const notes = getNotes();
    if (notes[verseKey(suraId, verseIdx)]) {
        noteBtn.classList.add('active');
        const dot = document.createElement('span'); dot.className = 'note-dot';
        noteBtn.appendChild(dot);
    }
    noteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openNoteModal(suraId, verseIdx, noteBtn);
    });

    actions.appendChild(hlBtn);
    actions.appendChild(bkBtn);
    actions.appendChild(noteBtn);
    return actions;
}

function buildSuraDOM(sura) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('sura'); wrapper.id = sura.id;

    // v9.5: Sticky title bar at top of reading pane
    const sticky = document.createElement('div');
    sticky.className = 'sura-sticky-title';
    sticky.textContent = (parseInt(sura.id) + 1) + ' · ' + sura.name;
    wrapper.appendChild(sticky);

    const title = document.createElement('h2');
    title.id = 'suraTitle';
    title.textContent = (parseInt(sura.id) + 1) + ' — ' + sura.name;
    wrapper.appendChild(title);
    sura.verses.forEach(function(verse, verseIdx) {
        const p = document.createElement('p');
        p.classList.add('verse');
        if (isArabic) p.classList.add('right-align');
        if (isHighlighted(sura.id, verseIdx)) p.classList.add('verse-highlighted');
        p.innerHTML = highlightText(verse.text, '');
        const icon = document.createElement('span');
        icon.classList.add('verse-icon');
        icon.innerHTML = '<span class="icon-number">' + verse.number + '</span>';
        p.appendChild(icon);
        p.appendChild(buildVerseActions(sura.id, verseIdx, verse.text, sura.name));
        wrapper.appendChild(p);
    });
    return wrapper;
}

function reapplyVerseActions(suraId) {
    const suraEl  = document.getElementById(suraId); if (!suraEl) return;
    const sura    = quranData.find(function(s){ return s.id === String(suraId); }); if (!sura) return;
    const verses  = suraEl.querySelectorAll('.verse');
    verses.forEach(function(verseEl, verseIdx) {
        const old = verseEl.querySelector('.verse-actions');
        if (old) old.remove();
        verseEl.appendChild(buildVerseActions(suraId, verseIdx, sura.verses[verseIdx].text, sura.name));
        if (isHighlighted(suraId, verseIdx)) verseEl.classList.add('verse-highlighted');
        else verseEl.classList.remove('verse-highlighted');
    });
}

function displaySingleSura(suraId) {
    const sura = quranData.find(function(s){ return s.id === String(suraId); });
    if (!sura) return;
    const container = document.getElementById('quranContainer');
    container.innerHTML = '';
    container.appendChild(buildSuraDOM(sura));
    container.classList.replace('eraseDiv','textContainer');
    container.scrollTop = 0;
    clearSuraContext();
    markSuraAsRead(suraId);
    saveState();
}

function displaySingleRevelationSura(suraNum) {
    const sura = quranData.find(function(s){ return s.id === String(suraNum-1); });
    if (!sura) return;
    const container = document.getElementById('quranContainer');
    container.innerHTML = '';
    container.appendChild(buildSuraDOM(sura));
    container.classList.replace('eraseDiv','textContainer');
    const ctx = document.getElementById('suraContent');
    ctx.classList.replace('sura-contexte','eraseDiv'); ctx.innerHTML = '';
    markSuraAsRead(suraNum - 1);
    saveState();
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════
function highlightText(text, term) {
    if (!term) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return text.replace(new RegExp('('+escaped+')','gi'),'<span class="highlight">$1</span>');
}

function searchSourat(word) {
    const container = document.getElementById('quranContainer'); if (!container.firstChild) return;
    const sura = quranData.find(function(s){ return s.id === container.firstChild.id; }); if (!sura) return;
    const ignoreDia = getIgnoreDiacritics();
    const sw = normalize(word, ignoreDia).toLowerCase();
    const matched = sura.verses.filter(function(v){ return normalize(v.text,ignoreDia).toLowerCase().includes(sw); });
    displaySearchResultsForSourat(matched, sura, word);
    addToSearchHistory(word); saveState();
}

function searchQuran(word) {
    const ignoreDia  = getIgnoreDiacritics();
    const searchTerm = normalize(word, ignoreDia).toLowerCase();
    const matched = quranData.flatMap(function(sura){
        return sura.verses
            .map(function(v){ return { suraName:sura.name, suraId:sura.id, verseNumber:v.number, verseText:normalize(v.text,ignoreDia) }; })
            .filter(function(v){ return v.verseText.toLowerCase().includes(searchTerm); });
    });
    displaySearchResults(matched, word);
    addToSearchHistory(word); saveState();
}

function showResultsContainer(summaryText) {
    document.getElementById('resultsContainerID').classList.replace('eraseDiv','resultsContainer');
    document.getElementById('results-label').textContent = summaryText || 'Results';
}

function closeSearchResults() {
    document.getElementById('resultsContainerID').classList.replace('resultsContainer','eraseDiv');
    const r = document.getElementById('search-results');
    r.innerHTML = ''; r.classList.replace('resultsClass','eraseDiv');
    saveState();
}

function resetSearch() {
    document.getElementById('search-input').value = '';
    const first = document.getElementById('quranContainer').firstChild;
    if (first) displaySingleSura(first.id);
    closeSearchResults();
}

function displaySearchResultsForSourat(verses, sura, word) {
    const ignoreDia = getIgnoreDiacritics();
    const sw = normalize(word, ignoreDia);
    const escaped = sw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    let totalMatches = 0;
    verses.forEach(function(v){ totalMatches += (normalize(v.text,ignoreDia).match(new RegExp(escaped,'gi'))||[]).length; });
    showResultsContainer(sura.name + ' · ' + totalMatches + ' matches');
    const el = document.getElementById('search-results');
    el.innerHTML = ''; el.classList.replace('eraseDiv','resultsClass');
    const total = document.createElement('div'); total.classList.add('total-matches');
    total.textContent = totalMatches + ' occurrences in ' + verses.length + ' verse(s)';
    el.appendChild(total);
    if (totalMatches === 0) { el.innerHTML += '<div>No results.</div>'; return; }
    verses.forEach(function(verse){
        const vt = normalize(verse.text, ignoreDia);
        const mc = (vt.match(new RegExp(escaped,'gi'))||[]).length; if (mc === 0) return;
        const row = document.createElement('div'); row.classList.add('search-result-item');
        row.textContent = '· verse ' + verse.number + ' ×' + mc;
        row.addEventListener('click', function(){ highlightAndScrollToVerse(sura.id, verse.number); });
        el.appendChild(row);
    });
}

function displaySearchResults(verses, word) {
    if (verses.length === 0) {
        showResultsContainer('No results');
        const el = document.getElementById('search-results');
        el.innerHTML = '<div style="padding:8px;font-size:0.82rem;opacity:0.6;">No results found.</div>';
        el.classList.replace('eraseDiv','resultsClass'); return;
    }
    const ignoreDia = getIgnoreDiacritics();
    const sw = normalize(word, ignoreDia);
    const escaped = sw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    let total = 0; const surahMap = new Map();
    verses.forEach(function(v){
        const mc = (v.verseText.match(new RegExp(escaped,'gi'))||[]).length; total += mc;
        if (!surahMap.has(v.suraName)) surahMap.set(v.suraName,[]);
        surahMap.get(v.suraName).push({ verseNumber:v.verseNumber, matchCount:mc, suraId:v.suraId });
    });
    showResultsContainer(total + ' matches · ' + surahMap.size + ' surahs');
    const el = document.getElementById('search-results');
    el.innerHTML = ''; el.classList.replace('eraseDiv','resultsClass');
    const totalEl = document.createElement('div'); totalEl.classList.add('total-matches');
    totalEl.textContent = total + ' occurrences across ' + verses.length + ' verse(s)'; el.appendChild(totalEl);
    surahMap.forEach(function(surahVerses, surahName){
        const group = document.createElement('div'); group.classList.add('surah-results');
        const h = document.createElement('h3'); h.classList.add('SearchResultSurah'); h.textContent = surahName; group.appendChild(h);
        surahVerses.forEach(function(v){
            const row = document.createElement('div'); row.classList.add('search-result-item');
            row.textContent = '· verse ' + v.verseNumber + ' ×' + v.matchCount;
            row.addEventListener('click', function(){ highlightAndScrollToVerse(v.suraId, v.verseNumber); });
            group.appendChild(row);
        });
        el.appendChild(group);
    });
}

function highlightAndScrollToVerse(suraId, verseNumber) {
    const currentEl = document.getElementById('quranContainer').firstChild;
    if (!currentEl || currentEl.id !== String(suraId)) displaySingleSura(suraId);
    const suraContainer = document.getElementById(suraId); if (!suraContainer) return;
    const verseEls = suraContainer.getElementsByClassName('verse');
    const suraData = quranData.find(function(s){ return s.id === String(suraId); }); if (!suraData) return;
    const term = document.getElementById('search-input').value.trim();
    Array.from(verseEls).forEach(function(el, i){
        // Rebuild verse content with highlight, keeping action buttons
        const actions = el.querySelector('.verse-actions');
        el.innerHTML = '';
        const span = document.createElement('span'); span.innerHTML = highlightText(suraData.verses[i].text, term);
        el.appendChild(span);
        const icon = document.createElement('span'); icon.classList.add('verse-icon');
        icon.innerHTML = '<span class="icon-number">' + (i+1) + '</span>';
        el.appendChild(icon);
        if (actions) el.appendChild(actions);
        else el.appendChild(buildVerseActions(suraId, i, suraData.verses[i].text, suraData.name));
    });
    const target = verseEls[verseNumber - 1];
    if (target) target.scrollIntoView({ behavior:'smooth' });
    clearSuraContext();
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXT PANEL
// ═══════════════════════════════════════════════════════════════════
function clearSuraContext() {
    contextOpen = false; contextSuraIndex = null;
    const ctx = document.getElementById('suraContent');
    if (ctx) { ctx.classList.replace('sura-contexte','eraseDiv'); ctx.innerHTML = ''; }
    document.getElementById('quranContainer').classList.replace('eraseDiv','textContainer');
    saveState();
}

async function fetchAndDisplayContext(suraIndex) {
    isArabic = (currentLanguage === 'arabic');
    async function tryFile(path) {
        try {
            const r = await fetch(path); if (!r.ok) return null;
            const xml = await r.text();
            const doc = new DOMParser().parseFromString(xml,'text/xml');
            return Array.from(doc.getElementsByTagName('sura')).find(function(s){ return s.getAttribute('index') === String(suraIndex); }) || null;
        } catch(e) { return null; }
    }
    const foundSura = await tryFile('data/context/context-'+currentLanguage+'1.xml')
                   || await tryFile('data/context/context-'+currentLanguage+'2.xml');
    const div = document.getElementById('suraContent');
    if (!foundSura) {
        div.innerHTML = '<p style="opacity:0.5;font-size:1.6rem;padding:20px;">Context not available for this surah.</p>';
        div.classList.replace('eraseDiv','sura-contexte');
    } else { displaySuraContext(foundSura); }
    contextOpen = true; contextSuraIndex = suraIndex; saveState();
}

function displaySuraContext(sura) {
    const div = document.getElementById('suraContent'); div.innerHTML = '';
    const sections = sura.getElementsByTagName('section'); let isFirst = true;
    Array.from(sections).forEach(function(section, idx){
        const sectionTitle = section.getElementsByTagName('title')[0].textContent;
        const contentEl    = section.getElementsByTagName('content')[0];
        const items        = contentEl.getElementsByTagName('title');
        const descs        = contentEl.getElementsByTagName('description');
        const article      = document.createElement('article');
        if (isFirst) {
            const intro = section.getElementsByTagName('introduction')[0];
            if (intro) { const p = document.createElement('p'); p.textContent = intro.textContent; article.appendChild(p); }
            isFirst = false;
        }
        const h2 = document.createElement('h2'); h2.textContent = (idx+1) + '. ' + sectionTitle; article.appendChild(h2);
        Array.from(items).forEach(function(item, i){
            const d = document.createElement('div'); d.className = 'item';
            const h3 = document.createElement('h3'); h3.textContent = item.textContent; d.appendChild(h3);
            const p  = document.createElement('p');  p.textContent = descs[i] ? descs[i].textContent : ''; d.appendChild(p);
            article.appendChild(d);
        });
        if (isArabic) div.classList.add('right-align'); else div.classList.remove('right-align');
        div.appendChild(article); div.classList.replace('eraseDiv','sura-contexte');
    });
    div.scrollTop = 0;
    document.getElementById('quranContainer').classList.replace('textContainer','eraseDiv');
}

// ═══════════════════════════════════════════════════════════════════
// THEME & SIDEBAR
// ═══════════════════════════════════════════════════════════════════
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-btn').forEach(function(btn){
        btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ═══════════════════════════════════════════════════════════════════
// TOC FONT SCALING
// ═══════════════════════════════════════════════════════════════════
function scaleTocFont(w) {
    const fs     = Math.round(Math.max(26, Math.min(42, 26 + (w-140)/40)));
    const pad    = Math.round(Math.max(10, Math.min(18, 10 + (w-140)/70)));
    const numSz  = Math.round(Math.max(18, Math.min(32, 18 + (w-140)/45)));
    const numDim = Math.round(Math.max(40, Math.min(64, 40 + (w-140)/26)));
    const iconSz = Math.round(Math.max(24, Math.min(42, 24 + (w-140)/28)));
    const juzSz  = Math.round(Math.max(20, Math.min(36, 20 + (w-140)/40)));

    document.querySelectorAll('.toc-item').forEach(function(el){
        el.style.fontSize = fs + 'px'; el.style.padding = pad + 'px 14px ' + pad + 'px 16px';
    });
    document.querySelectorAll('.juz-item').forEach(function(el){
        el.style.fontSize = juzSz + 'px'; el.style.padding = pad + 'px 14px ' + pad + 'px 16px';
    });
    document.querySelectorAll('.toc-num, .juz-num').forEach(function(el){
        el.style.fontSize = numSz + 'px'; el.style.width = numDim + 'px';
        el.style.height = numDim + 'px'; el.style.minWidth = numDim + 'px';
    });
    document.querySelectorAll('.city-icon').forEach(function(el){
        el.style.width = iconSz + 'px'; el.style.height = iconSz + 'px';
    });
    document.querySelectorAll('.toc-item-left').forEach(function(el){
        el.style.gap = Math.round(iconSz * 0.35) + 'px';
    });
    const lbl = document.getElementById('toc-section-label');
    if (lbl) lbl.style.fontSize = Math.max(18, Math.min(30, fs)) + 'px';
}

// ═══════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════
document.getElementById('searchbutton').addEventListener('click', function(){
    const term = document.getElementById('search-input').value.trim(); if (term) searchQuran(term);
});

document.getElementById('searchButtonSourats').addEventListener('click', function(){
    const term = document.getElementById('search-input').value.trim(); if (term) searchSourat(term);
});

document.getElementById('search-input').addEventListener('keydown', function(e){
    if (e.key === 'Enter') { const term = e.target.value.trim(); if (term) searchQuran(term); }
});

document.getElementById('reset-button').addEventListener('click', resetSearch);

document.getElementById('languageSelector').addEventListener('change', function(){
    currentLanguage = this.value; isArabic = (currentLanguage === 'arabic');
    if (additionalLanguages.indexOf(currentLanguage) !== -1) removeSecondaryLanguage(currentLanguage);
    applyUILanguage(currentLanguage); loadQuranData();
});

document.getElementById('SurahLanguageSelector').addEventListener('change', function(){
    const code = this.value; if (!code) return; this.value = '';
    if (code === currentLanguage) return; addSecondaryLanguage(code);
});

document.getElementById('toggleOrder').addEventListener('click', function(){
    const t = uiTranslations[currentLanguage] || uiTranslations['english'];
    if (isOriginalOrder) {
        const cl = t.rtl ? 'الترتيب الكلاسيكي' : (currentLanguage==='french'?'Ordre classique':currentLanguage==='spanish'?'Orden clásico':'Classic Order');
        this.textContent = cl; this.style.direction = t.rtl?'rtl':'ltr'; this.style.textAlign = t.rtl?'right':'left';
        clearAllSecondaryLanguages(); loadRevelationOrderQuranData();
    } else {
        this.textContent = t.toggleOrder; this.style.direction = t.rtl?'rtl':'ltr'; this.style.textAlign = t.rtl?'right':'left';
        clearAllSecondaryLanguages(); loadQuranData();
    }
    isOriginalOrder = !isOriginalOrder; saveState();
});

document.getElementById('context').addEventListener('click', async function(){
    if (contextOpen) { clearSuraContext(); return; }
    closeSearchResults();
    const first = document.getElementById('quranContainer').firstChild || document.querySelector('.sura');
    if (!first) return;
    const suraData = quranData.find(function(s){ return s.id === (first.id||'0'); });
    if (!suraData) return;
    await fetchAndDisplayContext(parseInt(suraData.id) + 1);
});

// Bookmarks button
document.getElementById('bookmarksBtn').addEventListener('click', function(){
    const panel = document.getElementById('bookmarksPanel');
    const isOpen = panel.classList.contains('bookmarksContainer');
    if (isOpen) {
        panel.classList.replace('bookmarksContainer','eraseDiv');
    } else {
        renderBookmarksList();
        panel.classList.replace('eraseDiv','bookmarksContainer');
    }
});

document.getElementById('bookmarksClose').addEventListener('click', function(){
    document.getElementById('bookmarksPanel').classList.replace('bookmarksContainer','eraseDiv');
});

// v9.6: bookmarksReset onclick set per-tab in renderSavedHubDesktop

document.getElementById('burgerMenu').addEventListener('click', toggleSidebar);

document.querySelectorAll('.theme-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ applyTheme(btn.getAttribute('data-theme')); saveState(); });
});

document.getElementById('quranContainer').addEventListener('scroll', function(){
    clearTimeout(window._scrollTimer);
    window._scrollTimer = setTimeout(saveState, 300);
});

// ═══════════════════════════════════════════════════════════════════
// TOC DRAG RESIZE
// ═══════════════════════════════════════════════════════════════════
(function(){
    const handle = document.getElementById('tocResizeHandle');
    const toc    = document.getElementById('tocContainer');
    let dragging = false, startX = 0, startW = 0;

    function applyWidth(w) {
        const clamped = Math.max(140, Math.min(700, w));
        toc.style.width = clamped + 'px'; toc.style.minWidth = clamped + 'px'; toc.style.flex = 'none';
        scaleTocFont(clamped); return clamped;
    }

    handle.addEventListener('mousedown', function(e){
        dragging = true; startX = e.clientX; startW = toc.offsetWidth;
        handle.classList.add('dragging'); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; e.preventDefault();
    });
    document.addEventListener('mousemove', function(e){
        if (!dragging) return; applyWidth(startW + (startX - e.clientX));
    });
    document.addEventListener('mouseup', function(){
        if (!dragging) return; dragging = false; handle.classList.remove('dragging');
        document.body.style.cursor = ''; document.body.style.userSelect = '';
        try { localStorage.setItem('quranTocWidth', toc.offsetWidth); } catch(e) {}
    });
    handle.addEventListener('touchstart', function(e){
        dragging = true; startX = e.touches[0].clientX; startW = toc.offsetWidth;
        handle.classList.add('dragging'); e.preventDefault();
    }, { passive:false });
    document.addEventListener('touchmove', function(e){
        if (!dragging) return; applyWidth(startW + (startX - e.touches[0].clientX));
    }, { passive:false });
    document.addEventListener('touchend', function(){
        if (!dragging) return; dragging = false; handle.classList.remove('dragging');
        try { localStorage.setItem('quranTocWidth', toc.offsetWidth); } catch(e) {}
    });
    try {
        const sw = parseInt(localStorage.getItem('quranTocWidth'), 10);
        if (sw && sw >= 140 && sw <= 700) applyWidth(sw);
    } catch(e) {}
}());

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════
async function init() {
    getHijriCalendarForMonth();
    applyFontSizes();
    renderSearchHistory();

    const saved = loadState();

    if (saved) {
        if (saved.theme) applyTheme(saved.theme);
        currentLanguage = saved.language || 'arabic';
        isArabic        = (currentLanguage === 'arabic');
        document.getElementById('languageSelector').value = currentLanguage;
        applyUILanguage(currentLanguage);
        if (saved.activeTocTab) activeTocTab = saved.activeTocTab;

        if (saved.isOriginalOrder === false) {
            isOriginalOrder = false;
            const t = uiTranslations[currentLanguage] || uiTranslations['english'];
            const cl = t.rtl ? 'الترتيب الكلاسيكي' : (currentLanguage==='french'?'Ordre classique':currentLanguage==='spanish'?'Orden clásico':'Classic Order');
            const tog = document.getElementById('toggleOrder');
            if (tog) { tog.textContent = cl; tog.style.direction = t.rtl?'rtl':'ltr'; tog.style.textAlign = t.rtl?'right':'left'; }
        }

        quranData = await fetchAndParseQuran(currentLanguage);
        renderCurrentTOC();
        document.getElementById('arabic-options').style.display = isArabic ? 'block' : 'none';

        const suraId = (saved.suraId != null) ? saved.suraId : '0';
        displaySingleSura(suraId);

        // Restore additional languages
        if (saved.additionalLanguages && saved.additionalLanguages.length > 0) {
            for (let i = 0; i < saved.additionalLanguages.length; i++) {
                const code = saved.additionalLanguages[i];
                if (code && code !== currentLanguage) await addSecondaryLanguage(code);
            }
        }

        if (saved.scrollTop) {
            setTimeout(function(){ document.getElementById('quranContainer').scrollTop = saved.scrollTop; }, 80);
        }

        if (saved.contextOpen && saved.contextSuraIndex) {
            await fetchAndDisplayContext(saved.contextSuraIndex);
        }

        if (saved.searchOpen && saved.searchTerm) {
            document.getElementById('search-input').value = saved.searchTerm;
            const ignoreDia  = getIgnoreDiacritics();
            const searchTerm = normalize(saved.searchTerm, ignoreDia).toLowerCase();
            const matched = quranData.flatMap(function(sura){
                return sura.verses
                    .map(function(v){ return { suraName:sura.name, suraId:sura.id, verseNumber:v.number, verseText:normalize(v.text,ignoreDia) }; })
                    .filter(function(v){ return v.verseText.toLowerCase().includes(searchTerm); });
            });
            displaySearchResults(matched, saved.searchTerm);
        }

    } else {
        applyUILanguage('arabic');
        await loadQuranData(0);
    }
}

init();

// ═══════════════════════════════════════════════════════════════════
// MOBILE — Universal bottom sheet + bottom nav
// All panels (Surahs, Juz, Search, Bookmarks, Settings) use the
// same bottom sheet. Desktop is completely unaffected.
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// v9.6 — Sheet MINIMIZE (collapse to peek bar without losing state)
// ═══════════════════════════════════════════════════════════════════
var _sheetMinimized = false;

function minimizeMobileSheet() {
    var sheet   = document.getElementById('mobileSheet');
    var overlay = document.getElementById('mobileSheetOverlay');
    if (!sheet || !sheet.classList.contains('open')) return;

    _sheetMinimized = true;
    sheet.classList.remove('open');
    sheet.classList.add('minimized');
    overlay.classList.remove('active');

    // Build/show the peek bar
    var peek = document.getElementById('mobileSheetPeek');
    if (!peek) {
        peek = document.createElement('div');
        peek.id = 'mobileSheetPeek';
        peek.className = 'mob-sheet-peek';
        peek.addEventListener('click', function(e) {
            // Avoid restoring if user clicks the inner close button
            if (e.target.closest('.mob-peek-close-btn')) return;
            restoreMobileSheet();
        });
        document.body.appendChild(peek);
    }

    // Build peek content from current sheet
    var titleText = document.getElementById('mobileSheetTitle').textContent || 'Sheet';
    peek.innerHTML =
        '<span class="mob-peek-arrow">▲</span>' +
        '<span class="mob-peek-label">' + titleText + ' · tap to expand</span>' +
        '<button class="mob-peek-close-btn" title="Close completely">✕</button>';
    peek.querySelector('.mob-peek-close-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        closeMobileSheet();
    });
    peek.classList.add('show');
}

function restoreMobileSheet() {
    if (!_sheetMinimized) return;
    var sheet   = document.getElementById('mobileSheet');
    var overlay = document.getElementById('mobileSheetOverlay');
    sheet.classList.remove('minimized');
    sheet.classList.add('open');
    overlay.classList.add('active');
    var peek = document.getElementById('mobileSheetPeek');
    if (peek) peek.classList.remove('show');
    _sheetMinimized = false;
}


var _sheetCurrentAction = null;

function isMobile() { return window.innerWidth <= 900; }

// ── Open / close the universal sheet ──────────────────────────────
function openMobileSheet(action) {
    if (!isMobile()) return;
    _sheetCurrentAction = action;

    var overlay = document.getElementById('mobileSheetOverlay');
    var sheet   = document.getElementById('mobileSheet');
    var title   = document.getElementById('mobileSheetTitle');
    var body    = document.getElementById('mobileSheetBody');

    // Mark active bottom nav button
    document.querySelectorAll('.bnav-btn').forEach(function(btn) {
        btn.classList.toggle('bnav-active', btn.getAttribute('data-action') === action);
    });

    // Build sheet content based on action
    body.innerHTML = '';
    // Clean up any sibling extras added by previous sheet types
    var sheetEl = document.getElementById('mobileSheet');
    sheetEl.querySelectorAll('.mob-search-scope, .mob-search-row, .mob-arabic-opt').forEach(function(el) { el.remove(); });
    // v9.5: Clean up sheet header reset button (added per-sheet)
    var existingReset = sheetEl.querySelector('.mob-sheet-reset');
    if (existingReset) existingReset.remove();
    // v9.6: Clean up minimize button (only valid for search sheet)
    var existingMin = sheetEl.querySelector('.mob-sheet-min');
    if (existingMin) existingMin.remove();
    // v9.6: Clean up saved hub tabs row
    var existingTabs = sheetEl.querySelector('.mob-saved-tabs');
    if (existingTabs) existingTabs.remove();
    if (action === 'surah')     buildSheetSurahs(body, title);
    else if (action === 'juz')  buildSheetJuz(body, title);
    else if (action === 'search')    buildSheetSearch(body, title);
    else if (action === 'bookmarks') buildSheetBookmarks(body, title);
    else if (action === 'settings')  buildSheetSettings(body, title);

    // Animate in
    sheet.classList.add('ready');
    overlay.classList.add('active');
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            sheet.classList.add('open');
        });
    });
}

function closeMobileSheet() {
    // v9.6: also clean up minimized peek bar
    _sheetMinimized = false;
    var peek = document.getElementById('mobileSheetPeek');
    if (peek) peek.classList.remove('show');
    var sheet0 = document.getElementById('mobileSheet');
    if (sheet0) sheet0.classList.remove('minimized');
    
    var overlay = document.getElementById('mobileSheetOverlay');
    var sheet   = document.getElementById('mobileSheet');
    sheet.classList.remove('open');
    overlay.classList.remove('active');
    setTimeout(function() { sheet.classList.remove('ready'); }, 320);
    _sheetCurrentAction = null;
    // Reset bottom nav — no active item after close
    document.querySelectorAll('.bnav-btn').forEach(function(btn) {
        btn.classList.remove('bnav-active');
    });
}

// ── Surahs sheet ─────────────────────────────────────────────────
function buildSheetSurahs(body, title) {
    title.textContent = '📖 114 Surahs';
    var currentSuraEl = document.querySelector('.sura');
    var currentId = currentSuraEl ? currentSuraEl.id : '0';
    quranData.forEach(function(sura, index) {
        var item = document.createElement('div');
        item.className = 'mob-surah-item' + (sura.id === currentId ? ' active-surah' : '');
        var dot = document.createElement('span');
        dot.className = 'mob-surah-city mob-city-' + (sura.city === 'Makkah' ? 'makkah' : 'madinah');
        var name = document.createElement('span');
        name.className = 'mob-surah-name';
        name.textContent = (index + 1) + '. ' + sura.name;
        var num = document.createElement('span');
        num.className = 'mob-surah-num';
        num.textContent = index + 1;
        item.appendChild(dot); item.appendChild(name); item.appendChild(num);
        item.addEventListener('click', function() {
            closeMobileSheet();
            clearAllSecondaryLanguages();
            closeSearchResults();
            displaySingleSura(index);
            markSuraAsRead(index);
        });
        body.appendChild(item);
    });
    // Scroll to current surah
    setTimeout(function() {
        var active = body.querySelector('.active-surah');
        if (active) active.scrollIntoView({ block: 'center' });
    }, 50);
}

// ── Juz sheet ────────────────────────────────────────────────────
function buildSheetJuz(body, title) {
    title.textContent = '📚 30 Juz';
    JUZ_DATA.forEach(function(juz) {
        var item = document.createElement('div');
        item.className = 'mob-juz-item';
        var num = document.createElement('div');
        num.className = 'mob-juz-num'; num.textContent = juz[0];
        var info = document.createElement('div');
        info.className = 'mob-juz-info';
        var ar = document.createElement('div');
        ar.className = 'mob-juz-ar'; ar.textContent = juz[1];
        var sub = document.createElement('div');
        sub.className = 'mob-juz-sub'; sub.textContent = 'Starts: ' + juz[4] + (juz[3] > 1 ? ' v.' + juz[3] : '');
        info.appendChild(ar); info.appendChild(sub);
        item.appendChild(num); item.appendChild(info);
        item.addEventListener('click', function() {
            closeMobileSheet();
            clearAllSecondaryLanguages();
            closeSearchResults();
            displaySingleSura(juz[2]);
            if (juz[3] > 1) {
                setTimeout(function() {
                    var verses = document.querySelectorAll('.verse');
                    if (verses[juz[3] - 1]) verses[juz[3] - 1].scrollIntoView({ behavior: 'smooth' });
                }, 200);
            }
        });
        body.appendChild(item);
    });
}


// ── Fix 1: Peek bar — shows navigation target without closing sheet ──────────
function showMobileSearchPeek(verseLabel) {
    var sheet = document.getElementById('mobileSheet');
    if (!sheet) return;
    // Remove existing peek
    var existing = sheet.querySelector('.mob-search-peek');
    if (existing) existing.remove();
    // Create peek bar at bottom of sheet
    var peek = document.createElement('div');
    peek.className = 'mob-search-peek';
    peek.innerHTML = '<span class="mob-peek-icon">↓</span><span class="mob-peek-text">Navigated to: ' + verseLabel + '</span><button class="mob-peek-close" onclick="closeMobileSheet()">Done ✓</button>';
    sheet.appendChild(peek);
    // Auto-remove after 4 seconds if user doesn't interact
    clearTimeout(window._peekTimer);
    window._peekTimer = setTimeout(function() {
        if (peek.parentNode) peek.style.opacity = '0.4';
    }, 3000);
}

// ── Search sheet ─────────────────────────────────────────────────
// v9.3: scope toggle (This Surah / Whole Quran) + own input + Arabic diacritic option
var _mobileSearchScope = 'quran'; // 'surah' | 'quran'

function buildSheetSearch(body, title) {
    title.textContent = '🔍 Search';

    // v9.6 FIX: clean up any leftover sibling extras from previous render
    var sheetEl = document.getElementById('mobileSheet');
    sheetEl.querySelectorAll('.mob-search-scope, .mob-search-row, .mob-arabic-opt').forEach(function(el) { el.remove(); });

    // v9.6: Add minimize button to header (only for search)
    var headerEl = sheetEl.querySelector('.mob-sheet-header');
    var existingMin = headerEl.querySelector('.mob-sheet-min');
    if (!existingMin) {
        var minBtn = document.createElement('button');
        minBtn.className = 'mob-sheet-min';
        minBtn.title = 'Minimize';
        minBtn.textContent = '▼';
        minBtn.addEventListener('click', minimizeMobileSheet);
        var closeBtn = headerEl.querySelector('.mob-sheet-close');
        headerEl.insertBefore(minBtn, closeBtn);
    }

    // ── Scope toggle ──
    var scopeRow = document.createElement('div');
    scopeRow.className = 'mob-search-scope';
    var btnSurah = document.createElement('button');
    btnSurah.className = 'mob-scope-btn' + (_mobileSearchScope === 'surah' ? ' active' : '');
    btnSurah.textContent = '📖 This Surah';
    btnSurah.addEventListener('click', function() {
        _mobileSearchScope = 'surah';
        btnSurah.classList.add('active');
        btnQuran.classList.remove('active');
    });
    var btnQuran = document.createElement('button');
    btnQuran.className = 'mob-scope-btn' + (_mobileSearchScope === 'quran' ? ' active' : '');
    btnQuran.textContent = '🌐 Whole Quran';
    btnQuran.addEventListener('click', function() {
        _mobileSearchScope = 'quran';
        btnQuran.classList.add('active');
        btnSurah.classList.remove('active');
    });
    scopeRow.appendChild(btnSurah); scopeRow.appendChild(btnQuran);
    body.parentNode.insertBefore(scopeRow, body);

    // ── Search input row ──
    var searchRow = document.createElement('div');
    searchRow.className = 'mob-search-row';
    var sInp = document.createElement('input');
    sInp.type = 'text';
    sInp.placeholder = 'بحث / Search…';
    var desktopInp = document.getElementById('search-input');
    if (desktopInp) sInp.value = desktopInp.value;
    sInp.addEventListener('input', function() {
        if (desktopInp) desktopInp.value = this.value;
/* mobile search input removed in v9.5 */
    });
    var sGo = document.createElement('button');
    sGo.textContent = '↵';
    function runSearchInScope() {
        var term = sInp.value.trim();
        if (!term) return;
        if (desktopInp) desktopInp.value = term;
        if (_mobileSearchScope === 'surah') {
            searchSourat(term);
        } else {
            searchQuran(term);
        }
    }
    sInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') runSearchInScope(); });
    sGo.addEventListener('click', runSearchInScope);
    // v9.10: Clear button — wipes input AND search results
    var sClear = document.createElement('button');
    sClear.textContent = '🗑';
    sClear.className = 'mob-search-clear';
    sClear.title = 'Clear search and results';
    sClear.addEventListener('click', function() {
        sInp.value = '';
        if (desktopInp) desktopInp.value = '';
        if (typeof closeSearchResults === 'function') closeSearchResults();
        // Refresh sheet body to show the empty state
        body.innerHTML = '<div class="mob-results-empty">Type a search term above and hit ↵<br>Results will appear here.</div>';
        sInp.focus();
    });
    searchRow.appendChild(sInp); searchRow.appendChild(sClear); searchRow.appendChild(sGo);
    body.parentNode.insertBefore(searchRow, body);

    // ── Arabic diacritic option ──
    var arabicOpt = document.createElement('div');
    arabicOpt.className = 'mob-arabic-opt';
    var arLabel = document.createElement('label');
    var arChk = document.createElement('input');
    arChk.type = 'checkbox';
    var desktopChk = document.getElementById('ignore-diacritics');
    arChk.checked = desktopChk ? desktopChk.checked : false;
    arChk.addEventListener('change', function() {
        if (desktopChk) desktopChk.checked = this.checked;
    });
    arLabel.appendChild(arChk);
    arLabel.appendChild(document.createTextNode(' تجاهل علامات التشكيل (ignore diacritics)'));
    arabicOpt.appendChild(arLabel);
    body.parentNode.insertBefore(arabicOpt, body);

    // ── Results ──
    var resultEl = document.getElementById('search-results');
    var isOpen   = resultEl && resultEl.classList.contains('resultsClass');

    if (!isOpen || !resultEl.children.length) {
        body.innerHTML = '<div class="mob-results-empty">Type a search term above and hit ↵<br>Results will appear here.</div>';
        return;
    }

    // Mirror desktop results into mobile sheet
    var total = document.getElementById('results-label').textContent;
    var totalDiv = document.createElement('div');
    totalDiv.className = 'mob-results-total'; totalDiv.textContent = total;
    body.appendChild(totalDiv);

    // Walk existing desktop result DOM and rebuild for mobile
    var surahGroups = resultEl.querySelectorAll('.surah-results');
    if (surahGroups.length) {
        surahGroups.forEach(function(group) {
            var surahName = group.querySelector('.SearchResultSurah');
            var items     = group.querySelectorAll('.search-result-item');
            if (surahName) {
                var sh = document.createElement('div');
                sh.className = 'mob-results-surah'; sh.textContent = surahName.textContent;
                body.appendChild(sh);
            }
            items.forEach(function(item) {
                var row = document.createElement('div');
                row.className = 'mob-results-verse';
                var txt = document.createElement('span'); txt.textContent = item.textContent;
                var arr = document.createElement('span'); arr.className = 'mob-results-arrow'; arr.textContent = '→';
                row.appendChild(txt); row.appendChild(arr);
                // Clone the click from the desktop item
                row.addEventListener('click', (function(capturedItem) {
                    return function() {
                        // Navigate + highlight WITHOUT closing the sheet
                        capturedItem.click();
                        // Show peek bar so user knows where we navigated
                        showMobileSearchPeek(capturedItem.textContent.trim());
                    };
                })(item));
                body.appendChild(row);
            });
        });
    } else {
        // Surah-scoped results (single surah search)
        var singleItems = resultEl.querySelectorAll('.search-result-item');
        singleItems.forEach(function(item) {
            var row = document.createElement('div');
            row.className = 'mob-results-verse';
            var txt = document.createElement('span'); txt.textContent = item.textContent;
            var arr = document.createElement('span'); arr.className = 'mob-results-arrow'; arr.textContent = '→';
            row.appendChild(txt); row.appendChild(arr);
            row.addEventListener('click', (function(capturedItem) {
                return function() {
                    capturedItem.click();
                    showMobileSearchPeek(capturedItem.textContent.trim());
                };
            })(item));
            body.appendChild(row);
        });
    }
}

// ── Bookmarks sheet ───────────────────────────────────────────────
// v9.6: Saved hub — Bookmarks / Notes / Highlights with tabs
var _savedHubActiveTab = 'bookmarks';

function buildSheetBookmarks(body, title) {
    var sheet = document.getElementById('mobileSheet');
    var headerEl = sheet.querySelector('.mob-sheet-header');

    // ── Counts ──
    var bms = getBookmarks();
    var notesArr = getNotesList();
    var hlArr = getHighlightsList();

    // ── Title reflects active tab ──
    function updateTitle(tab) {
        if (tab === 'notes')      title.textContent = '📝 Notes' + (notesArr.length ? ' (' + notesArr.length + ')' : '');
        else if (tab === 'highlights') title.textContent = '✦ Highlights' + (hlArr.length ? ' (' + hlArr.length + ')' : '');
        else                      title.textContent = '🔖 Bookmarks' + (bms.length ? ' (' + bms.length + ')' : '');
    }
    updateTitle(_savedHubActiveTab);

    // ── Reset button (top-right, varies by active tab) ──
    var existingReset = headerEl.querySelector('.mob-sheet-reset');
    if (existingReset) existingReset.remove();
    function ensureReset(tab) {
        var oldR = headerEl.querySelector('.mob-sheet-reset');
        if (oldR) oldR.remove();
        var hasItems = (tab === 'bookmarks' && bms.length) ||
                       (tab === 'notes'     && notesArr.length) ||
                       (tab === 'highlights'&& hlArr.length);
        if (!hasItems) return;
        var resetBtn = document.createElement('button');
        resetBtn.className = 'mob-sheet-reset';
        resetBtn.textContent = '🗑 Reset';
        resetBtn.title = 'Clear all in this tab';
        resetBtn.addEventListener('click', function() {
            if (tab === 'notes')      resetAllNotes();
            else if (tab === 'highlights') resetAllHighlights();
            else                      resetAllBookmarks();
        });
        var closeBtn = headerEl.querySelector('.mob-sheet-close');
        headerEl.insertBefore(resetBtn, closeBtn);
    }
    ensureReset(_savedHubActiveTab);

    // ── Tab bar ──
    var tabsRow = sheet.querySelector('.mob-saved-tabs');
    if (tabsRow) tabsRow.remove();
    tabsRow = document.createElement('div');
    tabsRow.className = 'mob-saved-tabs';
    [
        { id: 'bookmarks',  label: '🔖 Bookmarks',  count: bms.length },
        { id: 'notes',      label: '📝 Notes',      count: notesArr.length },
        { id: 'highlights', label: '✦ Highlights', count: hlArr.length }
    ].forEach(function(t) {
        var btn = document.createElement('button');
        btn.className = 'mob-saved-tab' + (_savedHubActiveTab === t.id ? ' active' : '');
        btn.textContent = t.label + (t.count ? ' (' + t.count + ')' : '');
        btn.addEventListener('click', function() {
            _savedHubActiveTab = t.id;
            // Re-render
            buildSheetBookmarks(body, title);
        });
        tabsRow.appendChild(btn);
    });
    body.parentNode.insertBefore(tabsRow, body);

    // ── Body content ──
    body.innerHTML = '';
    if (_savedHubActiveTab === 'bookmarks') {
        renderBookmarksInBody(body, bms);
    } else if (_savedHubActiveTab === 'notes') {
        renderNotesInBody(body, notesArr);
    } else {
        renderHighlightsInBody(body, hlArr);
    }
}

function renderBookmarksInBody(body, bms) {
    if (!bms.length) {
        body.innerHTML = '<div class="mob-bookmarks-empty"><div class="mob-bookmarks-empty-icon">🔖</div><div>No bookmarks yet</div><div class="mob-bookmarks-empty-hint">Tap a verse and the 🔖 button to save it.</div></div>';
        return;
    }
    bms.forEach(function(b) {
        var item = document.createElement('div');
        item.className = 'mob-bm-item';
        var surah = document.createElement('div'); surah.className = 'mob-bm-surah';
        surah.textContent = b.suraName + ' · verse ' + (b.verseIdx + 1);
        var verse = document.createElement('div'); verse.className = 'mob-bm-verse';
        verse.textContent = b.text;
        var rmv = document.createElement('button');
        rmv.className = 'mob-saved-rm'; rmv.textContent = '✕'; rmv.title = 'Remove';
        rmv.addEventListener('click', function(e) {
            e.stopPropagation();
            removeBookmark(b.key);
            // Refresh tab
            var bodyEl = document.getElementById('mobileSheetBody');
            var titleEl = document.getElementById('mobileSheetTitle');
            if (bodyEl && titleEl) buildSheetBookmarks(bodyEl, titleEl);
        });
        item.appendChild(rmv);
        item.appendChild(surah); item.appendChild(verse);
        item.addEventListener('click', function() {
            closeMobileSheet();
            displaySingleSura(b.suraId);
            setTimeout(function() {
                var verses = document.querySelectorAll('.verse');
                if (verses[b.verseIdx]) verses[b.verseIdx].scrollIntoView({ behavior: 'smooth' });
            }, 150);
        });
        body.appendChild(item);
    });
}

function renderNotesInBody(body, notesArr) {
    if (!notesArr.length) {
        body.innerHTML = '<div class="mob-bookmarks-empty"><div class="mob-bookmarks-empty-icon">📝</div><div>No notes yet</div><div class="mob-bookmarks-empty-hint">Tap a verse and the 📝 button to add a note.</div></div>';
        return;
    }
    notesArr.forEach(function(n) {
        var item = document.createElement('div');
        item.className = 'mob-bm-item';
        var actions = document.createElement('div');
        actions.className = 'mob-saved-actions';
        var editBtn = document.createElement('button');
        editBtn.className = 'mob-saved-edit'; editBtn.textContent = '✎'; editBtn.title = 'Edit note';
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Need to navigate to the verse first so the noteBtn is real, then open modal
            closeMobileSheet();
            displaySingleSura(n.suraId);
            setTimeout(function() {
                var verses = document.querySelectorAll('.verse');
                if (verses[n.verseIdx]) {
                    verses[n.verseIdx].scrollIntoView({ behavior: 'smooth' });
                    var noteBtn = verses[n.verseIdx].querySelector('.verse-action-btn:nth-child(3)');
                    if (noteBtn) setTimeout(function(){ openNoteModal(n.suraId, n.verseIdx, noteBtn); }, 200);
                }
            }, 150);
        });
        var rmv = document.createElement('button');
        rmv.className = 'mob-saved-rm'; rmv.textContent = '✕'; rmv.title = 'Delete note';
        rmv.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteNoteByKey(n.key);
            var bodyEl = document.getElementById('mobileSheetBody');
            var titleEl = document.getElementById('mobileSheetTitle');
            if (bodyEl && titleEl) buildSheetBookmarks(bodyEl, titleEl);
        });
        actions.appendChild(editBtn);
        actions.appendChild(rmv);
        item.appendChild(actions);
        var surah = document.createElement('div'); surah.className = 'mob-bm-surah';
        surah.textContent = n.suraName + ' · verse ' + (n.verseIdx + 1);
        var noteText = document.createElement('div'); noteText.className = 'mob-note-text';
        noteText.textContent = n.text;
        var verseText = document.createElement('div'); verseText.className = 'mob-bm-verse';
        verseText.textContent = n.verseText;
        verseText.style.opacity = '0.6';
        verseText.style.fontSize = '11px';
        verseText.style.marginTop = '5px';
        item.appendChild(surah); item.appendChild(noteText); item.appendChild(verseText);
        item.addEventListener('click', function() {
            closeMobileSheet();
            displaySingleSura(n.suraId);
            setTimeout(function() {
                var verses = document.querySelectorAll('.verse');
                if (verses[n.verseIdx]) verses[n.verseIdx].scrollIntoView({ behavior: 'smooth' });
            }, 150);
        });
        body.appendChild(item);
    });
}

function renderHighlightsInBody(body, hlArr) {
    if (!hlArr.length) {
        body.innerHTML = '<div class="mob-bookmarks-empty"><div class="mob-bookmarks-empty-icon">✦</div><div>No highlights yet</div><div class="mob-bookmarks-empty-hint">Tap a verse and the ✦ Highlight button.</div></div>';
        return;
    }
    hlArr.forEach(function(h) {
        var item = document.createElement('div');
        item.className = 'mob-bm-item mob-hl-item';
        var rmv = document.createElement('button');
        rmv.className = 'mob-saved-rm'; rmv.textContent = '✕'; rmv.title = 'Remove highlight';
        rmv.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteHighlightByKey(h.key);
            var bodyEl = document.getElementById('mobileSheetBody');
            var titleEl = document.getElementById('mobileSheetTitle');
            if (bodyEl && titleEl) buildSheetBookmarks(bodyEl, titleEl);
        });
        item.appendChild(rmv);
        var surah = document.createElement('div'); surah.className = 'mob-bm-surah';
        surah.textContent = h.suraName + ' · verse ' + (h.verseIdx + 1);
        var verseText = document.createElement('div'); verseText.className = 'mob-bm-verse';
        verseText.textContent = h.verseText;
        item.appendChild(surah); item.appendChild(verseText);
        item.addEventListener('click', function() {
            closeMobileSheet();
            displaySingleSura(h.suraId);
            setTimeout(function() {
                var verses = document.querySelectorAll('.verse');
                if (verses[h.verseIdx]) verses[h.verseIdx].scrollIntoView({ behavior: 'smooth' });
            }, 150);
        });
        body.appendChild(item);
    });
}

// ── Settings sheet ────────────────────────────────────────────────
function buildSheetSettings(body, title) {
    title.textContent = '⚙️ Settings';

    // Theme section
    var themeSection = document.createElement('div');
    themeSection.className = 'mob-settings-section';
    var themeLbl = document.createElement('div'); themeLbl.className = 'mob-settings-lbl'; themeLbl.textContent = 'Theme';
    var chips = document.createElement('div'); chips.className = 'mob-theme-chips';
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'manuscript';
    [['manuscript','📜 Manuscript'],['minimal','🌿 Minimal'],['scholar','🌙 Scholar']].forEach(function(pair) {
        var chip = document.createElement('button');
        chip.className = 'mob-theme-chip' + (currentTheme === pair[0] ? ' active' : '');
        chip.textContent = pair[1];
        chip.addEventListener('click', function() {
            applyTheme(pair[0]); saveState();
            chips.querySelectorAll('.mob-theme-chip').forEach(function(c){ c.classList.remove('active'); });
            chip.classList.add('active');
        });
        chips.appendChild(chip);
    });
    themeSection.appendChild(themeLbl); themeSection.appendChild(chips);
    body.appendChild(themeSection);

    // Language section
    var langSection = document.createElement('div');
    langSection.className = 'mob-settings-section';
    var langLbl = document.createElement('div'); langLbl.className = 'mob-settings-lbl'; langLbl.textContent = 'Quran language';
    var langSel = document.createElement('select'); langSel.className = 'mob-settings-select';
    [['arabic','Arabic'],['french','Français'],['english','English'],['spanish','Español']].forEach(function(pair){
        var opt = document.createElement('option'); opt.value = pair[0]; opt.textContent = pair[1];
        if (pair[0] === currentLanguage) opt.selected = true;
        langSel.appendChild(opt);
    });
    langSel.addEventListener('change', function() {
        document.getElementById('languageSelector').value = this.value;
        document.getElementById('languageSelector').dispatchEvent(new Event('change'));
    });
    langSection.appendChild(langLbl); langSection.appendChild(langSel);
    body.appendChild(langSection);

    // Font size section
    var fontSection = document.createElement('div');
    fontSection.className = 'mob-settings-section';
    var fontLbl = document.createElement('div'); fontLbl.className = 'mob-settings-lbl'; fontLbl.textContent = 'Font size';
    fontSection.appendChild(fontLbl);
    [
        { label:'Verse',       id:'arabicFontSlider', valId:'arabicFontVal', min:1.2, max:5, step:0.1 },
        { label:'Translation', id:'transFontSlider',  valId:'transFontVal',  min:0.7, max:3, step:0.05 }
    ].forEach(function(cfg) {
        var row = document.createElement('div'); row.className = 'mob-slider-row';
        var lbl = document.createElement('span'); lbl.className = 'mob-slider-label'; lbl.textContent = cfg.label;
        var inp = document.createElement('input');
        inp.type = 'range'; inp.min = cfg.min; inp.max = cfg.max; inp.step = cfg.step;
        inp.style.flex = '1'; inp.style.accentColor = 'var(--accent)';
        var src = document.getElementById(cfg.id);
        if (src) inp.value = src.value;
        inp.addEventListener('input', function() {
            var v = parseFloat(this.value);
            // Directly update fontSizes and apply — no event chain needed
            if (cfg.id === 'arabicFontSlider') {
                fontSizes.arabic = v;
            } else {
                fontSizes.trans = v;
            }
            lsSet(FONT_KEY, fontSizes);
            applyFontSizes();
            // Keep desktop slider in sync
            if (src) src.value = this.value;
            val.textContent = v.toFixed(cfg.step < 0.1 ? 2 : 1);
        });
        var val = document.createElement('span'); val.className = 'mob-slider-val';
        val.textContent = src ? parseFloat(src.value).toFixed(cfg.step < 0.1 ? 2 : 1) : '';
        row.appendChild(lbl); row.appendChild(inp); row.appendChild(val);
        fontSection.appendChild(row);
    });
    body.appendChild(fontSection);

    // Add translation language section
    var transSection = document.createElement('div');
    transSection.className = 'mob-settings-section';
    var transLbl = document.createElement('div'); transLbl.className = 'mob-settings-lbl'; transLbl.textContent = 'Add a translation';
    transSection.appendChild(transLbl);

    // Show active language tags with remove button
    var tagsWrap = document.createElement('div'); tagsWrap.id = 'mob-lang-tags-wrap';
    function renderMobLangTags() {
        tagsWrap.innerHTML = '';
        additionalLanguages.forEach(function(code) {
            var row = document.createElement('div'); row.className = 'mob-lang-tag-row';
            var lbl = document.createElement('span'); lbl.className = 'mob-lang-tag-lbl';
            lbl.textContent = langLabels[code] || code;
            lbl.style.color = getLangColor(code);
            var rmv = document.createElement('button'); rmv.className = 'mob-lang-tag-rm'; rmv.textContent = '✕';
            rmv.addEventListener('click', function() {
                removeSecondaryLanguage(code);
                renderMobLangTags();
                rebuildAddSel();
            });
            row.appendChild(lbl); row.appendChild(rmv);
            tagsWrap.appendChild(row);
        });
    }
    renderMobLangTags();
    transSection.appendChild(tagsWrap);

    // Add selector
    var addSel = document.createElement('select'); addSel.className = 'mob-settings-select';
    function rebuildAddSel() {
        addSel.innerHTML = '';
        var placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = '+ Add a language…'; addSel.appendChild(placeholder);
        [['arabic','Arabic'],['french','Français'],['english','English'],['spanish','Español']].forEach(function(pair) {
            if (pair[0] === currentLanguage) return;
            if (additionalLanguages.indexOf(pair[0]) !== -1) return;
            var opt = document.createElement('option'); opt.value = pair[0]; opt.textContent = pair[1]; addSel.appendChild(opt);
        });
    }
    rebuildAddSel();
    addSel.addEventListener('change', function() {
        if (!this.value) return;
        var code = this.value; this.value = '';
        addSecondaryLanguage(code).then(function() {
            renderMobLangTags(); rebuildAddSel();
        });
    });
    transSection.appendChild(addSel);
    body.appendChild(transSection);

    // Tools section
    var toolSection = document.createElement('div');
    toolSection.className = 'mob-settings-section';
    var toolLbl = document.createElement('div'); toolLbl.className = 'mob-settings-lbl'; toolLbl.textContent = 'Tools';
    toolSection.appendChild(toolLbl);
    [
        { id:'toggleOrder', label: isOriginalOrder ? 'Revelation Order' : 'Classic Order' },
        { id:'context',     label: 'Surah Context' }
        // v9.8: Bookmarks removed — already accessible from bottom nav
    ].forEach(function(cfg) {
        var btn = document.createElement('button'); btn.className = 'mob-settings-btn';
        btn.textContent = cfg.label;
        btn.addEventListener('click', function() {
            closeMobileSheet();
            document.getElementById(cfg.id).click();
        });
        toolSection.appendChild(btn);
    });
    body.appendChild(toolSection);

}

// ── Sidebar open/close (desktop burger) ──────────────────────────
function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

document.getElementById('burgerMenu').addEventListener('click', function() {
    if (isMobile()) {
        openMobileSheet('settings');
    } else {
        var sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
    }
});

// v9.5: Fixed mobile search bar removed — search is fully handled by the search sheet
var mobileSearchInput = null;
var mobileSearchGo    = null;

// ── Fix 1 (v9.3): Drag-to-close gesture ──────────────────────────
(function() {
    var grab = document.getElementById('mobileSheetGrab');
    var sheet = document.getElementById('mobileSheet');
    if (!grab || !sheet) return;

    var startY = null;
    var currentY = 0;
    var sheetHeight = 0;

    function getY(e) {
        if (e.touches && e.touches[0]) return e.touches[0].clientY;
        if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].clientY;
        return e.clientY;
    }

    function start(e) {
        if (!sheet.classList.contains('open')) return;
        startY = getY(e);
        currentY = 0;
        sheetHeight = sheet.offsetHeight;
        sheet.classList.add('dragging');
    }

    function move(e) {
        if (startY === null) return;
        var delta = getY(e) - startY;
        if (delta < 0) delta = 0; // only allow dragging down
        currentY = delta;
        sheet.style.transform = 'translateY(' + delta + 'px)';
    }

    function end() {
        if (startY === null) return;
        sheet.classList.remove('dragging');
        // Threshold: 25% of sheet height OR 90px — whichever is smaller
        var threshold = Math.min(sheetHeight * 0.25, 90);
        if (currentY > threshold) {
            // Animate out
            sheet.style.transform = '';
            closeMobileSheet();
        } else {
            // Snap back
            sheet.style.transform = '';
        }
        startY = null;
        currentY = 0;
    }

    grab.addEventListener('touchstart', start, { passive: true });
    grab.addEventListener('touchmove',  move,  { passive: true });
    grab.addEventListener('touchend',   end);
    grab.addEventListener('touchcancel', end);

    grab.addEventListener('mousedown', function(e) { start(e); document.addEventListener('mousemove', move); document.addEventListener('mouseup', mouseUpHandler); });
    function mouseUpHandler() { end(); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', mouseUpHandler); }
}());

// ── Bottom nav click handlers ────────────────────────────────────
document.querySelectorAll('.bnav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        openMobileSheet(btn.getAttribute('data-action'));
    });
});

// ── After desktop search runs on mobile, refresh the sheet ───────
// Patch searchQuran and searchSourat to auto-open sheet on mobile
var _origDisplaySearchResults = displaySearchResults;
displaySearchResults = function(verses, word) {
    _origDisplaySearchResults(verses, word);
    // If on mobile and sheet is showing search, refresh it
    if (isMobile() && _sheetCurrentAction === 'search') {
        setTimeout(function() {
            var body  = document.getElementById('mobileSheetBody');
            var title = document.getElementById('mobileSheetTitle');
            if (body && title) { body.innerHTML = ''; buildSheetSearch(body, title); }
        }, 50);
    }
};

// v9.5: Mobile search input sync removed — fixed bar no longer exists


// ═══════════════════════════════════════════════════════════════════
// v9.8 — Pinch-to-zoom only the reading content
//        Header and bottom nav stay anchored (no whole-page zoom)
// ═══════════════════════════════════════════════════════════════════
(function() {
    var ZOOM_KEY = 'quranReadingZoom';
    var MIN_ZOOM = 0.7;
    var MAX_ZOOM = 3.0;

    // Restore saved zoom
    var savedZoom = parseFloat(localStorage.getItem(ZOOM_KEY)) || 1;
    if (savedZoom < MIN_ZOOM || savedZoom > MAX_ZOOM) savedZoom = 1;
    document.documentElement.style.setProperty('--reading-zoom', savedZoom);

    // Indicator element
    var indicator = null;
    function getIndicator() {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'zoom-indicator';
            document.body.appendChild(indicator);
        }
        return indicator;
    }

    function showIndicator(zoom) {
        var el = getIndicator();
        el.textContent = Math.round(zoom * 100) + '%';
        el.classList.add('show');
        clearTimeout(window._zoomIndicatorTimer);
        window._zoomIndicatorTimer = setTimeout(function() {
            el.classList.remove('show');
        }, 600);
    }

    function setZoom(z) {
        z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
        document.documentElement.style.setProperty('--reading-zoom', z);
        try { localStorage.setItem(ZOOM_KEY, z); } catch(e) {}
        return z;
    }

    // Wrap reading content in a zoom wrapper after every render
    function wrapReadingContent() {
        var container = document.getElementById('quranContainer');
        var ctxContainer = document.getElementById('suraContent');
        [container, ctxContainer].forEach(function(target) {
            if (!target) return;
            // Only wrap once: if first child is already the wrapper, skip
            if (target.firstElementChild && target.firstElementChild.classList && target.firstElementChild.classList.contains('zoom-wrapper')) return;
            // Don't wrap empty containers
            if (target.children.length === 0) return;
            // Don't wrap eraseDiv
            if (target.classList.contains('eraseDiv')) return;
            var wrapper = document.createElement('div');
            wrapper.className = 'zoom-wrapper';
            // Move all children into wrapper
            while (target.firstChild) wrapper.appendChild(target.firstChild);
            target.appendChild(wrapper);
        });
    }

    // Re-wrap when content changes (after displaySingleSura, displaySuraContext, etc.)
    var origDisplaySingleSura = displaySingleSura;
    displaySingleSura = function(suraId) {
        origDisplaySingleSura(suraId);
        setTimeout(wrapReadingContent, 10);
    };

    var origDisplaySingleRevelationSura = displaySingleRevelationSura;
    displaySingleRevelationSura = function(suraNum) {
        origDisplaySingleRevelationSura(suraNum);
        setTimeout(wrapReadingContent, 10);
    };

    var origDisplaySuraContext = displaySuraContext;
    displaySuraContext = function(sura, suraIndex) {
        origDisplaySuraContext(sura, suraIndex);
        setTimeout(wrapReadingContent, 10);
    };

    // Pinch gesture handler
    var pinchActive = false;
    var pinchStartDist = 0;
    var pinchStartZoom = 1;

    function getDist(touches) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx*dx + dy*dy);
    }

    function isInsideReading(target) {
        // Only handle pinch if touches are inside the reading area
        return target && (target.closest('#quranContainer') || target.closest('#suraContent'));
    }

    document.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2 && isInsideReading(e.target)) {
            pinchActive = true;
            pinchStartDist = getDist(e.touches);
            pinchStartZoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-zoom')) || 1;
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
        if (pinchActive && e.touches.length === 2) {
            var newDist = getDist(e.touches);
            var ratio = newDist / pinchStartDist;
            var newZoom = setZoom(pinchStartZoom * ratio);
            showIndicator(newZoom);
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
        if (pinchActive && e.touches.length < 2) {
            pinchActive = false;
        }
    });

    document.addEventListener('touchcancel', function() {
        pinchActive = false;
    });

    // Double-tap to reset zoom
    var lastTap = 0;
    document.addEventListener('touchend', function(e) {
        if (!isInsideReading(e.target)) return;
        if (e.changedTouches.length !== 1) return;
        var now = Date.now();
        if (now - lastTap < 300) {
            // Double-tap — reset zoom to 1
            var current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-zoom')) || 1;
            if (current !== 1) {
                setZoom(1);
                showIndicator(1);
                e.preventDefault();
            }
        }
        lastTap = now;
    });

    // Initial wrap on page load
    setTimeout(wrapReadingContent, 200);
}());
