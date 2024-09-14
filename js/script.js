
let quranData = [];
let currentLanguage = 'arabic'; // Default language
let currentLanguageAdditionnal = '';

let Arabic = false;
let contextSwitch = true;

const HijryMonths = [ "Muḥarram (مُحَرَّم)", "Ṣafar (صَفَر)", "Rabīʿ al-Awwal ( رَبِيع ٱلْأَوَّل )", "Rabīʿ ath-Thānī ( رَبِيع ٱلثَّانِي )", "Jumādá al-Awwal ( جُمَادَىٰ ٱلْأَوَّل)", "Jumādá ath-Thānī ( جُمَادَىٰ ٱلثَّانِي)", "Rajab (رَجَب)", "Shaʿbān (شَعْبَان)", "Ramaḍān (رَمَضَان)", "Shawwāl (شَوَّال)", "Dhū al-Qaʿdah (  ذُو ٱلْقَعْدَة)", "Dhū al-Ḥijjah (  ذُو ٱلْحِجَّة)"];

const suraId = document.getElementById('quran-container').firstChild.id;


// Function to load Quran data
function loadQuranData() {

    // erase context befor loading the sura
    const suraContext = document.getElementById('sura-content');
    suraContext.classList.replace("sura-contexte", "eraseDiv");

    const xmlFile = `data/quran-${currentLanguage}.xml`; // Adjust file path based on language

    if(currentLanguage == 'arabic')
    {
        Arabic = true;
    }

    const currentDisplayedSura = document.getElementById('quran-container');

    if(currentDisplayedSura.textContent.trim().length > 0){ //if a sura already exists, so display it with the selecetd currentLanguage, rather than display fatiha all the time

        const orgSurah = document.querySelector('.sura');
        const desSurahIndexString = orgSurah.getAttribute('id');
        const desSurahIndex = +desSurahIndexString;

        return fetch(xmlFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(xmlString => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            const surahs = xmlDoc.getElementsByTagName("sura");
            quranData = Array.from(surahs).map((sura, index) => {
                const suraName = sura.getAttribute("name");
                const city = sura.getAttribute("city"); // Get the city attribute
                const verses = Array.from(sura.getElementsByTagName("aya")).map(verse => ({
                    number: verse.getAttribute("index"),
                    text: verse.getAttribute("text")
                }));
                return { id: `${index}`, name: suraName, verses, city: city };
            });

            // Generate the TOC after loading Quran data
            generateTOC();

            displaySingleSura(desSurahIndex);

            // Show or hide arabic-specific options
            document.getElementById('arabic-options').style.display = (currentLanguage === 'arabic') ? 'block' : 'none';
        })
        .catch(error => {
            console.error("Error fetching XML file:", error);
        });
    }
    else{ // Display Fatiha by default and in arabic as a default language
        return fetch(xmlFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(xmlString => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            const surahs = xmlDoc.getElementsByTagName("sura");
            quranData = Array.from(surahs).map((sura, index) => {
                const suraName = sura.getAttribute("name");
                const city = sura.getAttribute("city"); // Get the city attribute
                const verses = Array.from(sura.getElementsByTagName("aya")).map(verse => ({
                    number: verse.getAttribute("index"),
                    text: verse.getAttribute("text")
                }));
                return { id: `${index}`, name: suraName, verses, city: city };
            });

            // Generate the TOC after loading Quran data
            generateTOC();

            // Optionally, display the first Surah by default
            displaySingleSura('0');
            
            // Show or hide arabic-specific options
            document.getElementById('arabic-options').style.display = (currentLanguage === 'arabic') ? 'block' : 'none';
        })
        .catch(error => {
            console.error("Error fetching XML file:", error);
        });
    }

}

function loadRevelationOrderQuranData() {
    const xmlFile = `data/quran-${currentLanguage}.xml`; // Adjust file path based on language

    return fetch(xmlFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(xmlString => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "application/xml");

            const surahs = xmlDoc.getElementsByTagName("sura");
            quranData = Array.from(surahs).map((sura, index) => {
                const suraName = sura.getAttribute("name");
                const city = sura.getAttribute("city"); // Get the city attribute
                const verses = Array.from(sura.getElementsByTagName("aya")).map(verse => ({
                    number: verse.getAttribute("index"),
                    text: verse.getAttribute("text")
                }));
                return { id: `${index}`, name: suraName, verses, city: city };
            });

            // Generate the TOC after loading Quran data
            generateRevelationTOC();

            // Optionally, display the first Surah by default
            // displaySingleSura('0');
            
            // Show or hide arabic-specific options
            document.getElementById('arabic-options').style.display = (currentLanguage === 'arabic') ? 'block' : 'none';
        })
        .catch(error => {
            console.error("Error fetching XML file:", error);
        });
}

