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

        updateTable(relevantEarthquakes);
        updateMap(relevantEarthquakes);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Error fetching earthquake data:', error);
    }
}

// Function to update the table with earthquake data
function updateTable(earthquakes) {
    const tbody = document.getElementById('earthquakeData');
    tbody.innerHTML = '';

    earthquakes.forEach(quake => {
        const row = document.createElement('tr');
        const properties = quake.properties;
        const coordinates = quake.geometry.coordinates;
        const time = formatDate(properties.time, currentLang);
        const magnitude = properties.mag.toFixed(1);
        const depth = coordinates[2].toFixed(1);
        const intensityLevel = getIntensityLevel(magnitude);

        row.innerHTML = `
            <td class="${magnitude >= 5.0 ? 'magnitude-high' : ''}">${magnitude}</td>
            <td>${time}</td>
            <td>${properties.place}</td>
            <td>${coordinates[1].toFixed(4)}°</td>
            <td>${coordinates[0].toFixed(4)}°</td>
            <td>${depth} km</td>
            <td>${properties.place.split(', ').slice(-1)[0]}</td>
            <td><span class="intensity-level intensity-${intensityLevel}">${intensityLevel}</span></td>
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
        const marker = L.circle([coordinates[1], coordinates[0]], {
            color: magnitude >= 5.0 ? '#e74c3c' : '#3498db',
            fillColor: magnitude >= 5.0 ? '#e74c3c' : '#3498db',
            fillOpacity: 0.5,
            radius: magnitude * 10000 // Scale circle size based on magnitude
        });

        marker.bindPopup(`
            <strong>${quake.properties.place}</strong><br>
            Magnitude: ${magnitude}<br>
            Depth: ${coordinates[2]} km<br>
            Time: ${new Date(quake.properties.time).toLocaleString()}
        `);

        marker.addTo(map);
        markers.push(marker);
    });
}

// Function to filter earthquakes by country
function filterEarthquakes() {
    const country = document.getElementById('countryFilter').value;
    const rows = document.getElementById('earthquakeData').getElementsByTagName('tr');

    for (let row of rows) {
        const location = row.cells[2].textContent; // Update index to match Location column
        if (country === 'all' || location.includes(country)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}

// Function to update last update time
function updateLastUpdateTime() {
    const lastUpdate = document.getElementById('lastUpdate');
    lastUpdate.textContent = formatDate(new Date(), currentLang);
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchEarthquakeData();
    // Fetch new data every 5 minutes
    setInterval(fetchEarthquakeData, 300000);
});

// Initial language setup
changeLanguage('en');
