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

    // v10: Track last-visible verse index per sura for "Continue" deep-resume
    let lastVerseBySura = {};
    try { lastVerseBySura = (lsGet(STATE_KEY, {}) || {}).lastVerseBySura || {}; } catch(e) {}
    if (suraEl && container) {
        const verses = suraEl.querySelectorAll('.verse');
        const cTop = container.getBoundingClientRect().top;
        let bestIdx = 0;
        for (let i = 0; i < verses.length; i++) {
            const r = verses[i].getBoundingClientRect();
            if (r.bottom > cTop + 40) { bestIdx = i; break; }
        }
        lastVerseBySura[suraEl.id] = bestIdx;
    }

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
        activeTocTab:        activeTocTab,
        lastVerseBySura:     lastVerseBySura
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
const HijriMonthsAr = [
    'محرَّم','صفر','ربيع الأوَّل','ربيع الثَّاني',
    'جمادى الأولى','جمادى الآخرة','رجب','شعبان',
    'رمضان','شوَّال','ذو القعدة','ذو الحجَّة'
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
            const monthName = (h.month && h.month.ar) ? h.month.ar : HijriMonthsAr[h.month.number-1];
            el.querySelector('.date-hijri').textContent =
                h.day + ' ' + monthName + ' ' + h.year + ' هـ';
            // Store for badge/popup so both use the same authoritative value
            window._hijriToday = {
                day:       parseInt(h.day, 10),
                month:     parseInt(h.month.number, 10),
                year:      parseInt(h.year, 10),
                monthName: monthName
            };
        }
    } catch(e) {}
}

// ─── UI label translations ─────────────────────────────────────────
const uiTranslations = {
    arabic:  { toggleOrder:'ترتيب الوحي', context:'سياق السورة', searchbutton:'بحث في القرآن', surahSearch:'بحث في السورة', bookmarks:'📁 المحفوظات', tocSurah:'السور', tocJuz:'الأجزاء', tocRevelation:'الوحي', tocTopics:'المواضيع', langQuranLabel:'لغة القرآن', langAddLabel:'إضافة ترجمات', settingsTitle:'⚙️ الإعدادات', settingsFontSize:'حجم الخط', settingsVerseLabel:'آية', settingsTranslLabel:'ترجمة', settingsAddTransl:'إضافة ترجمة', settingsAddLangPh:'+ أضف لغة…', sectionSearch:'بحث', sectionDisplay:'العرض', sectionLanguages:'اللغات', sectionTools:'الأدوات', sectionSupport:'الدعم', footer:'القرآن الكريم · اقرأ بقلب واعٍ', rtl:true },
    french:  { toggleOrder:'Ordre de révélation', context:'Contexte de la sourate', searchbutton:'Recherche dans le Coran', surahSearch:'Recherche dans la Sourate', bookmarks:'📁 Enregistrés', tocSurah:'Sourates', tocJuz:'Juz', tocRevelation:'Révélation', tocTopics:'Thèmes', langQuranLabel:'Langue du Coran', langAddLabel:'Ajouter des traductions', settingsTitle:'⚙️ Paramètres', settingsFontSize:'Taille de police', settingsVerseLabel:'Verset', settingsTranslLabel:'Traduction', settingsAddTransl:'Ajouter une traduction', settingsAddLangPh:'+ Ajouter une langue…', sectionSearch:'Recherche', sectionDisplay:'Affichage', sectionLanguages:'Langues', sectionTools:'Outils', sectionSupport:'Assistance', footer:'Lisez avec un cœur attentif', rtl:false },
    english: { toggleOrder:'Revelation Order', context:'Surah Context', searchbutton:'Quran Search', surahSearch:'Surah Search', bookmarks:'📁 Saved', tocSurah:'Surahs', tocJuz:'Juz', tocRevelation:'Revelation', tocTopics:'Topics', langQuranLabel:'Quran language', langAddLabel:'Add translations', settingsTitle:'⚙️ Settings', settingsFontSize:'Font size', settingsVerseLabel:'Verse', settingsTranslLabel:'Translation', settingsAddTransl:'Add a translation', settingsAddLangPh:'+ Add a language…', sectionSearch:'Search', sectionDisplay:'Display', sectionLanguages:'Languages', sectionTools:'Tools', sectionSupport:'Support', footer:'May you read with a mindful heart', rtl:false },
    spanish: { toggleOrder:'Orden de revelación', context:'Contexto de la sura', searchbutton:'Búsqueda en el Corán', surahSearch:'Búsqueda en la Sura', bookmarks:'📁 Guardados', tocSurah:'Suras', tocJuz:'Juz', tocRevelation:'Revelación', tocTopics:'Temas', langQuranLabel:'Idioma del Corán', langAddLabel:'Añadir traducciones', settingsTitle:'⚙️ Configuración', settingsFontSize:'Tamaño de fuente', settingsVerseLabel:'Verso', settingsTranslLabel:'Traducción', settingsAddTransl:'Añadir traducción', settingsAddLangPh:'+ Añadir un idioma…', sectionSearch:'Búsqueda', sectionDisplay:'Pantalla', sectionLanguages:'Idiomas', sectionTools:'Herramientas', sectionSupport:'Asistencia', footer:'Que leas con un corazón atento', rtl:false }
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
    if (inp) {
        inp.style.direction = dir;
        // v10.8: Always set placeholder, not only RTL
        var placeholderMap = {
            arabic:  'ابحث في القرآن…',
            french:  'Rechercher dans le Coran…',
            english: 'Search the Quran…',
            spanish: 'Buscar en el Corán…'
        };
        inp.placeholder = placeholderMap[language] || placeholderMap.english;
    }
    // v10.8: Mobile search input gets the same treatment
    var mobInp = document.getElementById('mob-search-input');
    if (mobInp) {
        var placeholderMap2 = {
            arabic:  'ابحث في القرآن…',
            french:  'Rechercher dans le Coran…',
            english: 'Search the Quran…',
            spanish: 'Buscar en el Corán…'
        };
        mobInp.placeholder = placeholderMap2[language] || placeholderMap2.english;
        mobInp.style.direction = dir;
    }
    // Translate all data-i18n elements (section headers, font labels, etc.)
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        if (t[key] !== undefined) {
            el.textContent  = t[key];
            el.style.direction  = dir;
            el.style.textAlign  = aln;
            el.style.fontFamily = t.rtl ? 'var(--font-arabic)' : '';
        }
    });
    // Translate & align sidebar section labels
    document.querySelectorAll('.SelectLanguage').forEach(function(el) {
        el.style.direction  = dir;
        el.style.textAlign  = aln;
        el.style.fontFamily = t.rtl ? 'var(--font-arabic)' : '';
    });
    // A.9/B.4: Translate language section labels
    var qLangLbl = document.querySelector('label[for="languageSelector"]');
    if (qLangLbl) {
        qLangLbl.textContent = t.langQuranLabel;
        qLangLbl.style.direction = dir;
        qLangLbl.style.textAlign = aln;
        qLangLbl.style.fontFamily = t.rtl ? 'var(--font-arabic)' : '';
    }
    var addLangLbl = document.querySelector('#multiLanguage .SelectLanguage');
    if (addLangLbl) {
        // Preserve child span (lang-badge) while changing text
        var badge = addLangLbl.querySelector('.lang-badge');
        addLangLbl.textContent = t.langAddLabel + ' ';
        if (badge) addLangLbl.appendChild(badge);
        addLangLbl.style.direction = dir;
        addLangLbl.style.textAlign = aln;
        addLangLbl.style.fontFamily = t.rtl ? 'var(--font-arabic)' : '';
    }
    // B.1: Translate footer text
    var footerEl = document.getElementById('appFooter');
    if (footerEl) {
        footerEl.textContent = t.footer;
        footerEl.style.direction = dir;
        footerEl.style.textAlign = t.rtl ? 'right' : 'center';
    }

    // Fix Arabic font size + spacing in desktop sidebar section headers
    document.querySelectorAll('.side-group-header').forEach(function(el) {
        if (t.rtl) {
            el.style.fontSize = '20px';
            el.style.letterSpacing = '0';
            el.style.textTransform = 'none';
        } else {
            el.style.fontSize = '';
            el.style.letterSpacing = '';
            el.style.textTransform = '';
        }
    });

    // v10.11: Translate TOC tab labels
    var tocTabMap = { surah: t.tocSurah, juz: t.tocJuz, revelation: t.tocRevelation, topics: t.tocTopics };
    document.querySelectorAll('.toc-tab').forEach(function(btn) {
        var key = btn.getAttribute('data-tab');
        if (key && tocTabMap[key]) {
            btn.textContent = tocTabMap[key];
            btn.style.direction = dir;
        }
    });
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
document.getElementById('arabicFontSlider').addEventListener('change', function() {
    if (typeof track === 'function') track('font_size_changed', { type: 'arabic', value: parseFloat(this.value) });
});