// Function to load Surah data of another language
function loadSurahData() {
    const xmlFile = `data/quran-${currentLanguageAdditionnal}.xml`; // Adjust file path based on language

    return fetch(xmlFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(xmlString => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "application/xml");

            const surahs = xmlDoc.getElementsByTagName("sura");
            secondQuranData = Array.from(surahs).map((sura, index) => {
                const suraName = sura.getAttribute("name");
                const city = sura.getAttribute("city"); // Get the city attribute
                const verses = Array.from(sura.getElementsByTagName("aya")).map(verse => ({
                    number: verse.getAttribute("index"),
                    text: verse.getAttribute("text")
                }));
                return { id: `${index}`, name: suraName, verses, city: city };
            });

            const orgSurah = document.querySelector('.sura');
            const desSurahIndexString = orgSurah.getAttribute('id');
            const desSurahIndex = +desSurahIndexString;

            // Optionally, display the first Surah by default
            displaySecondLnleSura(desSurahIndex);
            
        })
        .catch(error => {
            console.error("Error fetching XML file:", error);
        });
}

// Function to ignore diacritics
function removeDiacritics(text) {
    const diacriticRegex = /[\u064B-\u0652]/g;
    Text = text.replace(diacriticRegex, '');
    return Text;
}

// Function to generate Table of Contents (TOC)
function generateTOC() {
    const tocContainer = document.getElementById('toc-container');
    tocContainer.innerHTML = ''; // Clear any existing content

     // Define the icon mapping for cities
    const iconMapping = {
    Makkah: '/img/makkah-icon.png',
    Madinah: '/img/madinah-icon.png',
    };
  
    quranData.forEach((sura, index) => {
        const tocItem = document.createElement('div');
        tocItem.classList.add('toc-item');

        // Create the icon element
        const icon = document.createElement('img');
        icon.src = iconMapping[sura.city];
        icon.alt = `${sura.city} icon`;
        icon.classList.add('city-icon');

        // Set the text content for the TOC item
        tocItem.textContent = `${index + 1}. ${sura.name}`;

        // Append the icon and text to the tocItem
        tocItem.appendChild(icon);

        // Set the target surah ID
        tocItem.dataset.target = `${index}`; // Set the target surah ID

        // Add click event to display the corresponding Surah
        tocItem.addEventListener('click', function() {
            const suraContext = document.getElementById('sura-content');
            suraContext.classList.replace("sura-contexte", "eraseDiv");
            displaySingleSura(this.dataset.target);
        });

        tocContainer.appendChild(tocItem);
    });
}


// Function to generate the Revelation order of Table of Contents (TOC)
function generateRevelationTOC() {
    const tocContainer = document.getElementById('toc-container');
    tocContainer.innerHTML = ''; // Clear any existing content

     // Define the icon mapping for cities
    const iconMapping = {
    Makkah: '/img/makkah-icon.png',
    Madinah: '/img/madinah-icon.png',
    };
  
    // New order (you can use your own order here)
    const RevelationOrder = [96, 68, 73, 74, 1,111, 81,87, 92, 89, 93, 94, 103, 100, 108, 102, 107, 109, 105, 113, 114, 112, 53, 80, 97, 91, 85, 95, 106, 101, 75, 104, 77, 50, 90, 86, 54, 38, 7, 72, 36, 25, 35, 19, 20, 56, 26, 27, 28, 17, 10, 11, 12, 15, 6, 37, 31, 34, 39, 40, 41, 42, 43, 44, 45, 46, 51, 88, 18, 16, 71, 14, 21, 23, 32, 52, 67, 69, 70, 78, 79, 82, 84, 30, 29, 83, 2, 8, 3, 33, 60, 4, 99, 57, 47, 13, 55, 76, 65, 98, 59, 24, 22, 63, 58, 49, 66, 64, 61, 62, 48, 5, 9, 110];
    RevelationOrder.forEach((sura, index) =>{
 
    const Source = quranData[RevelationOrder[index]-1];

    const tocItem = document.createElement('div');
    tocItem.classList.add('toc-item');

    // Create the icon element
    const icon = document.createElement('img');
    icon.src = iconMapping[Source.city];
    icon.alt = `${Source.city} icon`;
    icon.classList.add('city-icon');

    // Set the text content for the TOC item
    tocItem.textContent = `${index+1}. ${Source.name}`;

    // Append the icon and text to the tocItem
    tocItem.appendChild(icon);

    // Set the target surah ID
    tocItem.dataset.target = `${index}`; // Set the target surah ID

    // Add click event to display the corresponding Surah
    tocItem.addEventListener('click', function() { 
        displaySingleRevelationSura(RevelationOrder[index]);
    });

    tocContainer.appendChild(tocItem);
    })
}

