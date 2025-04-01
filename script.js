// Current language setting
let currentLang = 'en';
let map;
let markers = [];

// Initialize map
function initMap() {
    map = L.map('map').setView([15, 100], 5); // Center on Thailand
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ' OpenStreetMap contributors'
    }).addTo(map);
}

// Translations
const translations = {
    countries: {
        'Myanmar': {
            en: 'Myanmar',
            ko: '미얀마',
            th: 'พม่า',
            ja: 'ミャンマー',
            zh: '缅甸',
            es: 'Birmania'
        },
        'Thailand': {
            en: 'Thailand',
            ko: '태국',
            th: 'ประเทศไทย',
            ja: 'タイ',
            zh: '泰国',
            es: 'Tailandia'
        },
        // Add other country translations...
    }
};

// Calculate intensity level based on magnitude
function getIntensityLevel(magnitude) {
    if (magnitude >= 6.0) return 5;
    if (magnitude >= 5.0) return 4;
    if (magnitude >= 4.0) return 3;
    if (magnitude >= 3.0) return 2;
    return 1;
}

// Get intensity description
function getIntensityDescription(level, lang) {
    const descriptions = {
        1: {
            en: 'Very Light',
            ko: '매우 약함',
            th: 'เบามาก',
            ja: 'ごく弱い',
            zh: '极轻',
            es: 'Muy Ligero'
        },
        // Add descriptions for other levels...
    };
    return descriptions[level][lang] || descriptions[level]['en'];
}

// Function to change language
function changeLanguage(lang) {
    currentLang = lang;
    document.documentElement.setAttribute('lang', lang);
    
    // Update all translatable elements
    document.querySelectorAll('[data-' + lang + ']').forEach(element => {
        element.textContent = element.getAttribute('data-' + lang);
    });
    
    // Refresh the table to update the language for earthquake types
    if (document.getElementById('earthquakeData').children.length > 0) {
        const currentFilter = document.getElementById('countryFilter').value;
        updateTable(lastEarthquakes);
        if (currentFilter !== 'all') {
            filterEarthquakes();
        }
    }
    
    updateURL();
}

// Store the last fetched earthquakes for language switching
let lastEarthquakes = [];

// Function to fetch earthquake data
async function fetchEarthquakeData() {
    try {
        // USGS API endpoint for the past 30 days
        const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson');
        const data = await response.json();
        
        // Filter and process the data
        const targetCountries = ['Myanmar', 'Thailand', 'Korea', 'Japan', 'Indonesia', 'China'];
        const relevantEarthquakes = data.features.filter(quake => {
            const place = quake.properties.place;
            return targetCountries.some(country => place.includes(country));
        });

        // Identify mainshocks and aftershocks
        const processedEarthquakes = identifyAftershocks(relevantEarthquakes);
        
        // Store for language switching
        lastEarthquakes = processedEarthquakes;

        updateTable(processedEarthquakes);
        updateMap(processedEarthquakes);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Error fetching earthquake data:', error);
    }
}