document.getElementById('transFontSlider').addEventListener('input', function() {
    fontSizes.trans = parseFloat(this.value);
    lsSet(FONT_KEY, fontSizes);
    applyFontSizes();
});
document.getElementById('transFontSlider').addEventListener('change', function() {
    if (typeof track === 'function') track('font_size_changed', { type: 'translation', value: parseFloat(this.value) });
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

// v10.12: Does this surah have any saved item (bookmark, note, highlight, or reflection)?
function suraHasSavedItems(suraId) {
    var sId = String(suraId);
    // Bookmarks
    var bms = lsGet(BOOKMARKS_KEY, []);
    if (bms.some(function(b){ return String(b.suraId) === sId; })) return true;
    // Notes
    var notes = lsGet(NOTES_KEY, {});
    if (Object.keys(notes).some(function(k){ return k.indexOf(sId + '_') === 0; })) return true;
    // Highlights
    var hls = lsGet(HIGHLIGHTS_KEY, {});
    if (Object.keys(hls).some(function(k){ return k.indexOf(sId + '_') === 0; })) return true;
    // Reflections
    try {
        var refs = JSON.parse(localStorage.getItem('quranReflections') || '{}');
        if (refs[sId]) return true;
    } catch(e) {}
    return false;
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
    // v10.10: reflections — { suraId: {text, ts} }
    var reflections = (typeof getReflections === 'function') ? getReflections() : {};
    var reflectionsArr = Object.keys(reflections).map(function(sId) {
        var entry = reflections[sId];
        var sura = quranData.find(function(s){ return s.id === String(sId); });
        return {
            suraId: sId,
            suraName: sura ? sura.name : 'Surah ' + (parseInt(sId) + 1),
            text: entry.text,
            ts: entry.ts
        };
    }).sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });

    // v10.10: Update tab counts — icon stays visible, label may be hidden by CSS on narrow screens
    document.querySelectorAll('.saved-tab').forEach(function(b) {
        var t = b.getAttribute('data-savedtab');
        var count = 0;
        if (t === 'bookmarks')   count = bms.length;
        else if (t === 'notes')  count = notesArr.length;
        else if (t === 'highlights') count = hlArr.length;
        else if (t === 'reflections') count = reflectionsArr.length;
        var lblEl = b.querySelector('.st-lbl');
        if (lblEl) {
            // Restore label and append count
            var origText = lblEl.getAttribute('data-base') || lblEl.textContent.replace(/\s*\(\d+\)$/, '');
            lblEl.setAttribute('data-base', origText);
            lblEl.textContent = origText + (count ? ' (' + count + ')' : '');
        }
        b.classList.toggle('active', t === _desktopSavedTab);
    });

    var lbl = document.getElementById('bookmarks-label');
    var resetBtn = document.getElementById('bookmarksReset');

    if (_desktopSavedTab === 'bookmarks') {
        if (lbl) lbl.textContent = '📁 Saved';
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
        if (lbl) lbl.textContent = '📁 Saved';
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

    } else if (_desktopSavedTab === 'highlights') {
        if (lbl) lbl.textContent = '📁 Saved';
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

    } else {  // reflections (v10.10)
        if (lbl) lbl.textContent = '📁 Saved';
        if (resetBtn) {
            resetBtn.style.display = reflectionsArr.length ? '' : 'none';
            resetBtn.title = 'Clear all reflections';
        }
        if (reflectionsArr.length === 0) {
            list.innerHTML = '<div class="bookmarks-empty"><div class="bookmarks-empty-icon">✍️</div><div>No reflections yet</div><div class="bookmarks-empty-hint">Scroll to the end of a surah to be prompted for a reflection.</div></div>';
            return;
        }
        reflectionsArr.forEach(function(r) {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            const removeBtn = document.createElement('button');
            removeBtn.className = 'bookmark-remove'; removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function(e){
                e.stopPropagation();
                if (typeof saveReflection === 'function') saveReflection(r.suraId, '');
                renderSavedHubDesktop();
            });
            item.appendChild(removeBtn);
            const surahEl = document.createElement('div');
            surahEl.className = 'bookmark-surah';
            var dateStr = r.ts ? new Date(r.ts).toLocaleDateString() : '';
            surahEl.textContent = r.suraName + (dateStr ? ' · ' + dateStr : '');
            const textEl = document.createElement('div');
            textEl.className = 'note-text-preview';
            textEl.textContent = r.text;
            item.appendChild(surahEl); item.appendChild(textEl);
            item.addEventListener('click', function() {
                // v10.11: Open reflection edit modal directly
                if (typeof openReflectionModal === 'function') {
                    openReflectionModal(r.suraId);
                } else {
                    displaySingleSura(r.suraId);
                }
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
    else if (_desktopSavedTab === 'reflections') resetAllReflections();
    else                                        resetAllBookmarks();
};

// v10.10: Reset all reflections (uses showConfirm)
function resetAllReflections() {
    var refs = (typeof getReflections === 'function') ? getReflections() : {};
    var count = Object.keys(refs).length;
    if (count === 0) return;
    if (typeof showConfirm === 'function') {
        showConfirm(
            'Clear all reflections?',
            count + ' reflection' + (count === 1 ? '' : 's') + ' will be removed. This cannot be undone.',
            function() {
                try { localStorage.removeItem('quranReflections'); } catch(e) {}
                renderSavedHubDesktop('reflections');
            }
        );
    } else if (confirm('Clear all ' + count + ' reflections?')) {
        try { localStorage.removeItem('quranReflections'); } catch(e) {}
        renderSavedHubDesktop('reflections');
    }
}

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
        if (btn) btn.classList.remove('active');
    } else {
        hl[key] = true;
        verseEl.classList.add('verse-highlighted');
        if (btn) btn.classList.add('active');
    }
    lsSet(HIGHLIGHTS_KEY, hl);
    // v10.8: Refresh the Saved hub so the highlight appears/disappears immediately
    if (typeof refreshSavedHub === 'function') refreshSavedHub();
    if (typeof renderDesktopNotesList === 'function') renderDesktopNotesList();
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
    // v10.5: Sync verse-has-saved class + rebuild verse-actions
    // so the Save tag remains visible when the verse is collapsed
    var verseEl = noteModalTarget.noteBtn.closest('.verse');
    if (verseEl) {
        var sId = noteModalTarget.suraId;
        var vIdx = noteModalTarget.verseIdx;
        var hasAny = isHighlighted(sId, vIdx) ||
                     isBookmarked(sId, vIdx) ||
                     !!getNotes()[verseKey(sId, vIdx)];
        verseEl.classList.toggle('verse-has-saved', hasAny);
        // Rebuild verse-actions to refresh button states
        var oldActions = verseEl.querySelector('.verse-actions');
        var sura = quranData.find(function(s){ return s.id === String(sId); });
        if (oldActions && sura) {
            oldActions.remove();
            verseEl.appendChild(buildVerseActions(sId, vIdx, sura.verses[vIdx].text, sura.name));
            if (typeof attachAudioButtons === 'function') {
                setTimeout(attachAudioButtons, 10);
            }
        }
    }
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
    // v10.5: Sync verse-has-saved + rebuild verse-actions
    var verseEl = noteModalTarget.noteBtn.closest('.verse');
    if (verseEl) {
        var sId = noteModalTarget.suraId;
        var vIdx = noteModalTarget.verseIdx;
        var hasAny = isHighlighted(sId, vIdx) || isBookmarked(sId, vIdx);
        verseEl.classList.toggle('verse-has-saved', hasAny);
        var oldActions = verseEl.querySelector('.verse-actions');
        var sura = quranData.find(function(s){ return s.id === String(sId); });
        if (oldActions && sura) {
            oldActions.remove();
            verseEl.appendChild(buildVerseActions(sId, vIdx, sura.verses[vIdx].text, sura.name));
            if (typeof attachAudioButtons === 'function') {
                setTimeout(attachAudioButtons, 10);
            }
        }
    }
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
    // v10.12: Refresh BOTH mobile sheet (if showing) AND desktop saved panel (if visible)
    var sheet = document.getElementById('mobileSheet');
    if (sheet && sheet.classList.contains('open') && _sheetCurrentAction === 'bookmarks') {
        var body = document.getElementById('mobileSheetBody');
        var title = document.getElementById('mobileSheetTitle');
        if (body && title) { body.innerHTML = ''; buildSheetBookmarks(body, title); }
    }
    // Desktop saved panel
    var panel = document.getElementById('bookmarksPanel');
    if (panel && !panel.classList.contains('eraseDiv')) {
        if (typeof renderSavedHubDesktop === 'function') {
            renderSavedHubDesktop(_desktopSavedTab || 'bookmarks');
        }
    }
    // v10.12: Re-render TOC so the golden dot (saved-dot) updates
    if (typeof renderCurrentTOC === 'function') {
        renderCurrentTOC();
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
    // Add secondary surah name to the sticky title bar
    var titleTextEl = document.querySelector('.sura-sticky-title-text');
    if (titleTextEl && sura.name) {
        var nameSpan = document.createElement('span');
        nameSpan.className = 'sura-secondary-name';
        nameSpan.setAttribute('data-lang', langCode);
        nameSpan.textContent = sura.name;
        nameSpan.style.color = color;
        titleTextEl.appendChild(nameSpan);
    }
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
    const suraEl = getCurrentSuraEl();
    const suraToShow = (targetSuraId !== undefined && targetSuraId !== null)
        ? targetSuraId : (suraEl ? +suraEl.getAttribute('id') : 0);
    try {
        quranData = await fetchAndParseQuran(currentLanguage);
        // v10.8: When loading classic order, force the TOC back to Surah tab
        // (otherwise activeTocTab may still be 'revelation' from a prior toggle)
        if (isOriginalOrder) activeTocTab = 'surah';
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
    // v10.12: Golden dot if this surah has any saved item (bookmark/note/highlight/reflection)
    if (suraId !== undefined && suraHasSavedItems(suraId)) {
        const sdot = document.createElement('span');
        sdot.className = 'saved-dot'; sdot.title = 'Has saved items';
        nameSpan.appendChild(sdot);
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
    // v10: Continue Reading card at top of desktop Surahs TOC
    if (typeof buildContinueCard === 'function') {
        const crc = buildContinueCard();
        if (crc) {
            crc.classList.add('continue-reading-card-desktop');
            sw.appendChild(crc);
        }
    }
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
    else if (activeTocTab === 'topics' && typeof generateTopicsTOC === 'function') generateTopicsTOC();
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

// v10.11: Generate Topics TOC — renders curated themes inline in the sidebar TOC
function generateTopicsTOC() {
    activeTocTab = 'topics';
    setTocTabActive('topics');
    const tocEl = document.getElementById('toc-scroll');
    if (!tocEl) return;
    tocEl.innerHTML = '';
    const lbl = document.getElementById('toc-section-label');
    if (lbl) {
        var lang = currentLanguage || 'english';
        var browseLabel = {
            arabic:  'تصفح حسب الموضوع',
            french:  'Parcourir par thème',
            english: 'Browse by theme',
            spanish: 'Explorar por tema'
        }[lang] || 'Browse by theme';
        lbl.textContent = browseLabel;
    }
    // TOPICS array lives in features.js — fall back if not loaded yet
    var topics = (typeof TOPICS !== 'undefined') ? TOPICS : [];
    if (!topics.length) {
        tocEl.innerHTML = '<div style="padding:14px;opacity:0.7;font-size:13px;text-align:center;">Topics loading…</div>';
        return;
    }
    topics.forEach(function(t, idx) {
        var item = document.createElement('div');
        item.className = 'toc-item topic-toc-item';
        item.innerHTML =
            '<span class="toc-num" style="font-size:14px;">' + t.icon + '</span>' +
            '<span class="toc-item-left">' + (typeof getTopicName === 'function' ? getTopicName(t.name) : t.name) + '</span>' +
            '<span class="topic-count" style="font-size:11px;color:var(--accent);background:var(--accent-trace);padding:1px 7px;border-radius:99px;border:0.5px solid var(--accent-faint);">' + t.verses.length + '</span>';
        item.addEventListener('click', function() {
            if (typeof openTopicVerses === 'function') openTopicVerses(idx);
        });
        tocEl.appendChild(item);
    });
}

// Tab click listeners
document.querySelectorAll('.toc-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const tab = btn.getAttribute('data-tab');
        if (tab === 'surah')           generateTOC();
        else if (tab === 'juz')        generateJuzTOC();
        else if (tab === 'revelation') generateRevelationTOC();
        else if (tab === 'topics')     generateTopicsTOC();
        if (typeof track === 'function') track('toc_tab_switched', { tab: tab });
        saveState();
    });
});

// ═══════════════════════════════════════════════════════════════════
// VERSE RENDERING WITH ACTIONS — v10: Grouped Save/Share with chooser
// ═══════════════════════════════════════════════════════════════════
function buildVerseActions(suraId, verseIdx, verseText, suraName) {
    const actions = document.createElement('div');
    actions.classList.add('verse-actions');

    // ── Compute current saved state ──
    const isHL = isHighlighted(suraId, verseIdx);
    const isBM = isBookmarked(suraId, verseIdx);
    const noteData = getNotes()[verseKey(suraId, verseIdx)];
    const isNT = !!noteData;
    const anySaved = isHL || isBM || isNT;

    // ── SAVE button (groups Highlight, Bookmark, Note) — v10.11: ALWAYS built, CSS hides when feature off ──
    {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'verse-action-btn verse-action-save';
        if (anySaved) saveBtn.classList.add('has-saved');
        saveBtn.innerHTML = '<span class="va-icon">🔖</span><span class="va-label">Save</span>';
        if (anySaved) {
            const dot = document.createElement('span');
            dot.className = 'va-dot';
            saveBtn.appendChild(dot);
        }
        saveBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openVerseChooser('save', saveBtn, { suraId: suraId, verseIdx: verseIdx, verseText: verseText, suraName: suraName });
        });
        actions.appendChild(saveBtn);
    }

    // ── SHARE button (groups Copy, Share, Link) — gated by copyShareVerse feature ──
    if (typeof isFeatureOn !== 'function' || isFeatureOn('copyShareVerse')) {
        const shareBtn = document.createElement('button');
        shareBtn.className = 'verse-action-btn verse-action-share';
        shareBtn.innerHTML = '<span class="va-icon">↗</span><span class="va-label">Share</span>';
        shareBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openVerseChooser('share', shareBtn, { suraId: suraId, verseIdx: verseIdx, verseText: verseText, suraName: suraName });
        });
        actions.appendChild(shareBtn);
    }

    // ── TAFSIR button — v10.11: ALWAYS built, CSS hides when feature off ──
    {
        const tafsirBtn = document.createElement('button');
        tafsirBtn.className = 'verse-action-btn verse-action-tafsir';
        tafsirBtn.innerHTML = '<span class="va-icon">📚</span><span class="va-label">Tafsir</span>';
        tafsirBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof openTafsirModal === 'function') {
                openTafsirModal(suraId, verseIdx, verseText, suraName);
            }
        });
        actions.appendChild(tafsirBtn);
    }

    return actions;
}