// Function to display a single Surah
function displaySingleSura(suraId) {
    const sura = quranData.find(sura => sura.id == suraId);
    if (!sura) return;

    const quranContainer = document.getElementById("quran-container");

    quranContainer.innerHTML = ""; // Clear existing content

    const suraContainer = document.createElement("div");
    suraContainer.classList.add("sura");
    suraContainer.id = sura.id;

    // Add Surah Number and Name
    const suraTitle = document.createElement("h2");
    suraTitle.id = 'suraTitle';
    let suraID = parseInt(sura.id) + 1;
    suraTitle.textContent = ` ${suraID} - ${sura.name}`;
    suraContainer.appendChild(suraTitle);

    sura.verses.forEach(verse => {
        const verseContainer = document.createElement("p");
        // verseContainer.classList.add("firstVerse");
        verseContainer.classList.add("verse");

        if(Arabic == true){
            verseContainer.classList.add('right-align');
        }
        verseContainer.innerHTML = highlightText(verse.text, ""); // No highlight initially

        // Add Quranic icon with verse number
        const verseIcon = document.createElement("span");
        verseIcon.classList.add("verse-icon");
        verseIcon.innerHTML = `<span class="icon-number">${verse.number}</span>`;
        verseContainer.appendChild(verseIcon);
        suraContainer.appendChild(verseContainer);
    });
    quranContainer.appendChild(suraContainer);
    quranContainer.classList.replace("eraseDiv", "textContainer");
    const SuraContext = document.getElementById('sura-content');
    SuraContext.innerHTML='';
}

// Function to display a single Surah
function displaySingleRevelationSura(suraId) {
    const sura = quranData.find(sura => sura.id == (suraId-1));
    if (!sura) return;

    const quranContainer = document.getElementById("quran-container");
    quranContainer.innerHTML = ""; // Clear existing content

    const suraContainer = document.createElement("div");
    suraContainer.classList.add("sura");
    // suraContainer.id = sura.id;
    suraContainer.id = sura.id;

    // Add Surah Number and Name
    const suraTitle = document.createElement("h2");
    suraTitle.id = 'suraTitle';
    let suraID = parseInt(sura.id) + 1;
    suraTitle.textContent = ` ${suraID} - ${sura.name}`;
    suraContainer.appendChild(suraTitle);

    sura.verses.forEach(verse => {
        const verseContainer = document.createElement("p");
        verseContainer.classList.add("verse");
        if(Arabic == true){
            verseContainer.classList.add('right-align');
        }
        verseContainer.innerHTML = highlightText(verse.text, ""); // No highlight initially

        // Add Quranic icon with verse number
        const verseIcon = document.createElement("span");
        verseIcon.classList.add("verse-icon");
        verseIcon.innerHTML = `<span class="icon-number">${verse.number}</span>`;
        verseContainer.appendChild(verseIcon);
        suraContainer.appendChild(verseContainer);
    });

    const contentDiv = document.getElementById('sura-content');
    contentDiv.classList.replace("sura-contexte","eraseDiv");
    contentDiv.innerHTML='';

    quranContainer.appendChild(suraContainer);
    quranContainer.classList.replace("eraseDiv", "textContainer");
}

// Function to display a Surah data of the second language
function displaySecondLnleSura(suraId) {
    const divElement = document.querySelector('.sura');
    const divId = parseInt(divElement.id);
    
    // const verses = document.querySelectorAll('.firstVerse');
    const verses = document.querySelectorAll('.verse');

    const versesH2 = document.getElementById('suraTitle');
    versesH2.innerHTML+= ' - ';
    versesH2.innerHTML+= secondQuranData[divId].name ;

    verses.forEach((line,index) => {
        if (secondQuranData[divId] !== undefined) {
            const secondVerse = document.createElement('p');
            secondVerse.className = 'verse';
            secondVerse.textContent = secondQuranData[divId].verses[index].text;
            
            // Append array2 content below the existing array1 content
            line.appendChild(secondVerse);
        }
    });
}