// Function to identify mainshocks and aftershocks
function identifyAftershocks(earthquakes) {
    // Sort earthquakes by time (oldest first)
    const sortedQuakes = [...earthquakes].sort((a, b) => a.properties.time - b.properties.time);
    
    // Map to store mainshock-aftershock relationships
    const quakeMap = new Map();
    
    // Parameters for aftershock identification
    const mainshockThreshold = 4.5; // Magnitude threshold for mainshocks
    const spatialThreshold = 100; // km
    const temporalThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    // Process each earthquake
    sortedQuakes.forEach(quake => {
        const mag = quake.properties.mag;
        const time = quake.properties.time;
        const coords = quake.geometry.coordinates;
        
        // Flag to determine if this is an aftershock
        let isAftershock = false;
        let mainshockId = null;
        
        // Check if this is an aftershock of any previous mainshock
        for (const [id, mainshock] of quakeMap.entries()) {
            if (mainshock.properties.mag >= mainshockThreshold) {
                const mainshockTime = mainshock.properties.time;
                const mainshockCoords = mainshock.geometry.coordinates;
                
                // Calculate time difference
                const timeDiff = time - mainshockTime;
                
                // Calculate distance
                const distance = calculateDistance(
                    coords[1], coords[0], 
                    mainshockCoords[1], mainshockCoords[0]
                );
                
                // If within spatial and temporal thresholds, and smaller magnitude, it's an aftershock
                if (timeDiff > 0 && 
                    timeDiff < temporalThreshold && 
                    distance < spatialThreshold && 
                    mag < mainshock.properties.mag) {
                    isAftershock = true;
                    mainshockId = id;
                    break;
                }
            }
        }
        
        // Add earthquake to the map
        quake.properties.isAftershock = isAftershock;
        quake.properties.mainshockId = mainshockId;
        quakeMap.set(quake.id, quake);
    });
    
    return Array.from(quakeMap.values());
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Function to update the table with earthquake data
function updateTable(earthquakes) {
    const tbody = document.getElementById('earthquakeData');
    tbody.innerHTML = '';

    // Sort earthquakes by time (newest first)
    const sortedEarthquakes = [...earthquakes].sort((a, b) => b.properties.time - a.properties.time);

    sortedEarthquakes.forEach(quake => {
        const row = document.createElement('tr');
        const properties = quake.properties;
        const coordinates = quake.geometry.coordinates;
        const time = formatDate(properties.time, currentLang);
        const magnitude = properties.mag.toFixed(1);
        const depth = coordinates[2].toFixed(1);
        const intensityLevel = getIntensityLevel(magnitude);
        const isAftershock = properties.isAftershock;

        // Determine earthquake type text based on current language
        let typeText = '';
        let typeIcon = '';
        if (isAftershock) {
            typeIcon = '<i class="fas fa-arrow-right"></i>';
            typeText = {
                'en': 'A',
                'ko': '여',
                'th': 'อ',
                'ja': '余',
                'zh': '余',
                'es': 'R'
            }[currentLang] || 'A';
        } else {
            typeIcon = '<i class="fas fa-star"></i>';
            typeText = {
                'en': 'M',
                'ko': '본',
                'th': 'ห',
                'ja': '本',
                'zh': '主',
                'es': 'P'
            }[currentLang] || 'M';
        }

        row.innerHTML = `
            <td class="${isAftershock ? 'aftershock' : 'mainshock'}">${typeIcon} ${typeText}</td>
            <td class="${magnitude >= 5.0 ? 'magnitude-high' : ''}">${magnitude}</td>
            <td>${time}</td>
            <td><span class="intensity-level intensity-${intensityLevel}">${intensityLevel}</span></td>
            <td>${properties.place}</td>
            <td>${coordinates[1].toFixed(4)}°</td>
            <td>${coordinates[0].toFixed(4)}°</td>
            <td>${depth} km</td>
            <td>${properties.place.split(', ').slice(-1)[0]}</td>
        `;

        tbody.appendChild(row);
    });
}

// Function to update map markers
function updateMap(earthquakes) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Add new markers
    earthquakes.forEach(quake => {
        const coordinates = quake.geometry.coordinates;
        const magnitude = quake.properties.mag;
        const isAftershock = quake.properties.isAftershock;
        
        // Different colors for mainshocks and aftershocks
        const markerColor = isAftershock ? '#f39c12' : (magnitude >= 5.0 ? '#e74c3c' : '#3498db');
        
        const marker = L.circle([coordinates[1], coordinates[0]], {
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.5,
            radius: magnitude * 10000 // Scale circle size based on magnitude
        });

        // Determine earthquake type text based on current language
        let typeText = isAftershock ? 'Aftershock' : 'Mainshock';
        if (currentLang === 'ko') {
            typeText = isAftershock ? '여진' : '본진';
        } else if (currentLang === 'th') {
            typeText = isAftershock ? 'อาฟเตอร์ช็อก' : 'แผ่นดินไหวหลัก';
        } else if (currentLang === 'ja') {
            typeText = isAftershock ? '余震' : '本震';
        } else if (currentLang === 'zh') {
            typeText = isAftershock ? '余震' : '主震';
        } else if (currentLang === 'es') {
            typeText = isAftershock ? 'Réplica' : 'Sismo principal';
        }

        marker.bindPopup(`
            <strong>${quake.properties.place}</strong><br>
            Magnitude: ${magnitude}<br>
            Depth: ${coordinates[2]} km<br>
            Time: ${new Date(quake.properties.time).toLocaleString()}<br>
            Type: ${typeText}
        `);

        marker.addTo(map);
        markers.push(marker);
    });
}