// ── v10: Verse chooser popover (Save / Share) ──
let _activeChooser = null;
function closeVerseChooser() {
    if (_activeChooser) {
        _activeChooser.remove();
        _activeChooser = null;
    }
}
document.addEventListener('click', function(e) {
    if (_activeChooser && !e.target.closest('.verse-chooser') && !e.target.closest('.verse-action-btn')) {
        closeVerseChooser();
    }
});
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeVerseChooser();
});

function openVerseChooser(kind, anchorBtn, ctx) {
    // v10.3: Block share chooser entirely if copyShareVerse is disabled
    if (kind === 'share' && typeof isFeatureOn === 'function' && !isFeatureOn('copyShareVerse')) {
        return;
    }
    // v10.8: Block save chooser entirely if saveTools is disabled
    if (kind === 'save' && typeof isFeatureOn === 'function' && !isFeatureOn('saveTools')) {
        return;
    }
    closeVerseChooser();
    const chooser = document.createElement('div');
    chooser.className = 'verse-chooser';

    const items = (kind === 'save')
        ? [
            { id: 'highlight', icon: '✦', label: 'Highlight', active: isHighlighted(ctx.suraId, ctx.verseIdx) },
            { id: 'bookmark',  icon: '🔖', label: 'Bookmark', active: isBookmarked(ctx.suraId, ctx.verseIdx) },
            { id: 'note',      icon: '📝', label: getNotes()[verseKey(ctx.suraId, ctx.verseIdx)] ? 'Edit note' : 'Add note', active: !!getNotes()[verseKey(ctx.suraId, ctx.verseIdx)] }
          ]
        : [
            { id: 'copy',  icon: '📋', label: 'Copy verse' },
            ...(navigator.share ? [{ id: 'share', icon: '↗', label: 'Share…' }] : []),
            { id: 'link',  icon: '🔗', label: 'Copy link' }
          ];

    items.forEach(function(item) {
        const it = document.createElement('button');
        it.className = 'verse-chooser-item' + (item.active ? ' active' : '');
        it.innerHTML = '<span class="vci-icon">' + item.icon + '</span>' +
                       '<span class="vci-label">' + item.label + '</span>' +
                       (item.active ? '<span class="vci-check">✓</span>' : '');
        it.addEventListener('click', function(e) {
            e.stopPropagation();
            handleChooserAction(kind, item.id, ctx, anchorBtn);
            closeVerseChooser();
        });
        chooser.appendChild(it);
    });

    // Position: place under the button, right-aligned to it
    document.body.appendChild(chooser);
    const rect = anchorBtn.getBoundingClientRect();
    const chooserH = chooser.offsetHeight;
    const chooserW = chooser.offsetWidth;
    let top = rect.bottom + 6 + window.scrollY;
    let left = rect.left + window.scrollX;
    // Flip up if no room below
    if (top + chooserH > window.innerHeight + window.scrollY - 10) {
        top = rect.top - chooserH - 6 + window.scrollY;
    }
    // Keep within viewport horizontally
    if (left + chooserW > window.innerWidth - 10) {
        left = window.innerWidth - chooserW - 10;
    }
    if (left < 10) left = 10;
    chooser.style.top = top + 'px';
    chooser.style.left = left + 'px';
    _activeChooser = chooser;

    // Animate in
    requestAnimationFrame(function() {
        chooser.classList.add('show');
    });
}

function handleChooserAction(kind, action, ctx, anchorBtn) {
    const verseEl = anchorBtn.closest('.verse');
    if (kind === 'save') {
        if (action === 'highlight') {
            toggleHighlight(ctx.suraId, ctx.verseIdx, verseEl, null);
        } else if (action === 'bookmark') {
            if (isBookmarked(ctx.suraId, ctx.verseIdx)) {
                removeBookmark(verseKey(ctx.suraId, ctx.verseIdx));
            } else {
                addBookmark(ctx.suraId, ctx.verseIdx, ctx.verseText, ctx.suraName);
                if (typeof track === 'function') track('bookmark_added', { sura: parseInt(ctx.suraId) + 1, verse: ctx.verseIdx + 1 });
            }
        } else if (action === 'note') {
            // Use a fake noteBtn anchor; openNoteModal needs an element to anchor near
            openNoteModal(ctx.suraId, ctx.verseIdx, anchorBtn);
        }
        // Refresh this verse's actions to update saved-state visuals
        const old = verseEl.querySelector('.verse-actions');
        if (old) old.remove();
        verseEl.appendChild(buildVerseActions(ctx.suraId, ctx.verseIdx, ctx.verseText, ctx.suraName));
        // v10.4: Sync verse-has-saved class on the verse element itself
        // so the Save tag remains visible when collapsed
        var hasAny = isHighlighted(ctx.suraId, ctx.verseIdx) ||
                     isBookmarked(ctx.suraId, ctx.verseIdx) ||
                     !!getNotes()[verseKey(ctx.suraId, ctx.verseIdx)];
        verseEl.classList.toggle('verse-has-saved', hasAny);
        // v10.3: Audio button was lost in the rebuild — re-attach
        if (typeof attachAudioButtons === 'function') {
            setTimeout(attachAudioButtons, 10);
        }
    } else if (kind === 'share') {
        if (typeof track === 'function') track('verse_shared', { action: action, sura: parseInt(ctx.suraId) + 1, verse: ctx.verseIdx + 1 });
        if (typeof copyVerseToClipboard === 'function' && action === 'copy') {
            copyVerseToClipboard(ctx.suraId, ctx.verseIdx, ctx.verseText, ctx.suraName);
        } else if (typeof shareVerse === 'function' && action === 'share') {
            shareVerse(ctx.suraId, ctx.verseIdx, ctx.verseText, ctx.suraName);
        } else if (action === 'link' && typeof buildDeepLink === 'function') {
            const url = buildDeepLink(ctx.suraId, ctx.verseIdx + 1);
            if (typeof copyToClipboard === 'function') copyToClipboard(url);
            if (typeof showToast === 'function') showToast('🔗 Link copied');
        }
    }
}

function buildSuraDOM(sura) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('sura'); wrapper.id = sura.id;

    // v10: Sticky title bar with streak pill + focus pill
    const sticky = document.createElement('div');
    sticky.className = 'sura-sticky-title';

    // Streak pill (left) — only shown if khatm tracker on AND streak > 0
    const streakSpan = document.createElement('span');
    streakSpan.className = 'sura-streak-pill';
    if (typeof getCurrentReadingStreak === 'function') {
        const streak = getCurrentReadingStreak();
        if (streak > 0) {
            streakSpan.innerHTML = '🔥 <span class="streak-num">' + streak + '</span>';
            streakSpan.title = 'Reading streak — tap for activity';
            streakSpan.addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof toggleInlineHeatmap === 'function') toggleInlineHeatmap(wrapper);
            });
        } else {
            streakSpan.classList.add('hidden');
        }
    } else {
        streakSpan.classList.add('hidden');
    }
    sticky.appendChild(streakSpan);

    // Title text (center)
    const titleText = document.createElement('span');
    titleText.className = 'sura-sticky-title-text';
    titleText.textContent = (parseInt(sura.id) + 1) + ' · ' + sura.name;
    sticky.appendChild(titleText);

    // v10.4: Install pill removed from sticky title — replaced by header banner.

    // v10.8: Print pill — opens browser print dialog (filtered for this surah)
    // v10.11: SVG download icon + "PDF" label so it's clearly readable
    const printPill = document.createElement('button');
    printPill.className = 'sura-print-pill';
    printPill.title = 'Print / Export this surah as PDF';
    printPill.innerHTML =
        '<svg class="spp-svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 3v11.59l-3.3-3.3a1 1 0 0 0-1.4 1.42l5 5a1 1 0 0 0 1.4 0l5-5a1 1 0 0 0-1.4-1.42L13 14.59V3a1 1 0 0 0-2 0z"/>' +
            '<path d="M5 19a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H5z"/>' +
        '</svg>' +
        '<span class="spp-lbl">PDF</span>';
    printPill.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof printCurrentSurah === 'function') printCurrentSurah();
    });
    sticky.appendChild(printPill);

    // Focus pill (right) — only if focus mode feature is on
    const focusPill = document.createElement('button');
    focusPill.className = 'sura-focus-pill';
    focusPill.title = 'Enter focus mode';
    focusPill.textContent = '🧘';
    focusPill.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof enterFocusMode === 'function') {
            enterFocusMode();
        }
    });
    if (typeof isFeatureOn === 'function' && !isFeatureOn('focusMode')) {
        focusPill.classList.add('hidden');
    }
    sticky.appendChild(focusPill);

    wrapper.appendChild(sticky);

    // v10.3: Refresh install pill visibility after rendering
    setTimeout(function() {
        if (typeof updateInstallPill === 'function') updateInstallPill();
    }, 50);

    const title = document.createElement('h2');
    title.id = 'suraTitle';
    title.textContent = (parseInt(sura.id) + 1) + ' — ' + sura.name;
    wrapper.appendChild(title);

    // v10.3: Modern Reverent — Bismillah panel at the start of each surah
    // (except Surah 9 At-Tawbah, which traditionally has no Bismillah)
    // Surah 1 Al-Fatiha keeps the panel even though verse 1 is the Bismillah
    var sNum = parseInt(sura.id, 10) + 1;
    if (sNum !== 9) {
        var bismillahPanel = document.createElement('div');
        bismillahPanel.className = 'bismillah-panel';
        bismillahPanel.innerHTML =
            '<div class="bismillah-rule bismillah-rule-top"></div>' +
            '<div class="bismillah-text" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>' +
            '<div class="bismillah-rule bismillah-rule-bottom"></div>';
        wrapper.appendChild(bismillahPanel);
    }

    sura.verses.forEach(function(verse, verseIdx) {
        const p = document.createElement('p');
        p.classList.add('verse');
        if (isArabic) p.classList.add('right-align');
        if (isHighlighted(sura.id, verseIdx)) p.classList.add('verse-highlighted');
        // v10.4: Mark verse so its Save tag stays visible when collapsed
        if (isHighlighted(sura.id, verseIdx) || isBookmarked(sura.id, verseIdx) || getNotes()[verseKey(sura.id, verseIdx)]) {
            p.classList.add('verse-has-saved');
        }
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

// v10.8: Robust lookup for the currently displayed .sura element.
// Handles the zoom-wrapper case where firstChild is the wrapper, not the sura.
function getCurrentSuraEl() {
    var container = document.getElementById('quranContainer');
    if (!container) return null;
    return container.querySelector('.sura');
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
    // Surah completion burst — arm after 800 ms so short surahs don't fire on load
    (function() {
        var verses = container.querySelectorAll('.verse');
        var lastV  = verses[verses.length - 1];
        if (!lastV) return;
        var armed  = false;
        var armTimer = setTimeout(function() { armed = true; }, 800);
        var obs = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting && armed) {
                obs.disconnect();
                clearTimeout(armTimer);
                if (typeof triggerSurahCompleteFX === 'function') triggerSurahCompleteFX(lastV);
            }
        }, { threshold: 0.6, root: container });
        obs.observe(lastV);
    })();
    // v10.12: SYNCHRONOUS audio button attach — eliminates race condition
    if (typeof attachAudioButtons === 'function') attachAudioButtons();
    // v10.7 BUG FIX: re-apply additional languages on every sura change
    // (verses are recreated from scratch — secondary translations would otherwise be lost)
    if (additionalLanguages && additionalLanguages.length > 0) {
        additionalLanguages.forEach(function(code) {
            // If we don't have the data yet, fetch it then apply
            if (!xmlCache[code]) {
                fetchAndParseQuran(code).then(function() {
                    applyLanguageToVerses(code);
                }).catch(function(e) {
                    console.error('Error re-applying language', code, e);
                });
            } else {
                applyLanguageToVerses(code);
            }
        });
    }
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
    // Surah completion burst (same logic as displaySingleSura)
    (function() {
        var verses = container.querySelectorAll('.verse');
        var lastV  = verses[verses.length - 1];
        if (!lastV) return;
        var armed  = false;
        var armTimer = setTimeout(function() { armed = true; }, 800);
        var obs = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting && armed) {
                obs.disconnect();
                clearTimeout(armTimer);
                if (typeof triggerSurahCompleteFX === 'function') triggerSurahCompleteFX(lastV);
            }
        }, { threshold: 0.6, root: container });
        obs.observe(lastV);
    })();
    // v10.7 BUG FIX: same re-apply logic as displaySingleSura
    if (additionalLanguages && additionalLanguages.length > 0) {
        additionalLanguages.forEach(function(code) {
            if (!xmlCache[code]) {
                fetchAndParseQuran(code).then(function() {
                    applyLanguageToVerses(code);
                }).catch(function(e) {
                    console.error('Error re-applying language', code, e);
                });
            } else {
                applyLanguageToVerses(code);
            }
        });
    }
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
    var suraEl = getCurrentSuraEl();
    if (!suraEl) return;
    const sura = quranData.find(function(s){ return s.id === suraEl.id; });
    if (!sura) return;
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
    var suraEl = getCurrentSuraEl();
    if (suraEl) displaySingleSura(suraEl.id);
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
    var currentEl = getCurrentSuraEl();
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
// v10.8: Track which search scope is currently active so the buttons reflect it
let _lastSearchScope = 'quran'; // 'quran' or 'sura'
function setSearchScope(scope) {
    _lastSearchScope = scope;
    var qBtn = document.getElementById('searchbutton');
    var sBtn = document.getElementById('searchButtonSourats');
    if (qBtn) qBtn.classList.toggle('search-active', scope === 'quran');
    if (sBtn) sBtn.classList.toggle('search-active', scope === 'sura');
}