// Function to search for a word within the displayed Sourah
function searchSourat(word) {
    let matches = 0;
    if(document.getElementById('quran-container').firstChild == null) return;
    const suraId = document.getElementById('quran-container').firstChild.id;
    const sura = quranData.find(sura => sura.id === suraId);
    if (!sura) return;

    const ignoreDiacritics = currentLanguage === 'arabic' && document.getElementById('ignore-diacritics').checked;
    word = ignoreDiacritics ? removeDiacritics(word) : word;

    const matchedVerses = sura.verses.filter(verse => {
        const verseText = ignoreDiacritics ? removeDiacritics(verse.text) : verse.text;
          if (verseText.toLowerCase().includes(word.toLowerCase())){
            matches = matches +1;
         }
        return matches;
    });
const NumOfVerseThatMatches = matchedVerses.length;
 displaySearchResultsForSourat(matchedVerses, sura, word);
}

// Function to search for a word in the entire Quran data
function searchQuran(word) {
    const ignoreDiacritics = currentLanguage === 'arabic' && document.getElementById('ignore-diacritics').checked;
    const searchTerm = ignoreDiacritics ? removeDiacritics(word) : word;
    
    const matchedVerses = quranData.flatMap(sura => 
        sura.verses
            .map(verse => ({
                suraName: sura.name,
                suraId: sura.id,
                verseNumber: verse.number,
                verseText: ignoreDiacritics ? removeDiacritics(verse.text) : verse.text
            }))
            .filter(verse => verse.verseText.toLowerCase().includes(searchTerm.toLowerCase()))
    ); 

    displaySearchResults(matchedVerses, word);
}

// Function to highlight search term in the text
function highlightText(text, term) {
    if (!term) return text; // Return original text if no search term
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');

}

// Function to display search results
function displaySearchResultsForSourat(verses, sura, word) {

    const resultsContainer = document.getElementById("search-results");
    resultsContainer.innerHTML = ""; // Clear previous results
    resultsContainer.classList.replace("eraseDiv", "resultsClass");

    const resetSearchButton = document.getElementById("reset-button");
    resetSearchButton.innerHTML ='Close';
    resetSearchButton.classList.replace("eraseDiv", "resetButton");

    const resultsContainerGlobal = document.getElementById("resultsContainerID");
    resultsContainerGlobal.classList.replace("eraseDiv", "resultsContainer");


    const ignoreDiacritics = currentLanguage === 'arabic' && document.getElementById('ignore-diacritics').checked;
    word = ignoreDiacritics ? removeDiacritics(word) : word;

    let verseMatchCount = 0;
    let totalWordOccurrences = 0;

    verses.forEach(verse => {
        let verseText = ignoreDiacritics ? removeDiacritics(verse.text) : verse.text;
        const regex = new RegExp(word, 'gi');
        const matchCount = (verseText.match(regex) || []).length;

        if (matchCount > 0) {
            verseMatchCount++; // Increment the number of verses containing the word
            totalWordOccurrences += matchCount; // Increment total occurrences of the word
        }
    });

    // Display the total matches at the top
    const totalMatchesElement = document.createElement("div");
    totalMatchesElement.classList.add("total-matches");
    totalMatchesElement.textContent = `Total verses in ${sura.name}: ${verseMatchCount}. Total matches: ${totalWordOccurrences}.`;
    
    resultsContainer.appendChild(totalMatchesElement);

    // If no matches were found
    if (totalWordOccurrences === 0) {
        resultsContainer.innerHTML += `<div>No results found in ${sura.name}</div>`;
        return;
    }

    // Display each matched verse in the search results
    verses.forEach(verse => {
        let verseText = ignoreDiacritics ? removeDiacritics(verse.text) : verse.text;
        const regex = new RegExp(word, 'gi');

        const matchCount = (verseText.match(regex) || []).length;

        if (matchCount > 0) {
            const resultElement = document.createElement("div");
            resultElement.classList.add("search-result-item");
            resultElement.textContent = ` ~${verse.number}~ :  { ${matchCount} }`;

            resultElement.addEventListener('click', () => {
                highlightAndScrollToVerse(sura.id, verse.number);
            });

            resultsContainer.appendChild(resultElement);
        }
    });
}