// Function to filter earthquakes by country
function filterEarthquakes() {
    const country = document.getElementById('countryFilter').value;
    const rows = document.getElementById('earthquakeData').getElementsByTagName('tr');
    const tbody = document.getElementById('earthquakeData');
    
    let visibleRows = 0;
    
    for (let row of rows) {
        const location = row.cells[4].textContent; // Update index to match Location column
        if (country === 'all' || location.includes(country)) {
            row.style.display = '';
            visibleRows++;
        } else {
            row.style.display = 'none';
        }
    }
    
    // If no earthquakes found for the selected country, show a message
    if (visibleRows === 0 && country !== 'all') {
        const noDataRow = document.createElement('tr');
        const noDataCell = document.createElement('td');
        noDataCell.colSpan = 9; // Span across all columns
        
        // Multilingual no data message
        const noDataMessages = {
            'en': `No earthquakes found for ${getCountryName(country)}`,
            'ko': `${getCountryName(country)}에서 발생한 지진이 없습니다`,
            'th': `ไม่พบแผ่นดินไหวใน${getCountryName(country)}`,
            'ja': `${getCountryName(country)}で地震は見つかりませんでした`,
            'zh': `${getCountryName(country)}没有发现地震`,
            'es': `No se encontraron terremotos en ${getCountryName(country)}`
        };
        
        noDataCell.textContent = noDataMessages[currentLang] || noDataMessages['en'];
        noDataCell.className = 'no-data-message';
        
        noDataRow.appendChild(noDataCell);
        tbody.appendChild(noDataRow);
    } else if (visibleRows === 0 && country === 'all') {
        const noDataRow = document.createElement('tr');
        const noDataCell = document.createElement('td');
        noDataCell.colSpan = 9; // Span across all columns
        
        // Multilingual no data message for all countries
        const noDataMessages = {
            'en': 'No earthquakes found',
            'ko': '지진 데이터가 없습니다',
            'th': 'ไม่พบข้อมูลแผ่นดินไหว',
            'ja': '地震データが見つかりません',
            'zh': '没有发现地震数据',
            'es': 'No se encontraron terremotos'
        };
        
        noDataCell.textContent = noDataMessages[currentLang] || noDataMessages['en'];
        noDataCell.className = 'no-data-message';
        
        noDataRow.appendChild(noDataCell);
        tbody.appendChild(noDataRow);
    }
    
    updateURL();
}

// Function to update last update time
function updateLastUpdateTime() {
    const lastUpdate = document.getElementById('lastUpdate');
    lastUpdate.textContent = formatDate(new Date(), currentLang);
}

// Function to format date for different languages
function formatDate(date, lang) {
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    
    return new Date(date).toLocaleString(lang, options);
}

// Function to get country name in current language
function getCountryName(country) {
    if (translations.countries[country] && translations.countries[country][currentLang]) {
        return translations.countries[country][currentLang];
    }
    return country;
}