document.getElementById('searchbutton').addEventListener('click', function(){
    setSearchScope('quran');
    const term = document.getElementById('search-input').value.trim();
    if (term) {
        if (typeof track === 'function') track('search', { scope: 'quran', term_length: term.length });
        searchQuran(term);
    }
});

document.getElementById('searchButtonSourats').addEventListener('click', function(){
    setSearchScope('sura');
    const term = document.getElementById('search-input').value.trim();
    if (term) {
        if (typeof track === 'function') track('search', { scope: 'surah', term_length: term.length });
        searchSourat(term);
    }
});

document.getElementById('search-input').addEventListener('keydown', function(e){
    if (e.key === 'Enter') {
        const term = e.target.value.trim();
        if (!term) return;
        // v10.8: Enter follows the last selected scope (default: Quran-wide)
        if (_lastSearchScope === 'sura') searchSourat(term);
        else searchQuran(term);
    }
});

document.getElementById('reset-button').addEventListener('click', resetSearch);

document.getElementById('languageSelector').addEventListener('change', function(){
    var oldLang = currentLanguage;
    currentLanguage = this.value; isArabic = (currentLanguage === 'arabic');
    if (additionalLanguages.indexOf(currentLanguage) !== -1) removeSecondaryLanguage(currentLanguage);
    if (typeof track === 'function') track('language_changed', { language: currentLanguage });
    // v10.7: Sync the add-language dropdown so the new primary isn't offered
    // (and the old primary becomes available to add as a translation)
    rebuildAddLangSelector();
    applyUILanguage(currentLanguage); loadQuranData();
});

// v10.7: Rebuild the desktop add-language dropdown to exclude:
//   - the current primary language (would be duplicate)
//   - languages already added as secondary
// Always resets to the placeholder option.
function rebuildAddLangSelector() {
    var sel = document.getElementById('SurahLanguageSelector');
    if (!sel) return;
    var allLangs = [
        ['arabic',  'Arabic'],
        ['french',  'Français'],
        ['english', 'English'],
        ['spanish', 'Español']
    ];
    sel.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '+ Add a language…';
    sel.appendChild(placeholder);
    allLangs.forEach(function(p) {
        if (p[0] === currentLanguage) return;
        if (additionalLanguages.indexOf(p[0]) !== -1) return;
        var opt = document.createElement('option');
        opt.value = p[0]; opt.textContent = p[1];
        sel.appendChild(opt);
    });
    sel.value = ''; // explicit reset
}

document.getElementById('SurahLanguageSelector').addEventListener('change', function(){
    const code = this.value; if (!code) return; this.value = '';
    if (code === currentLanguage) return;
    if (typeof track === 'function') track('translation_added', { language: code });
    addSecondaryLanguage(code);
});

// toggleOrder button removed from sidebar — revelation order is accessible via the TOC tab
var _toggleOrderBtn = document.getElementById('toggleOrder');
if (_toggleOrderBtn) {
    _toggleOrderBtn.addEventListener('click', function(){
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
}

document.getElementById('context').addEventListener('click', async function(){
    if (contextOpen) { clearSuraContext(); return; }
    closeSearchResults();
    var suraEl = getCurrentSuraEl();
    if (!suraEl) return;
    const suraData = quranData.find(function(s){ return s.id === suraEl.id; });
    if (!suraData) return;
    if (typeof track === 'function') track('surah_context_opened', { sura: parseInt(suraData.id) + 1 });
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

document.querySelectorAll('.theme-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
        const theme = btn.getAttribute('data-theme');
        if (typeof track === 'function') track('theme_changed', { theme: theme });
        applyTheme(theme);
        saveState();
    });
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

        // v10.12: Removed auto-restore of contextOpen — user found it intrusive
        // (would auto-open Al-Baqara's context on every page refresh).
        // User now opens context explicitly with the Surah Context button.
        if (saved.contextOpen) {
            // Best-effort cleanup of stale flag
            saved.contextOpen = false;
            saved.contextSuraIndex = null;
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

// v10.8: Default search scope is whole-Quran on app load
setTimeout(function(){ if (typeof setSearchScope === 'function') setSearchScope('quran'); }, 100);

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
    // v10.12: Clean up TOC tabs row (added by buildSheetSurahs)
    var existingTocTabs = sheetEl.querySelector('.mob-toc-tabs');
    if (existingTocTabs) existingTocTabs.remove();
    // v10.13 phone redesign — new 4-tab actions
    if (action === 'read')           buildSheetSurahs(body, title);
    else if (action === 'share')     buildSheetShare(body, title);
    else if (action === 'bookmark')  buildSheetBookmarks(body, title);
    // legacy / tablet actions kept for backward compat
    else if (action === 'surah')     buildSheetSurahs(body, title);
    else if (action === 'juz')       buildSheetJuz(body, title);
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
    // v10.12: Clean up tab bars so they don't accumulate across sheet opens
    var tocTabs = sheet.querySelector('.mob-toc-tabs'); if (tocTabs) tocTabs.remove();
    var savedTabs = sheet.querySelector('.mob-saved-tabs'); if (savedTabs) savedTabs.remove();
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
// v10.12: Mobile sheet remembers which TOC tab was last active
// v10.13: 'topics' replaced by 'theme' tab in phone redesign
var _mobileTocTab = 'surah'; // 'surah' | 'juz' | 'revelation' | 'topics'

function buildSheetSurahs(body, title) {
    // Migration guard: reset stale values from old tab names
    if (_mobileTocTab === 'theme') _mobileTocTab = 'surah';

    // v10.12: Sheet now contains TOC tab bar — single entry point for all 4 nav modes
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    var tabLabels = {
        arabic:  { surah: '📖 السور', juz: '📚 الأجزاء', revelation: '🌙 الوحي', topics: '💡 المواضيع' },
        french:  { surah: '📖 Sourates', juz: '📚 Juz', revelation: '🌙 Révélation', topics: '💡 Thèmes' },
        english: { surah: '📖 Surahs', juz: '📚 Juz', revelation: '🌙 Revelation', topics: '💡 Topics' },
        spanish: { surah: '📖 Suras', juz: '📚 Juz', revelation: '🌙 Revelación', topics: '💡 Temas' }
    };
    var L = tabLabels[lang] || tabLabels.english;

    // Title from active tab
    title.textContent = L[_mobileTocTab] || L.surah;

    // Clear body first so prepend + content rendering don't conflict
    body.innerHTML = '';

    // Insert tab bar as first child of body (sticky so it stays visible while list scrolls)
    var sheet = document.getElementById('mobileSheet');
    var existingTabs = sheet.querySelector('.mob-toc-tabs');
    if (existingTabs) existingTabs.remove();
    var tabsRow = document.createElement('div');
    tabsRow.className = 'mob-toc-tabs';
    ['surah','juz','revelation','topics'].forEach(function(tab) {
        var btn = document.createElement('button');
        btn.className = 'mob-toc-tab' + (_mobileTocTab === tab ? ' active' : '');
        btn.textContent = L[tab];
        btn.addEventListener('click', function() {
            _mobileTocTab = tab;
            if (typeof track === 'function') track('toc_tab_switched', { tab: tab, surface: 'mobile' });
            buildSheetSurahs(body, title);
        });
        tabsRow.appendChild(btn);
    });
    body.prepend(tabsRow);

    // Dispatch to the right renderer based on active tab
    if (_mobileTocTab === 'juz') {
        buildSheetJuzInBody(body);
        return;
    }
    if (_mobileTocTab === 'revelation') {
        buildSheetRevelationInBody(body);
        return;
    }
    if (_mobileTocTab === 'topics') {
        buildSheetTopicsInBody(body);
        return;
    }

    // Default: surahs
    var currentSuraEl = document.querySelector('.sura');
    var currentId = currentSuraEl ? currentSuraEl.id : '0';

    // v10: Continue Reading card at top — persistent (not dismissible)
    if (typeof buildContinueCard === 'function') {
        var crc = buildContinueCard();
        if (crc) body.appendChild(crc);
    }

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

// v10.12: Renderers that put Juz/Revelation/Topics into the SAME mobile sheet body
function buildSheetJuzInBody(body) {
    if (typeof JUZ_DATA === 'undefined') return;
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
                    var verses = document.querySelectorAll('.sura .verse');
                    if (verses[juz[3] - 1]) verses[juz[3] - 1].scrollIntoView({ behavior:'smooth' });
                }, 200);
            }
        });
        body.appendChild(item);
    });
}

function buildSheetRevelationInBody(body) {
    if (typeof RevelationOrder === 'undefined') return;
    RevelationOrder.forEach(function(suraNum, idx) {
        var sura = quranData.find(function(s){ return s.id === String(suraNum - 1); });
        if (!sura) return;
        var item = document.createElement('div');
        item.className = 'mob-surah-item';
        var name = document.createElement('span');
        name.className = 'mob-surah-name';
        name.textContent = (idx + 1) + '. ' + sura.name;
        var num = document.createElement('span');
        num.className = 'mob-surah-num';
        num.textContent = suraNum;
        item.appendChild(name); item.appendChild(num);
        item.addEventListener('click', function() {
            closeMobileSheet();
            clearAllSecondaryLanguages();
            closeSearchResults();
            displaySingleSura(suraNum - 1);
            markSuraAsRead(suraNum - 1);
        });
        body.appendChild(item);
    });
}