// Function to display search results for the entire Quran
function displaySearchResults(verses, word) {

    const resultsContainerGlobal = document.getElementById("resultsContainerID");
    resultsContainerGlobal.classList.replace("eraseDiv", "resultsContainer");

    const resultsContainer = document.getElementById("search-results");
    resultsContainer.innerHTML = ""; // Clear previous results 
    resultsContainer.classList.replace("eraseDiv", "resultsClass");

    const resultsButton = document.getElementById("reset-button");
    resultsButton.innerHTML = "Close"; 
    resultsButton.classList.replace("eraseDiv","resetButton");


    if (verses.length === 0) {
        resultsContainer.innerHTML = `<div>No results found.</div>`;
        return;
    }

    const ignoreDiacritics = currentLanguage === 'arabic' && document.getElementById('ignore-diacritics').checked;
    word = ignoreDiacritics ? removeDiacritics(word) : word;

    let totalWordOccurrences = 0;
    const surahMap = new Map();

    verses.forEach(verse => {
        const matchCount = (verse.verseText.match(new RegExp(word, 'gi')) || []).length;
        totalWordOccurrences += matchCount;

        if (!surahMap.has(verse.suraName)) {
            surahMap.set(verse.suraName, []);
        }

        surahMap.get(verse.suraName).push({
            verseNumber: verse.verseNumber,
            matchCount,
            suraId: verse.suraId 
        });
    });

    // Display total occurrences
    const totalMatchesElement = document.createElement("div");
    totalMatchesElement.classList.add("total-matches");
    totalMatchesElement.textContent = `Results: ${totalWordOccurrences}`;
    resultsContainer.appendChild(totalMatchesElement);

    // Display search results grouped by Surah
    surahMap.forEach((verses, surahName) => {
        const surahResults = document.createElement("div");
        surahResults.classList.add("surah-results");

        const surahHeader = document.createElement("h3");
        surahHeader.classList.add('SearchResultSurah');
        surahHeader.textContent = `${surahName}`;
        surahResults.appendChild(surahHeader);

        verses.forEach(({ verseNumber, matchCount,suraId }) => {
            const resultElement = document.createElement("div");
            resultElement.classList.add("search-result-item");
            resultElement.textContent = `~${verseNumber}~ : { ${matchCount} }`;
            resultElement.addEventListener('click', () => {
                highlightAndScrollToVerse(suraId, verseNumber);
            });

            surahResults.appendChild(resultElement);
        });

        resultsContainer.appendChild(surahResults);
    });
}

// Function to highlight and scroll to the verse in the displayed Surah
function highlightAndScrollToVerse(suraId, verseNumber) {
    const suraContainer = document.getElementById(suraId);
    if (!suraContainer) return;

    const verseElements = suraContainer.getElementsByClassName('firtsVerse');
    Array.from(verseElements).forEach((verseElement, index) => {
        const searchTerm = document.getElementById("search-input").value.trim();
        const verseText = quranData.find(sura => sura.id === suraId).verses[index].text;
        verseElement.innerHTML = highlightText(verseText, searchTerm);
    });

    const targetVerse = verseElements[verseNumber - 1];
    if (targetVerse) {
        targetVerse.scrollIntoView({ behavior: 'smooth' });
    }
}

function highlightAndScrollToVerse(suraId, verseNumber) {

    // Check if the correct Surah is displayed; if not, display it
    const currentSuraContainer = document.getElementById('quran-container').firstChild;
    if (!currentSuraContainer || currentSuraContainer.id !== suraId) {
        displaySingleSura(suraId); // Display the correct Surah
    }

    // Get the container of the Surah
    const suraContainer = document.getElementById(suraId);
    if (!suraContainer) return;

    // const verseElements = suraContainer.getElementsByClassName('firstVerse');
    const verseElements = suraContainer.getElementsByClassName('verse');


    // Loop through each verse in the Surah and re-render it with the Ayah number and highlighting
    Array.from(verseElements).forEach((verseElement, index) => {
        const verseText = quranData.find(sura => sura.id === suraId).verses[index].text;
        const searchTerm = document.getElementById("search-input").value.trim();

        // Reset the inner HTML to ensure proper rendering
        verseElement.innerHTML = '';

        // Create a span to hold the highlighted text
        const highlightedText = document.createElement("span");
        highlightedText.innerHTML = highlightText(verseText, searchTerm);
        verseElement.appendChild(highlightedText);

        // Add the Ayah number/icon back to the verse element
        const verseIcon = document.createElement("span");
        verseIcon.classList.add("verse-icon");
        verseIcon.innerHTML = `<span class="icon-number">${index + 1}</span>`;
        verseElement.appendChild(verseIcon);
    });

    // Scroll to the specific verse
    const targetVerse = verseElements[verseNumber - 1];
    if (targetVerse) {
        targetVerse.scrollIntoView({ behavior: 'smooth' });
    }

    if(document.getElementById('sura-content')) {
        const suraContext = document.getElementById('sura-content');
        suraContext.classList.replace("sura-contexte", "eraseDiv");
        suraContext.innerHTML ='';
    }
}