// Function to handle URL parameters
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle language parameter
    const langParam = urlParams.get('lang');
    if (langParam && ['en', 'ko', 'th', 'ja', 'zh', 'es'].includes(langParam)) {
        changeLanguage(langParam);
    }
    
    // Handle country parameter
    const countryParam = urlParams.get('country');
    if (countryParam) {
        const countrySelect = document.getElementById('countryFilter');
        const options = Array.from(countrySelect.options);
        
        // Find the option that matches the country parameter
        const matchingOption = options.find(option => 
            option.value.toLowerCase() === countryParam.toLowerCase() ||
            option.textContent.toLowerCase() === countryParam.toLowerCase()
        );
        
        if (matchingOption) {
            countrySelect.value = matchingOption.value;
            // Filter earthquakes after data is loaded
            setTimeout(() => filterEarthquakes(), 1000);
        }
    }
    
    // Update page title based on selected country and language
    updatePageTitle();
}

// Function to update page title for better SEO
function updatePageTitle() {
    const countrySelect = document.getElementById('countryFilter');
    const selectedCountry = countrySelect.value;
    
    if (selectedCountry !== 'all') {
        const countryName = getCountryName(selectedCountry);
        
        // Title templates for different languages
        const titleTemplates = {
            'en': `${countryName} Earthquake Monitor | Global Earthquake Tracker`,
            'ko': `${countryName} 지진 모니터 | 전세계 지진 추적기`,
            'th': `ระบบติดตามแผ่นดินไหว${countryName} | ระบบติดตามแผ่นดินไหวทั่วโลก`,
            'ja': `${countryName}地震モニター | 世界地震追跡`,
            'zh': `${countryName}地震监测 | 全球地震追踪器`,
            'es': `Monitor de Terremotos de ${countryName} | Rastreador Global de Terremotos`
        };
        
        document.title = titleTemplates[currentLang] || titleTemplates['en'];
        
        // Update meta description for better SEO
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            const descTemplates = {
                'en': `Real-time earthquake monitoring for ${countryName}. Track mainshocks and aftershocks with detailed information in multiple languages.`,
                'ko': `${countryName}의 실시간 지진 모니터링. 본진과 여진을 상세한 정보와 함께 다국어로 추적하세요.`,
                'th': `ติดตามแผ่นดินไหวในประเทศ${countryName}แบบเรียลไทม์ ติดตามแผ่นดินไหวหลักและแผ่นดินไหวตามด้วยข้อมูลโดยละเอียดในหลายภาษา`,
                'ja': `${countryName}のリアルタイム地震モニタリング。本震と余震を複数の言語で詳細情報と共に追跡します。`,
                'zh': `${countryName}实时地震监测。以多种语言跟踪主震和余震的详细信息。`,
                'es': `Monitoreo de terremotos en tiempo real para ${countryName}. Rastree terremotos principales y réplicas con información detallada en varios idiomas.`
            };
            
            metaDescription.content = descTemplates[currentLang] || descTemplates['en'];
        }
    }
}

// Function to update URL with current filters for better SEO and sharing
function updateURL() {
    const countrySelect = document.getElementById('countryFilter');
    const selectedCountry = countrySelect.value;
    
    // Create URL parameters
    const urlParams = new URLSearchParams();
    
    // Add language parameter
    urlParams.set('lang', currentLang);
    
    // Add country parameter if not 'all'
    if (selectedCountry !== 'all') {
        urlParams.set('country', selectedCountry);
    }
    
    // Update URL without reloading the page
    const newURL = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.pushState({ path: newURL }, '', newURL);
    
    // Update page title
    updatePageTitle();
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchEarthquakeData();
    
    // Handle URL parameters after data is loaded
    setTimeout(handleURLParameters, 1000);
    
    // Update URL when country filter changes
    document.getElementById('countryFilter').addEventListener('change', function() {
        filterEarthquakes();
    });
    
    // Fetch new data every 5 minutes
    setInterval(fetchEarthquakeData, 300000);
});

// Initial language setup - will be overridden by URL parameters if present
changeLanguage('en');