function buildSheetTopicsInBody(body) {
    var topics = (typeof TOPICS !== 'undefined') ? TOPICS : [];
    if (!topics.length) {
        body.innerHTML = '<div style="padding:20px;text-align:center;opacity:0.7;font-size:13px;">Topics loading…</div>';
        return;
    }
    topics.forEach(function(t, idx) {
        var item = document.createElement('div');
        item.className = 'mob-surah-item mob-topic-item';
        var ico = document.createElement('span');
        ico.style.cssText = 'font-size:18px;margin-right:6px;';
        ico.textContent = t.icon;
        var name = document.createElement('span');
        name.className = 'mob-surah-name';
        name.textContent = (typeof getTopicName === 'function' ? getTopicName(t.name) : t.name);
        var num = document.createElement('span');
        num.className = 'mob-surah-num';
        num.textContent = t.verses.length;
        item.appendChild(ico); item.appendChild(name); item.appendChild(num);
        item.addEventListener('click', function() {
            closeMobileSheet();
            setTimeout(function() {
                if (typeof openTopicVerses === 'function') openTopicVerses(idx);
            }, 250);
        });
        body.appendChild(item);
    });
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

    // ── Arabic diacritic option (only when primary language is Arabic) ──
    if (currentLanguage === 'arabic') {
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
    }

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
    // v10.10: Reflections
    var refsObj = (typeof getReflections === 'function') ? getReflections() : {};
    var refsArr = Object.keys(refsObj).map(function(sId) {
        var entry = refsObj[sId];
        var sura = quranData.find(function(s){ return s.id === String(sId); });
        return {
            suraId: sId,
            suraName: sura ? sura.name : 'Surah ' + (parseInt(sId) + 1),
            text: entry.text,
            ts: entry.ts
        };
    }).sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });

    // ── Title reflects active tab ──
    function updateTitle(tab) {
        title.textContent = '📁 Saved';
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
                       (tab === 'highlights'&& hlArr.length) ||
                       (tab === 'reflections'&& refsArr.length);
        if (!hasItems) return;
        var resetBtn = document.createElement('button');
        resetBtn.className = 'mob-sheet-reset';
        resetBtn.textContent = '🗑 Reset';
        resetBtn.title = 'Clear all in this tab';
        resetBtn.addEventListener('click', function() {
            if (tab === 'notes')           resetAllNotes();
            else if (tab === 'highlights') resetAllHighlights();
            else if (tab === 'reflections')resetAllReflections();
            else                           resetAllBookmarks();
        });
        var closeBtn = headerEl.querySelector('.mob-sheet-close');
        headerEl.insertBefore(resetBtn, closeBtn);
    }
    ensureReset(_savedHubActiveTab);

    // ── Body content ──
    body.innerHTML = '';

    // ── Tab bar — sticky at top of scrollable body ──
    var tabsRow = sheet.querySelector('.mob-saved-tabs');
    if (tabsRow) tabsRow.remove();
    tabsRow = document.createElement('div');
    tabsRow.className = 'mob-saved-tabs';
    [
        { id: 'bookmarks',  icon: '🔖', label: 'Bookmarks',  count: bms.length },
        { id: 'notes',      icon: '📝', label: 'Notes',      count: notesArr.length },
        { id: 'highlights', icon: '✦',  label: 'Highlights', count: hlArr.length },
        { id: 'reflections',icon: '✍️', label: 'Reflections',count: refsArr.length }
    ].forEach(function(t) {
        var btn = document.createElement('button');
        btn.className = 'mob-saved-tab' + (_savedHubActiveTab === t.id ? ' active' : '');
        // v10.12: Count is in its own span so it stays visible on narrow screens (when label hides)
        btn.innerHTML = '<span class="mst-ico">' + t.icon + '</span><span class="mst-lbl">' + t.label + '</span>' +
                        (t.count ? '<span class="mst-count">' + t.count + '</span>' : '');
        btn.addEventListener('click', function() {
            _savedHubActiveTab = t.id;
            buildSheetBookmarks(body, title);
        });
        tabsRow.appendChild(btn);
    });
    body.prepend(tabsRow);
    if (_savedHubActiveTab === 'bookmarks') {
        renderBookmarksInBody(body, bms);
    } else if (_savedHubActiveTab === 'notes') {
        renderNotesInBody(body, notesArr);
    } else if (_savedHubActiveTab === 'highlights') {
        renderHighlightsInBody(body, hlArr);
    } else {
        renderReflectionsInBody(body, refsArr);
    }
}

function renderBookmarksInBody(body, bms) {
    if (!bms.length) {
        var empty = document.createElement('div');
        empty.className = 'mob-bookmarks-empty';
        empty.innerHTML = '<div class="mob-bookmarks-empty-icon">🔖</div><div>No bookmarks yet</div><div class="mob-bookmarks-empty-hint">Tap a verse and the 🔖 button to save it.</div>';
        body.appendChild(empty);
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
        var empty = document.createElement('div');
        empty.className = 'mob-bookmarks-empty';
        empty.innerHTML = '<div class="mob-bookmarks-empty-icon">📝</div><div>No notes yet</div><div class="mob-bookmarks-empty-hint">Tap a verse and the 📝 button to add a note.</div>';
        body.appendChild(empty);
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
        var empty = document.createElement('div');
        empty.className = 'mob-bookmarks-empty';
        empty.innerHTML = '<div class="mob-bookmarks-empty-icon">✦</div><div>No highlights yet</div><div class="mob-bookmarks-empty-hint">Tap a verse and the ✦ Highlight button.</div>';
        body.appendChild(empty);
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

// v10.10: Reflections in mobile sheet
function renderReflectionsInBody(body, refsArr) {
    if (!refsArr.length) {
        var empty = document.createElement('div');
        empty.className = 'mob-bookmarks-empty';
        empty.innerHTML = '<div class="mob-bookmarks-empty-icon">✍️</div><div>No reflections yet</div><div class="mob-bookmarks-empty-hint">Scroll to the end of a surah — you\'ll be prompted to reflect.</div>';
        body.appendChild(empty);
        return;
    }
    refsArr.forEach(function(r) {
        var item = document.createElement('div');
        item.className = 'mob-bm-item';
        var rmv = document.createElement('button');
        rmv.className = 'mob-saved-rm'; rmv.textContent = '✕'; rmv.title = 'Delete reflection';
        rmv.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof saveReflection === 'function') saveReflection(r.suraId, '');
            var bodyEl = document.getElementById('mobileSheetBody');
            var titleEl = document.getElementById('mobileSheetTitle');
            if (bodyEl && titleEl) buildSheetBookmarks(bodyEl, titleEl);
        });
        item.appendChild(rmv);
        var surah = document.createElement('div'); surah.className = 'mob-bm-surah';
        var dateStr = r.ts ? new Date(r.ts).toLocaleDateString() : '';
        surah.textContent = r.suraName + (dateStr ? ' · ' + dateStr : '');
        var textEl = document.createElement('div'); textEl.className = 'mob-bm-note-text';
        textEl.textContent = r.text;
        item.appendChild(surah); item.appendChild(textEl);
        item.addEventListener('click', function() {
            closeMobileSheet();
            // v10.11: Open the edit modal directly so user can read/edit
            setTimeout(function() {
                if (typeof openReflectionModal === 'function') {
                    openReflectionModal(r.suraId);
                } else {
                    displaySingleSura(r.suraId);
                }
            }, 200);
        });
        body.appendChild(item);
    });
}

// ── Theme tab (Group B — inside Read panel) ───────────────────────
function buildSheetThemeTab(body) {
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'manuscript';

    // Theme definitions with actual preview colors
    var themes = [
        {
            id: 'scholar',
            label: 'Dark',
            icon: '🌑',
            bg: '#0d1117',
            surface: '#161b22',
            textColor: '#e6edf3',
            accentColor: '#c9a444'
        },
        {
            id: 'minimal',
            label: 'Light',
            icon: '☀️',
            bg: '#f8f7f4',
            surface: '#eeece5',
            textColor: '#2c2416',
            accentColor: '#9c7a2e'
        },
        {
            id: 'manuscript',
            label: 'Sepia',
            icon: '🌙',
            bg: '#1a1208',
            surface: '#251a0c',
            textColor: '#e8d5a3',
            accentColor: '#c9a444'
        }
    ];

    var cardsWrap = document.createElement('div');
    cardsWrap.className = 'mob-theme-cards';

    themes.forEach(function(t) {
        var isActive = (currentTheme === t.id);
        var card = document.createElement('button');
        card.className = 'mob-theme-card' + (isActive ? ' active' : '');
        card.style.background = t.bg;
        card.style.borderColor = isActive ? t.accentColor : 'transparent';
        card.innerHTML =
            '<span class="mob-tc-icon">' + t.icon + '</span>' +
            '<span class="mob-tc-label" style="color:' + t.accentColor + '">' + t.label + '</span>' +
            '<span class="mob-tc-bar" style="background:' + t.accentColor + ';opacity:0.6"></span>' +
            (isActive ? '<span class="mob-tc-active" style="background:' + t.accentColor + ';color:' + t.bg + '">Active</span>' : '');
        card.addEventListener('click', function() {
            applyTheme(t.id); saveState();
            cardsWrap.querySelectorAll('.mob-theme-card').forEach(function(c) {
                c.classList.remove('active');
                c.style.borderColor = 'transparent';
                var al = c.querySelector('.mob-tc-active');
                if (al) al.remove();
            });
            card.classList.add('active');
            card.style.borderColor = t.accentColor;
            var al = document.createElement('span');
            al.className = 'mob-tc-active';
            al.style.cssText = 'background:' + t.accentColor + ';color:' + t.bg;
            al.textContent = 'Active';
            card.appendChild(al);
        });
        cardsWrap.appendChild(card);
    });
    body.appendChild(cardsWrap);

    // Font size sliders (per spec2.png — also shown in Theme tab)
    var fontSection = document.createElement('div');
    fontSection.className = 'mob-settings-section';
    var fontLbl = document.createElement('div');
    fontLbl.className = 'mob-settings-lbl';
    fontLbl.textContent = 'Font size';
    fontSection.appendChild(fontLbl);
    [
        { label: 'Arabic',       id: 'arabicFontSlider' },
        { label: 'Translation',  id: 'transFontSlider' }
    ].forEach(function(cfg) {
        var src = document.getElementById(cfg.id);
        var row = document.createElement('div');
        row.className = 'mob-slider-row';
        var lbl = document.createElement('span');
        lbl.className = 'mob-slider-label';
        lbl.textContent = cfg.label;
        var inp = document.createElement('input');
        inp.type = 'range';
        if (src) { inp.min = src.min; inp.max = src.max; inp.step = src.step; inp.value = src.value; }
        inp.style.flex = '1';
        inp.style.accentColor = 'var(--accent)';
        inp.addEventListener('input', function() {
            if (src) { src.value = this.value; src.dispatchEvent(new Event('input')); }
        });
        row.appendChild(lbl);
        row.appendChild(inp);
        fontSection.appendChild(row);
    });
    body.appendChild(fontSection);
}