// Reset search
function resetSearch() {
    document.getElementById('search-input').value = ''; // Clear search input
    const suraId = document.getElementById('quran-container').firstChild.id;
    displaySingleSura(suraId); // Re-display the current Surah without highlights

    const resultsText = document.getElementById("search-results");
    resultsText.innerHTML = ""; // Clear previous results 
    resultsText.classList.replace("resultsClass", "eraseDiv");

    const resultsContainer = document.getElementById("resultsContainerID");
    resultsContainer.classList.replace("resultsContainer", "eraseDiv");

    const resetSearchButton = document.getElementById("reset-button");
    resetSearchButton.innerHTML ='';
    resetSearchButton.classList.replace("resetButton", "eraseDiv");
}

// Event listeners for Quran search and reset buttons
document.getElementById('search-button').addEventListener('click', function() {
    const searchTerm = document.getElementById('search-input').value.trim();
    if (searchTerm) {
        searchQuran(searchTerm);
    }
});

// Event listeners for Sourat search and reset buttons
document.getElementById('search-button-Sourat').addEventListener('click', function() {
    const searchTerm = document.getElementById('search-input').value.trim();
    if (searchTerm) {
        searchSourat(searchTerm);
    }
});

document.getElementById('reset-button').addEventListener('click', resetSearch);

// Event listener for language change
document.getElementById('language-selector').addEventListener('change', function() {
    currentLanguage = this.value;
    if(currentLanguage == 'arabic'){
        Arabic = true;
    }
    else{
        Arabic = false;
    }
    loadQuranData();
});

// Event listener for additionnal Surah language selector
document.getElementById('Surah-language-selector').addEventListener('change', function() {
    currentLanguageAdditionnal = this.value;
    loadSurahData();
});

// Function to toggle between original and new order
let isOriginalOrder = true;
document.getElementById('toggleOrder').addEventListener('click', () => {
    if (isOriginalOrder) {
        const button = document.getElementById("toggleOrder");
        button.textContent = ' Classic Order';
        loadRevelationOrderQuranData();
    } else {
        const button = document.getElementById("toggleOrder");
        button.textContent = ' Revelation Order';
        loadQuranData();
    }
    isOriginalOrder = !isOriginalOrder;
});