// ── Share sheet (Group C) ─────────────────────────────────────────
function buildSheetShare(body, title) {
    title.textContent = '📤 Share';

    // Resolve current surah context
    var suraEl   = document.querySelector('.sura');
    var suraId   = suraEl ? parseInt(suraEl.id) : 0;
    var suraName = '';
    if (typeof quranData !== 'undefined') {
        var sData = quranData.find(function(s) { return s.id === String(suraId); });
        suraName = sData ? sData.name : '';
    }

    // Show a preview of the selected verse (or first verse)
    var selVerse = document.querySelector('.verse.verse-selected') || document.querySelector('.verse');
    if (selVerse) {
        var preview = document.createElement('div');
        preview.className = 'mob-share-preview';
        var arabicEl = selVerse.querySelector('.arabic-verse');
        var transEl  = selVerse.querySelector('.translated-verse');
        if (arabicEl) {
            var ar = document.createElement('div');
            ar.className = 'mob-share-preview-arabic';
            ar.dir = 'rtl';
            ar.textContent = arabicEl.textContent.trim();
            preview.appendChild(ar);
        }
        if (transEl) {
            var raw = transEl.textContent.trim();
            var tr = document.createElement('div');
            tr.className = 'mob-share-preview-trans';
            tr.textContent = raw.length > 130 ? raw.substring(0, 130) + '…' : raw;
            preview.appendChild(tr);
        }
        body.appendChild(preview);
    }

    var verseText  = selVerse ? selVerse.textContent.trim().substring(0, 300) : (suraName || document.title);
    var pageUrl    = window.location.href;
    var shareBody  = (suraName ? suraName + '\n\n' : '') + verseText;
    var ytUrl      = (typeof YT_CHANNEL_URL !== 'undefined') ? YT_CHANNEL_URL : '';
    var encodedText = encodeURIComponent(shareBody);
    var encodedUrl  = encodeURIComponent(pageUrl);

    // Social-media section label
    var socLbl = document.createElement('div');
    socLbl.className = 'mob-share-section-lbl';
    socLbl.textContent = 'Share on';
    body.appendChild(socLbl);

    // Social media link buttons (open in new tab)
    var socialActions = [
        { icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>', label: 'WhatsApp', sub: 'Share via WhatsApp', href: 'https://api.whatsapp.com/send?text=' + encodeURIComponent(shareBody + '\n' + pageUrl) },
        { icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.626L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>', label: 'X / Twitter', sub: 'Post on X (Twitter)', href: 'https://twitter.com/intent/tweet?text=' + encodedText + '&url=' + encodedUrl },
        { icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>', label: 'Facebook', sub: 'Share on Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl },
        { icon: '✉️', label: 'Email', sub: 'Share by email', href: 'mailto:?subject=' + encodeURIComponent(suraName || 'Quran') + '&body=' + encodeURIComponent(shareBody + '\n\n' + pageUrl) },
        ...(ytUrl ? [{ icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>', label: 'YouTube', sub: 'Our Quran channel', href: ytUrl }] : []),
    ];
    socialActions.forEach(function(a) {
        var item = document.createElement('a');
        item.className = 'mob-share-item mob-share-social';
        item.href = a.href;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
        item.innerHTML =
            '<span class="mob-share-ico mob-share-ico-svg">' + a.icon + '</span>' +
            '<div class="mob-share-info">' +
                '<div class="mob-share-label">' + a.label + '</div>' +
                '<div class="mob-share-sub">' + a.sub + '</div>' +
            '</div>' +
            '<span class="mob-share-arr">↗</span>';
        item.addEventListener('click', function() { setTimeout(closeMobileSheet, 300); });
        body.appendChild(item);
    });

    // Utility actions (copy)
    var actions = [
        { icon: '🔗', label: 'Copy link', sub: 'Direct link to this surah', fn: function() {
            var url = window.location.href;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(function() {
                    if (typeof showToast === 'function') showToast('🔗 Link copied!');
                }).catch(function() {
                    if (typeof showToast === 'function') showToast('Could not copy');
                });
            }
        }},
        { icon: '📋', label: 'Copy text', sub: 'Copy verse to clipboard', fn: function() {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(verseText).then(function() {
                    if (typeof showToast === 'function') showToast('📋 Text copied!');
                }).catch(function() {
                    if (typeof showToast === 'function') showToast('Could not copy');
                });
            }
        }}
    ];

    actions.forEach(function(a) {
        var item = document.createElement('button');
        item.className = 'mob-share-item';
        item.innerHTML =
            '<span class="mob-share-ico">' + a.icon + '</span>' +
            '<div class="mob-share-info">' +
                '<div class="mob-share-label">' + a.label + '</div>' +
                '<div class="mob-share-sub">' + a.sub + '</div>' +
            '</div>';
        item.addEventListener('click', function() {
            a.fn();
            setTimeout(closeMobileSheet, 50);
        });
        body.appendChild(item);
    });
}

// ── Mobile left drawer (Group E) ──────────────────────────────────
function openMobileDrawer() {
    // Always dismiss the bottom sheet first — otherwise it reappears when drawer closes
    closeMobileSheet();

    var drawer  = document.getElementById('mobileDrawer');
    var overlay = document.getElementById('mobileDrawerOverlay');
    if (!drawer || !overlay) return;

    // Mark active language
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    drawer.querySelectorAll('.mob-drawer-lang').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Date display (gregorian + hijri) — tapping opens Hijri calendar
    var datesEl = document.getElementById('mobileDrawerDates');
    if (datesEl) {
        var gregEl  = document.querySelector('#hijriMonth .date-gregorian');
        var hijriEl = document.querySelector('#hijriMonth .date-hijri');
        var gregText  = (gregEl  && gregEl.textContent.trim())  ? gregEl.textContent.trim()  : new Date().toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        var hijriText = (hijriEl && hijriEl.textContent.trim()) ? hijriEl.textContent.trim() : '';
        datesEl.innerHTML =
            '<div class="mob-drawer-date-greg">'  + gregText  + '</div>' +
            (hijriText ? '<div class="mob-drawer-date-hijri-line">' + hijriText + '</div>' : '') +
            '<div class="mob-drawer-date-hint">📆 Islamic Calendar ›</div>';
    }

    // Khatm / reading progress
    var khatmEl = document.getElementById('mobileDrawerKhatm');
    if (khatmEl) {
        try {
            var history = JSON.parse(localStorage.getItem('quranReadHistory') || '{}');
            var readCount = Object.keys(history).length;
            if (readCount > 0) {
                var pct = Math.round(readCount / 114 * 100);
                khatmEl.innerHTML =
                    '<div class="mob-drawer-prog-label">Surahs read: ' + readCount + ' / 114</div>' +
                    '<div class="mob-drawer-prog-bar"><div class="mob-drawer-prog-fill" style="width:' + pct + '%"></div></div>';
            } else {
                khatmEl.innerHTML = '';
            }
        } catch(e) { khatmEl.innerHTML = ''; }
    }

    drawer.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileDrawer() {
    var drawer  = document.getElementById('mobileDrawer');
    var overlay = document.getElementById('mobileDrawerOverlay');
    if (drawer)  drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ── Settings sheet ────────────────────────────────────────────────
function buildSheetSettings(body, title) {
    var t = uiTranslations[currentLanguage] || uiTranslations.english;
    title.textContent = t.settingsTitle;

    // v10.3: Meditation banner — frontispiece quote from Surah Muhammad (47:24)
    var med = document.createElement('div');
    med.className = 'settings-meditation';
    // Translation in current primary language (default: French)
    var medTranslations = {
        french:  "Ne méditent-ils donc pas sur le Coran ? Ou y a-t-il des cadenas sur leurs cœurs ?",
        english: "Then do they not reflect upon the Quran, or are there locks upon their hearts?",
        spanish: "¿Es que no meditan en el Corán? ¿O es que hay candados en sus corazones?",
        arabic:  "أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ أَمْ عَلَىٰ قُلُوبٍ أَقْفَالُهَا"
    };
    var lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'french';
    // v10.11: Collect primary + additional non-Arabic translations
    var translationsToShow = [];
    if (lang !== 'arabic' && medTranslations[lang]) translationsToShow.push(medTranslations[lang]);
    if (typeof additionalLanguages !== 'undefined' && additionalLanguages.length) {
        additionalLanguages.forEach(function(code) {
            if (code === 'arabic') return;
            if (code === lang) return;
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

    // Theme section
    var themeSection = document.createElement('div');
    themeSection.className = 'mob-settings-section';
    var themeLbl = document.createElement('div'); themeLbl.className = 'mob-settings-lbl'; themeLbl.textContent = 'Theme';
    var chips = document.createElement('div'); chips.className = 'mob-theme-chips';
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'manuscript';
    // v10: Familiar word + visual swatch + aesthetic name
    var themeData = [
        { id: 'manuscript', primary: '🌙 Sepia', aesthetic: 'Manuscript' },
        { id: 'minimal',    primary: '☀️ Light', aesthetic: 'Minimal' },
        { id: 'scholar',    primary: '🌑 Dark',  aesthetic: 'Scholar' }
    ];
    themeData.forEach(function(t) {
        var chip = document.createElement('button');
        chip.className = 'mob-theme-chip' + (currentTheme === t.id ? ' active' : '');
        chip.innerHTML =
            '<span class="mob-theme-primary">' + t.primary + '</span>' +
            '<span class="mob-theme-aesthetic">' + t.aesthetic + '</span>';
        chip.addEventListener('click', function() {
            applyTheme(t.id); saveState();
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
    var langLbl = document.createElement('div'); langLbl.className = 'mob-settings-lbl'; langLbl.textContent = t.langQuranLabel;
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

    // Font size section
    var fontSection = document.createElement('div');
    fontSection.className = 'mob-settings-section';
    var fontLbl = document.createElement('div'); fontLbl.className = 'mob-settings-lbl'; fontLbl.textContent = t.settingsFontSize;
    fontSection.appendChild(fontLbl);
    [
        { label: t.settingsVerseLabel, id:'arabicFontSlider', valId:'arabicFontVal', min:1.2, max:5, step:0.1 },
        { label: t.settingsTranslLabel, id:'transFontSlider',  valId:'transFontVal',  min:0.7, max:3, step:0.05 }
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
    // v10.11: fontSection appended AFTER translation section (see below)

    // Add translation language section
    var transSection = document.createElement('div');
    transSection.className = 'mob-settings-section';
    var transLbl = document.createElement('div'); transLbl.className = 'mob-settings-lbl'; transLbl.textContent = t.settingsAddTransl;
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
        var placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = t.settingsAddLangPh; addSel.appendChild(placeholder);
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
    // Group Language + Translation + Font size into one visual block
    var displayGroup = document.createElement('div');
    displayGroup.className = 'settings-display-group';
    var displayGroupLbl = document.createElement('div');
    displayGroupLbl.className = 'mob-settings-lbl';
    var displayLblSpan = document.createElement('span');
    displayLblSpan.textContent = '🖋 Language & Display';
    displayGroupLbl.appendChild(displayLblSpan);
    if (typeof HELP_VIDEOS !== 'undefined' && HELP_VIDEOS.display) {
        var displayHelpBtn = document.createElement('button');
        displayHelpBtn.className = 'section-help-btn';
        displayHelpBtn.title = 'Watch tutorial on YouTube';
        displayHelpBtn.textContent = 'ℹ️';
        displayHelpBtn.addEventListener('click', function(e) { e.stopPropagation(); window.open(HELP_VIDEOS.display, '_blank'); });
        displayGroupLbl.appendChild(displayHelpBtn);
    }
    displayGroup.appendChild(displayGroupLbl);
    var displayGroupInner = document.createElement('div');
    displayGroupInner.className = 'settings-display-group-inner';
    displayGroupInner.appendChild(langSection);
    displayGroupInner.appendChild(transSection);
    displayGroupInner.appendChild(fontSection);
    displayGroup.appendChild(displayGroupInner);
    body.appendChild(displayGroup);

    // Version footer
    var verEl = document.createElement('div');
    verEl.className = 'mob-settings-version';
    verEl.textContent = 'Quran Display v10.18';
    body.appendChild(verEl);
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
    if (window.innerWidth <= 767) {
        // v10.13 phone redesign: burger opens left drawer instead of settings sheet
        openMobileDrawer();
    } else if (isMobile()) {
        // Tablet (768–900px): keep settings sheet behavior
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

// ── Phone drawer event wiring ────────────────────────────────────
(function() {
    var closeBtn = document.getElementById('mobileDrawerClose');
    var overlay  = document.getElementById('mobileDrawerOverlay');
    if (closeBtn) closeBtn.addEventListener('click', closeMobileDrawer);
    if (overlay)  overlay.addEventListener('click', closeMobileDrawer);

    // ── Quran Journey ──
    var khatmBtn = document.getElementById('mdKhatmBtn');
    if (khatmBtn) khatmBtn.addEventListener('click', function() {
        closeMobileDrawer();
        if (typeof openKhatmModal === 'function') openKhatmModal();
    });

    var readingPlanBtn = document.getElementById('mdReadingPlanBtn');
    if (readingPlanBtn) readingPlanBtn.addEventListener('click', function() {
        closeMobileDrawer();
        if (typeof openReadingPlanModal === 'function') openReadingPlanModal();
    });

    var readingTimeBtn = document.getElementById('mdReadingTimeBtn');
    if (readingTimeBtn) readingTimeBtn.addEventListener('click', function() {
        closeMobileDrawer();
        openReadingTimeScreen(); // reopens drawer in its own close handler
    });

    var surahContextBtn = document.getElementById('mdSurahContextBtn');
    if (surahContextBtn) surahContextBtn.addEventListener('click', function() {
        closeMobileDrawer();
        var btn = document.getElementById('context');
        if (btn) btn.click();
    });

    // ── Daily Content ──
    var dailyVerseBtn = document.getElementById('mdDailyVerseBtn');
    if (dailyVerseBtn) dailyVerseBtn.addEventListener('click', function() {
        closeMobileDrawer();
        if (typeof showDailyVerseNow === 'function') showDailyVerseNow();
    });

    var reflectionBtn = document.getElementById('mdReflectionBtn');
    if (reflectionBtn) reflectionBtn.addEventListener('click', function() {
        closeMobileDrawer();
        var suraEl = document.querySelector('.sura');
        var suraId = suraEl ? suraEl.id : '0';
        if (typeof openReflectionModal === 'function') openReflectionModal(suraId);
    });

    // ── Date header → open Hijri calendar ──
    var datesClickEl = document.getElementById('mobileDrawerDates');
    if (datesClickEl && !datesClickEl._hijriWired) {
        datesClickEl._hijriWired = true;
        datesClickEl.addEventListener('click', function() {
            closeMobileDrawer();
            setTimeout(openHijriCalendarScreen, 80);
        });
    }

    // ── Support ──
    var helpBtn = document.getElementById('mdHelpBtn');
    if (helpBtn) helpBtn.addEventListener('click', function() {
        closeMobileDrawer();
        if (typeof openHelpModal === 'function') openHelpModal();
        else openHelpScreen();
    });

    var feedbackBtn = document.getElementById('mdFeedbackBtn');
    if (feedbackBtn) feedbackBtn.addEventListener('click', function() {
        closeMobileDrawer();
        window.open('mailto:contact@amcreatives.ca?subject=Quran%20App%20Feedback&body=Version%3A%20v10.18.0%0A%0A', '_blank');
        // Reopen drawer after mail client is opened (slight delay for UX)
        setTimeout(openMobileDrawer, 600);
    });

    // ── Language ──
    var langBtns = document.querySelectorAll('.mob-drawer-lang');
    langBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var langCode = btn.getAttribute('data-lang');
            var sel = document.getElementById('languageSelector');
            if (sel) {
                sel.value = langCode;
                sel.dispatchEvent(new Event('change'));
            }
            langBtns.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            closeMobileDrawer();
        });
    });
}());

// ── Reading Time screen ───────────────────────────────────────────
function openReadingTimeScreen() {
    if (typeof flushReadingTimer === 'function') flushReadingTimer();

    var s = (typeof getReadingTimeSummary === 'function') ? getReadingTimeSummary() : { thisWeek: 0, avg4w: 0 };
    var fmt = (typeof fmtTime === 'function') ? fmtTime : function(m){ return Math.round(m) + ''; };
    var history = {};
    try { history = JSON.parse(localStorage.getItem('quranReadHistory') || '{}'); } catch(e) {}
    var surahsRead = Object.keys(history).length;

    var overlay = document.createElement('div');
    overlay.className = 'mob-info-overlay';
    overlay.innerHTML =
        '<div class="mob-info-box">' +
            '<div class="mob-info-header">' +
                '<span class="mob-info-title">⏱ Reading Time</span>' +
                '<button class="mob-info-close">✕</button>' +
            '</div>' +
            '<div class="mob-info-body">' +
                '<div class="mob-stat-row"><div class="mob-stat-val">' + fmt(s.thisWeek) + '</div><div class="mob-stat-lbl">This week (hh:mm)</div></div>' +
                '<div class="mob-stat-row"><div class="mob-stat-val">' + fmt(s.avg4w) + '<span class="mob-stat-unit">/week</span></div><div class="mob-stat-lbl">4-week average</div></div>' +
                '<div class="mob-stat-row"><div class="mob-stat-val">' + surahsRead + '<span class="mob-stat-unit"> / 114</span></div><div class="mob-stat-lbl">Surahs read</div></div>' +
            '</div>' +
            '<div style="padding:0 20px 16px;">' +
                '<button id="rtResetBtn" style="width:100%;padding:10px;background:#d9707018;border:1px solid #d9707040;color:#e08585;border-radius:8px;font-size:13px;cursor:pointer;">🗑 Reset reading stats</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });

    overlay.querySelector('#rtResetBtn').addEventListener('click', function() {
        if (!confirm('Reset all reading time and surah history?')) return;
        try { localStorage.removeItem('quranReadingTime'); } catch(e) {}
        try { localStorage.removeItem('quranReadHistory'); } catch(e) {}
        if (typeof showToast === 'function') showToast('Reading stats reset');
        overlay.classList.remove('show');
        setTimeout(function() {
            if (overlay.parentNode) overlay.remove();
            openReadingTimeScreen();
        }, 280);
    });

    function closeScreen() {
        overlay.classList.remove('show');
        setTimeout(function() {
            if (overlay.parentNode) overlay.remove();
            openMobileDrawer();
        }, 280);
    }
    overlay.querySelector('.mob-info-close').addEventListener('click', closeScreen);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeScreen(); });
}

// ── Shared Islamic event list ─────────────────────────────────────
var HIJRI_KEY_EVENTS = [
    { month: 1,  day: 1,  name: 'Islamic New Year',        icon: '🌙' },
    { month: 1,  day: 10, name: 'Day of Ashura',           icon: '🕯' },
    { month: 3,  day: 12, name: 'Mawlid an-Nabi',          icon: '✦'  },
    { month: 7,  day: 27, name: "Laylat al-Mi'raj",        icon: '✦'  },
    { month: 8,  day: 15, name: "Laylat al-Bara'ah",       icon: '✦'  },
    { month: 9,  day: 1,  name: 'First day of Ramadan',    icon: '🌙' },
    { month: 9,  day: 27, name: 'Laylat al-Qadr',          icon: '⭐' },
    { month: 10, day: 1,  name: 'Eid al-Fitr',             icon: '🎉' },
    { month: 12, day: 9,  name: 'Day of Arafah',           icon: '⛰' },
    { month: 12, day: 10, name: 'Eid al-Adha',             icon: '🎉' }
];

// ── Sanitize Eastern Arabic numerals → Western (1,2,3) ───────────
function westernDigits(str) {
    return String(str).replace(/[٠-٩]/g, function(c) {
        return String(c.charCodeAt(0) - 0x0660);
    });
}

// ── Find Gregorian date matching a Hijri date (searches forward from today) ──
function hijriEventGregorian(hYear, hMonth, hDay) {
    if (typeof gregorianToHijri !== 'function') return null;
    var base = new Date();
    base.setDate(base.getDate() - 2);
    for (var i = 0; i < 420; i++) {
        var d = new Date(base);
        d.setDate(d.getDate() + i);
        var h = gregorianToHijri(d);
        if (h.year === hYear && h.month === hMonth && h.day === hDay) return d;
    }
    return null;
}

// ── Build Islamic Calendar content (shared by phone + desktop) ────
function buildHijriCalendarHTML() {
    var now = new Date();
    var todayH = (typeof getTodayHijri === 'function') ? getTodayHijri() : null;
    var hijriMonthNames = (typeof HIJRI_MONTHS !== 'undefined') ? HIJRI_MONTHS :
        ['Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Awwal','Jumada al-Thani',
         'Rajab','Shaban','Ramadan','Shawwal','Dhu al-Qadah','Dhu al-Hijjah'];

    var AR = ['مُحَرَّم','صَفَر','رَبِيعُ الْأَوَّل','رَبِيعُ الثَّانِي','جُمَادَى الْأُولَى',
              'جُمَادَى الثَّانِيَة','رَجَب','شَعْبَان','رَمَضَان','شَوَّال','ذُو الْقَعْدَة','ذُو الْحِجَّة'];

    // Line 1 — Arabic-script Hijri, Western numerals guaranteed
    var arabicHijriText = '';
    if (todayH) {
        arabicHijriText = westernDigits(todayH.day) + ' ' + AR[todayH.month - 1] + ' ' + westernDigits(todayH.year) + ' هـ';
    }

    // Line 2 — Gregorian in second/additional language
    var langLocaleMap = { arabic: 'ar-SA', french: 'fr-FR', english: 'en-GB', spanish: 'es-ES' };
    var primaryLang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'english';
    var addLangs = (typeof additionalLanguages !== 'undefined') ? additionalLanguages : [];
    var gregOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    var secondLang = addLangs.find(function(l) { return l !== primaryLang; });
    if (!secondLang) secondLang = (primaryLang !== 'english') ? 'english' : 'french';
    var secondLocale = langLocaleMap[secondLang] || 'en-GB';
    var gregText2 = '';
    try { gregText2 = westernDigits(now.toLocaleDateString(secondLocale, gregOpts)); }
    catch(e) { try { gregText2 = westernDigits(now.toLocaleDateString('en-GB', gregOpts)); } catch(e2) {} }

    // Upcoming events — Arabic Hijri date + Gregorian in second language
    var eventsHtml = '';
    if (todayH) {
        var upcoming = HIJRI_KEY_EVENTS.filter(function(e) {
            return e.month > todayH.month || (e.month === todayH.month && e.day >= todayH.day);
        });
        var eventYear = todayH.year;
        if (upcoming.length === 0) { upcoming = HIJRI_KEY_EVENTS; eventYear = todayH.year + 1; }
        upcoming.slice(0, 7).forEach(function(e) {
            var isToday = (e.month === todayH.month && e.day === todayH.day);
            var arDate = westernDigits(e.day) + ' ' + AR[e.month - 1] + ' ' + westernDigits(eventYear) + ' هـ';
            var gDate = hijriEventGregorian(eventYear, e.month, e.day);
            var latDate = '';
            if (gDate) {
                try { latDate = westernDigits(gDate.toLocaleDateString(secondLocale, gregOpts)); }
                catch(ex) { try { latDate = westernDigits(gDate.toLocaleDateString('en-GB', gregOpts)); } catch(ex2) {} }
            }
            if (!latDate) latDate = westernDigits(e.day) + ' ' + hijriMonthNames[e.month - 1] + ' ' + westernDigits(eventYear) + ' AH';
            eventsHtml +=
                '<div class="mob-hijri-event' + (isToday ? ' mob-hijri-event-today' : '') + '">' +
                    '<span class="mob-hijri-event-ico">' + e.icon + '</span>' +
                    '<div class="mob-hijri-event-info">' +
                        '<div class="mob-hijri-event-name">' + e.name + '</div>' +
                        '<div class="mob-hijri-event-date-ar">' + arDate + '</div>' +
                        '<div class="mob-hijri-event-date">' + latDate + '</div>' +
                    '</div>' +
                    (isToday ? '<span class="mob-hijri-today-badge">Today</span>' : '') +
                '</div>';
        });
    }

    return {
        todayCard:
            '<div class="mob-hijri-today-card">' +
                (arabicHijriText ? '<div class="mob-hijri-date-arabic">' + arabicHijriText + '</div>' : '') +
                (gregText2       ? '<div class="mob-hijri-date-second">'  + gregText2       + '</div>' : '') +
            '</div>',
        eventsHtml: eventsHtml
    };
}

// ── Phone: Hijri Calendar bottom-sheet ───────────────────────────
function openHijriCalendarScreen() {
    var data = buildHijriCalendarHTML();
    var overlay = document.createElement('div');
    overlay.className = 'mob-info-overlay';
    overlay.innerHTML =
        '<div class="mob-info-box">' +
            '<div class="mob-info-header">' +
                '<span class="mob-info-title">📆 Islamic Calendar</span>' +
                '<button class="mob-info-close">✕</button>' +
            '</div>' +
            '<div class="mob-hijri-scroll">' +
                data.todayCard +
                '<div class="mob-hijri-events-label">Upcoming Events</div>' +
                '<div class="mob-hijri-events-list">' + data.eventsHtml + '</div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    void overlay.offsetHeight;
    overlay.classList.add('show');
    var closeBtn = overlay.querySelector('.mob-info-close');
    function closeScreen() {
        overlay.classList.remove('show');
        setTimeout(function() {
            if (overlay.parentNode) overlay.remove();
            openMobileDrawer();
        }, 280);
    }
    if (closeBtn) closeBtn.addEventListener('click', closeScreen);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeScreen(); });
}

// ── Desktop: Hijri Calendar centered modal ────────────────────────
function openHijriCalendarDesktop() {
    var existing = document.getElementById('hijriDesktopModal');
    if (existing) { existing.remove(); return; }
    var data = buildHijriCalendarHTML();
    var overlay = document.createElement('div');
    overlay.id = 'hijriDesktopModal';
    overlay.className = 'hijri-desktop-overlay';
    overlay.innerHTML =
        '<div class="hijri-desktop-box">' +
            '<div class="hijri-desktop-header">' +
                '<span class="hijri-desktop-title">📆 Islamic Calendar</span>' +
                '<button class="hijri-desktop-close">✕</button>' +
            '</div>' +
            '<div class="hijri-desktop-body">' +
                data.todayCard +
                '<div class="mob-hijri-events-label">Upcoming Events</div>' +
                '<div class="mob-hijri-events-list">' + data.eventsHtml + '</div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    void overlay.offsetHeight;
    overlay.classList.add('show');
    function close() {
        overlay.classList.remove('show');
        setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 280);
    }
    overlay.querySelector('.hijri-desktop-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
}

// ── #hijriMonth click → open desktop calendar ─────────────────────
(function wireHijriMonthClick() {
    function attach() {
        var el = document.getElementById('hijriMonth');
        if (!el || el._hijriWired) return;
        el._hijriWired = true;
        el.style.cursor = 'pointer';
        el.title = 'Open Islamic Calendar';
        el.addEventListener('click', function() {
            if (window.innerWidth > 767) openHijriCalendarDesktop();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
}());

// ── 24-hour Islamic event alert ───────────────────────────────────
function checkHijriEventAlert() {
    if (typeof getTodayHijri !== 'function' || typeof gregorianToHijri !== 'function') return;
    var todayH    = getTodayHijri();
    var tomorrow  = new Date(Date.now() + 24 * 60 * 60 * 1000);
    var tomorrowH = gregorianToHijri(tomorrow);

    var todayEvent = null, tomorrowEvent = null;
    HIJRI_KEY_EVENTS.forEach(function(e) {
        if (e.month === todayH.month    && e.day === todayH.day)    todayEvent    = e;
        if (e.month === tomorrowH.month && e.day === tomorrowH.day) tomorrowEvent = e;
    });

    var alertEvent = todayEvent || tomorrowEvent;
    if (!alertEvent) return;

    // Only show once per calendar day
    var todayStr = new Date().toDateString();
    var lastShown = '';
    try { lastShown = localStorage.getItem('quranHijriAlertDate') || ''; } catch(e) {}
    if (lastShown === todayStr) return;
    try { localStorage.setItem('quranHijriAlertDate', todayStr); } catch(e) {}

    showHijriEventPopup(alertEvent, todayEvent ? 'today' : 'tomorrow', todayH);
}

function showHijriEventPopup(event, timing, todayH) {
    var hijriMonthNames = (typeof HIJRI_MONTHS !== 'undefined') ? HIJRI_MONTHS :
        ['Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Awwal','Jumada al-Thani',
         'Rajab','Shaban','Ramadan','Shawwal','Dhu al-Qadah','Dhu al-Hijjah'];
    var dateStr = event.day + ' ' + hijriMonthNames[event.month - 1] + (todayH ? ' ' + todayH.year + ' AH' : '');
    var timingLabel = timing === 'today' ? '🌟 Today' : '⏳ Tomorrow';

    var overlay = document.createElement('div');
    overlay.className = 'hijri-alert-overlay';
    overlay.innerHTML =
        '<div class="hijri-alert-box">' +
            '<div class="hijri-alert-timing">' + timingLabel + '</div>' +
            '<div class="hijri-alert-icon">' + event.icon + '</div>' +
            '<div class="hijri-alert-name">' + event.name + '</div>' +
            '<div class="hijri-alert-date">' + dateStr + '</div>' +
            '<button class="hijri-alert-close">Close</button>' +
        '</div>';
    document.body.appendChild(overlay);
    void overlay.offsetHeight;
    overlay.classList.add('show');
    function dismiss() {
        overlay.classList.remove('show');
        setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 300);
    }
    overlay.querySelector('.hijri-alert-close').addEventListener('click', dismiss);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) dismiss(); });
}

// ── Help screen ───────────────────────────────────────────────────
function openHelpScreen() {
    var overlay = document.createElement('div');
    overlay.className = 'mob-info-overlay';
    overlay.innerHTML =
        '<div class="mob-info-box">' +
            '<div class="mob-info-header">' +
                '<span class="mob-info-title">❓ Help &amp; Tutorial</span>' +
                '<button class="mob-info-close">✕</button>' +
            '</div>' +
            '<div class="mob-info-body mob-help-body">' +
                '<div class="mob-help-item"><span class="mob-help-ico">📖</span><div><b>Read</b> — Browse Surahs, Juz, Revelation order, or Topics</div></div>' +
                '<div class="mob-help-item"><span class="mob-help-ico">🔖</span><div><b>Bookmark</b> — Your saved verses, notes, highlights &amp; reflections</div></div>' +
                '<div class="mob-help-item"><span class="mob-help-ico">🔍</span><div><b>Search</b> — Find any verse across the full Quran</div></div>' +
                '<div class="mob-help-item"><span class="mob-help-ico">📤</span><div><b>Share</b> — Share or copy any selected verse</div></div>' +
                '<div class="mob-help-item"><span class="mob-help-ico">☰</span><div><b>Menu</b> — Track your journey, daily content &amp; language</div></div>' +
                '<div class="mob-help-item"><span class="mob-help-ico">⚙️</span><div><b>Settings</b> — Theme, font, audio, and all features</div></div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });
    function closeScreen() {
        overlay.classList.remove('show');
        setTimeout(function() {
            if (overlay.parentNode) overlay.remove();
            openMobileDrawer();
        }, 280);
    }
    overlay.querySelector('.mob-info-close').addEventListener('click', closeScreen);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeScreen(); });
}

// ── Phone settings button (top-right header icon, ≤767px) ────────
// Uses the mobile sheet (features-modal-overlay is CSS-blocked on ≤900px)
(function() {
    var btn = document.getElementById('phoneSettingsBtn');
    if (btn) btn.addEventListener('click', function() {
        openMobileSheet('settings');
    });
}());

// ── Phone verse tap highlight (Group F) ──────────────────────────
document.addEventListener('click', function(e) {
    if (window.innerWidth > 767) return;
    if (e.target.closest('.verse-action-btn') || e.target.closest('.verse-actions')) return;
    var verse = e.target.closest('.verse');
    if (!verse) return;
    var wasSelected = verse.classList.contains('verse-selected');
    document.querySelectorAll('.verse.verse-selected').forEach(function(v) {
        v.classList.remove('verse-selected');
    });
    if (!wasSelected) verse.classList.add('verse-selected');
});

// ── Phone reading progress bar (Group F) ─────────────────────────
function updateSurahProgressBar() {
    if (window.innerWidth > 767) return;
    var fill = document.getElementById('surahProgressFill');
    if (!fill) return;
    var container = document.getElementById('quranContainer');
    if (!container) return;
    var scrollTop = container.scrollTop;
    var scrollHeight = container.scrollHeight - container.clientHeight;
    var pct = scrollHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100)) : 0;
    fill.style.width = pct + '%';
}
(function() {
    var qc = document.getElementById('quranContainer');
    if (qc) qc.addEventListener('scroll', updateSurahProgressBar, { passive: true });
}());

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

// v10.11: Same mobile wrapper for surah-only search results
var _origDisplaySearchResultsForSourat = displaySearchResultsForSourat;
displaySearchResultsForSourat = function(verses, sura, word) {
    _origDisplaySearchResultsForSourat(verses, sura, word);
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
    // v9.12: Re-applies zoom as a defensive measure after every wrap
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
        // v9.12: Defensively re-assert the saved zoom value on the root
        // in case anything cleared it
        var savedZ = parseFloat(localStorage.getItem(ZOOM_KEY)) || 1;
        if (savedZ !== 1) {
            document.documentElement.style.setProperty('--reading-zoom', savedZ);
        }
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

    var lastTap = 0;
    document.addEventListener('touchend', function(e) {
        if (pinchActive && e.touches.length < 2) {
            pinchActive = false;
            // v9.12: After a pinch, reset lastTap so the next single-tap
            // doesn't trigger an accidental double-tap zoom reset
            lastTap = 0;
        }
    });

    document.addEventListener('touchcancel', function() {
        pinchActive = false;
        lastTap = 0;
    });

    // Double-tap to reset zoom
    document.addEventListener('touchend', function(e) {
        if (!isInsideReading(e.target)) return;
        if (e.changedTouches.length !== 1) return;
        // v9.12: Don't count taps during/right after a multi-touch
        if (pinchActive) return;
        if (e.touches.length > 0) return; // still touching with another finger
        var now = Date.now();
        if (lastTap > 0 && now - lastTap < 300) {
            // Double-tap — reset zoom to 1
            var current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-zoom')) || 1;
            if (current !== 1) {
                setZoom(1);
                showIndicator(1);
                e.preventDefault();
            }
            lastTap = 0; // consume
        } else {
            lastTap = now;
        }
    });

    // Initial wrap on page load
    setTimeout(wrapReadingContent, 200);
}());