// Display the current Surah context
document.getElementById('context').addEventListener('click', () => {
    // Clean up Search Results
    const resultsContainerGlobal = document.getElementById("resultsContainerID");
    resultsContainerGlobal.classList.replace("resultsContainer", "eraseDiv");

    const resultsContainer = document.getElementById("search-results");
    resultsContainer.innerHTML = "";
    resultsContainer.classList.replace("resultsClass", "eraseDiv");

    const resultsButton = document.getElementById("reset-button");
    resultsButton.innerHTML = ""; 
    resultsButton.classList.replace("resetButton", "eraseDiv");
    // ====================
    if(document.getElementById('quran-container').firstChild == null) return;
    const suraId = document.getElementById('quran-container').firstChild.id;
    const suraIndex = quranData.find(sura => sura.id === suraId);
    if (!suraIndex) return;
    contexttButon = document.getElementById('context');

    const contentDiv = document.createElement('sura-content')

    fetchAndDisplaySura(parseInt(suraIndex.id)+1);

    // Fetch the XML file for context
    function fetchAndDisplaySura(suraIndex) {

        if(currentLanguage == 'arabic'){
            Arabic = true;
        }
        else{
            Arabic = false;
        }
        // Display the context according to the current language
        const xmlFile = `data/context/context-${currentLanguage}1.xml`; 

        fetch(xmlFile)
            .then(response => response.text())
            .then(data => {
                // Parse the XML
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(data, "text/xml");

                // Find the sura with the matching index
                const suras = xmlDoc.getElementsByTagName("sura");
                let foundSura = null;
                
                Array.from(suras).forEach(sura => {
                    if (sura.getAttribute('index') === suraIndex.toString()) {
                        foundSura = sura;
                    }
                });

                if (foundSura) {
                    displaySuraContext(foundSura);
                } else {
                    SearchInSecondXML(suraIndex);
                }
            })
            .catch(error => console.error('Error loading XML:', error));
    }

    // Search in the second XML file
    function SearchInSecondXML(suraIndex){
        const xmlFile2 = `data/context/context-${currentLanguage}2.xml`; 

        fetch(xmlFile2)
        .then(response => response.text())
        .then(data => {
            // Parse the XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, "text/xml");

            // Find the sura with the matching index
            const suras = xmlDoc.getElementsByTagName("sura");
            let foundSura = null;
            
            Array.from(suras).forEach(sura => {
                if (sura.getAttribute('index') === suraIndex.toString()) {
                    foundSura = sura;
                }
            });

            if (foundSura) {
                displaySuraContext(foundSura);
            } else {
                document.createElement('sura-content').innerHTML = '<p>Sura not found.</p>';
            }
        })
        .catch(error => console.error('Error loading XML:', error));
    }

    // Function to display the sura content
    function displaySuraContext(sura) { 

        const contentDiv = document.getElementById('sura-content');
        const sections = sura.getElementsByTagName('section');
        let Intro = true;

        Array.from(sections).forEach((section, index) => {
            let sectionIntroduction = '';
            const sectionTitle = section.getElementsByTagName('title')[0].textContent;
            const contentItems = section.getElementsByTagName('content')[0];
            const items = contentItems.getElementsByTagName('title');
            const descriptions = contentItems.getElementsByTagName('description');
            // Create and append section title
            const sectionElem = document.createElement('article');

            if (Intro)
                {
                    sectionIntroduction = section.getElementsByTagName('introduction')[0].textContent;
                    const p = document.createElement('p');
                    p.textContent = sectionIntroduction;
                    sectionElem.appendChild(p);
                    Intro=false;
                }

            const h2 = document.createElement('h2');
            h2.textContent = `${index + 1}. ${sectionTitle}`;
            sectionElem.appendChild(h2);

            Array.from(items).forEach((item, itemIndex) => {
                // Create and append item
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item';

                const itemH3 = document.createElement('h3');
                itemH3.textContent = item.textContent;
                itemDiv.appendChild(itemH3);

                // Create and append corresponding description
                const itemP = document.createElement('p');
                itemP.textContent = descriptions[itemIndex].textContent;
                itemDiv.appendChild(itemP);

                sectionElem.appendChild(itemDiv);
            });

            if(Arabic == true){
                contentDiv.classList.add('right-align');
            }
            else{
                contentDiv.classList.remove('right-align');
            }

            contentDiv.appendChild(sectionElem); 
            contentDiv.classList.replace("eraseDiv", "sura-contexte")
        });
        const quranContainer = document.getElementById('quran-container');
        quranContainer.classList.replace("textContainer", "eraseDiv")
    }

    contextSwitch = false;
    const quranContainer = document.getElementById('quran-container');
    contentDiv.id = 'ContextID';
    quranContainer.innerHTML = '';
    contentDiv.classList.add('textContainer');
});

  

async function getHijriCalendarForMonth() {
    // const daysInMonth = new Date(year, month, 0).getDate(); // Get number of days in the Gregorian month
    // const hijriDates = [];
  

    const currentDate = new Date();

    const month1 = String(currentDate.getMonth() + 1).padStart(2, '0'); // Get the month (0-based, so add 1)
    const day1= String(currentDate.getDate()).padStart(2, '0');        // Get the day
    const year1 = currentDate.getFullYear();                            // Get the year

    const formattedDate = `${day1}-${month1}-${year1}`;                   // Format it as mm/dd/yyyy

    console.log(formattedDate);  // Output: "09/12/2024" (or whatever the current date is)
    const url = `https://api.aladhan.com/v1/gToH/${formattedDate}`;

    try {
        const response = await fetch(url);
  
        // Check if response is OK
        if (!response.ok) {
          console.error(`Error fetching data for ${gregorianDate}: ${response.statusText}`);
        //   continue; // Skip to the next day if there's an error
        }
  
        const data = await response.json();
  
        if (data.code === 200) {
          const hijriDate = data.data.hijri.date;
        //   const hijriMonth = data.data.hijri.month;
          const hijriDay  = data.data.hijri.day;
          const hijriYear =  data.data.hijri.year ;


          const hijriMonthNumber = data.data.hijri.month.number - 1;
          const hijriMonth = HijryMonths[hijriMonthNumber];
          displayHijriMonth(hijriMonth, hijriYear, hijriDay, formattedDate);


        //   hijriDates.push({ gregorian: gregorianDate, hijri: hijriDate });
        } else {
          console.error(`API Error: ${data.data}`);
        }
      } catch (error) {
        console.error("Network error or invalid response:", error);
      }


    // for (let day = 1; day <= daysInMonth; day++) {

    // const gregorianDate = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${year}`;
    //   const url = `https://api.aladhan.com/v1/gToH/${gregorianDate}`; // Correct API endpoint
    // //   console.log('url: ', url)
  
    //   try {
    //     const response = await fetch(url);
  
    //     // Check if response is OK
    //     if (!response.ok) {
    //       console.error(`Error fetching data for ${gregorianDate}: ${response.statusText}`);
    //       continue; // Skip to the next day if there's an error
    //     }
  
    //     const data = await response.json();
  
    //     if (data.code === 200) {
    //       const hijriDate = data.data.hijri.date;

    //       const hijriMonthNumber = data.data.hijri.month.number - 1;
    //       const hijriMonth = HijryMonths[hijriMonthNumber];
    //       displayHijriMonth(hijriMonth);


    //       hijriDates.push({ gregorian: gregorianDate, hijri: hijriDate });
    //     } else {
    //       console.error(`API Error: ${data.data}`);
    //     }
    //   } catch (error) {
    //     console.error("Network error or invalid response:", error);
    //   }
    // }
  
    // console.log("Hijri Calendar for the month:", hijriDates);
    // return hijriDates;
  }
//   async function getHijriCalendarForMonth(year, month) {
//     const daysInMonth = new Date(year, month, 0).getDate(); // Get number of days in the Gregorian month
//     const hijriDates = [];
  

//     const currentDate = new Date();

//     const month1 = String(currentDate.getMonth() + 1).padStart(2, '0'); // Get the month (0-based, so add 1)
//     const day1= String(currentDate.getDate()).padStart(2, '0');        // Get the day
//     const year1 = currentDate.getFullYear();                            // Get the year

//     const formattedDate = `${day1}-${month1}-${year1}`;                   // Format it as mm/dd/yyyy

//     console.log(formattedDate);  // Output: "09/12/2024" (or whatever the current date is)
//     const url = `https://api.aladhan.com/v1/gToH/${formattedDate}`;

//     try {
//         const response = await fetch(url);
  
//         // Check if response is OK
//         if (!response.ok) {
//           console.error(`Error fetching data for ${gregorianDate}: ${response.statusText}`);
//         //   continue; // Skip to the next day if there's an error
//         }
  
//         const data = await response.json();
  
//         if (data.code === 200) {
//           const hijriDate = data.data.hijri.date;

//           const hijriMonthNumber = data.data.hijri.month.number - 1;
//           const hijriMonth = HijryMonths[hijriMonthNumber];
//           displayHijriMonth(hijriMonth);


//           hijriDates.push({ gregorian: gregorianDate, hijri: hijriDate });
//         } else {
//           console.error(`API Error: ${data.data}`);
//         }
//       } catch (error) {
//         console.error("Network error or invalid response:", error);
//       }


//     for (let day = 1; day <= daysInMonth; day++) {

//     const gregorianDate = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${year}`;
//       const url = `https://api.aladhan.com/v1/gToH/${gregorianDate}`; // Correct API endpoint
//     //   console.log('url: ', url)
  
//       try {
//         const response = await fetch(url);
  
//         // Check if response is OK
//         if (!response.ok) {
//           console.error(`Error fetching data for ${gregorianDate}: ${response.statusText}`);
//           continue; // Skip to the next day if there's an error
//         }
  
//         const data = await response.json();
  
//         if (data.code === 200) {
//           const hijriDate = data.data.hijri.date;

//           const hijriMonthNumber = data.data.hijri.month.number - 1;
//           const hijriMonth = HijryMonths[hijriMonthNumber];
//           displayHijriMonth(hijriMonth);


//           hijriDates.push({ gregorian: gregorianDate, hijri: hijriDate });
//         } else {
//           console.error(`API Error: ${data.data}`);
//         }
//       } catch (error) {
//         console.error("Network error or invalid response:", error);
//       }
//     }
  
//     // console.log("Hijri Calendar for the month:", hijriDates);
//     return hijriDates;
//   }
  // Example Usage: Get Hijri calendar for September 2024
 
  getHijriCalendarForMonth()
    .then((hijriCalendar) => {
      console.log("Hijri Calendar for the month:", hijriCalendar);
    })
    .catch((error) => {
      console.error("An error occurred:", error);
    });
  
    // Function to display Hijri month in HTML
    function displayHijriMonth(hijriMonth, hijriYear, hijriDay, GeorgianDate) {
      const hijriMonthElement = document.getElementById('hijriMonth');
    //   hijriMonthElement.textContent
      hijriMonthElement.innerHTML = `${GeorgianDate}  / <span class="hijriSpan">${hijriDay} - ${hijriMonth}, ${hijriYear}</span>`;
    }

// Load Quran data on page load
loadQuranData();

