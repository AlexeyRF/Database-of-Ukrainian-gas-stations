// Проекция WGS84
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

function convertToSk42(lat, lng) {
    try {
        const ln = parseFloat(lng);
        const lt = parseFloat(lat);
        const zone = Math.floor((ln / 6) + 1);
        const centralMeridian = zone * 6 - 3;
        const falseEasting = zone * 1000000 + 500000;
        
        const projStr = '+proj=tmerc +lat_0=0 +lon_0=' + centralMeridian + 
                        ' +k=1 +x_0=' + falseEasting + 
                        ' +y_0=0 +ellps=krass +towgs84=24,-141,-81,0,-0.35,-0.82,-0.12 +units=m +no_defs';
        
        let sk42 = proj4('EPSG:4326', projStr, [ln, lt]);
        return { lat: sk42[1].toFixed(2), lng: sk42[0].toFixed(2) };
    } catch (e) {
        return { lat: "Ошибка", lng: "Ошибка" };
    }
}

ymaps.ready(init);

function init() {
    const myMap = new ymaps.Map('map', {
        center: [49.0, 31.0], // Default center around Ukraine region based on dataset
        zoom: 6,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    // Try loading the user's constructor map as base
    const constructorId = 'af87517a6f87da7d082c4ae0faa6ac274904c7f0828ae8adf9f741527277c067';
    const constructorUrl = `https://api-maps.yandex.ru/services/constructor/1.0/export/?id=${constructorId}&format=json`;
    
    ymaps.geoXml.load(constructorUrl)
        .then(function (res) {
            myMap.geoObjects.add(res.geoObjects);
            // Optionally set bounds based on constructor objects
            if (res.geoObjects.getBounds()) {
                myMap.setBounds(res.geoObjects.getBounds(), { checkZoomRange: true });
            }
        })
        .catch(function (err) {
            console.warn("Could not load constructor map", err);
        });

    // Load CSV Points
    Papa.parse(stationsData, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            const data = results.data;
            addPointsToMap(data, myMap);
        }
    });
}

function addPointsToMap(stations, map) {
    const clusterer = new ymaps.Clusterer({
        preset: 'islands#nightClusterIcons', // sleek dark cluster preset
        groupByCoordinates: false,
        clusterDisableClickZoom: false,
        clusterHideIconOnBalloonOpen: false,
        geoObjectHideIconOnBalloonOpen: false
    });

    const geoObjects = [];

    stations.forEach(station => {
        if (!station.lat || !station.lng) return;

        const placemark = new ymaps.Placemark(
            [station.lat, station.lng], 
            {
                stationData: station
            }, 
            {
                preset: 'islands#blueCircleDotIcon', // premium looking dot
                cursor: 'pointer'
            }
        );

        placemark.events.add('click', function (e) {
            const st = e.get('target').properties.get('stationData');
            openInfoPanel(st);
            
            // Pan map to point
            map.panTo([st.lat, st.lng], {
                delay: 0,
                duration: 500
            });
        });

        geoObjects.push(placemark);
    });

    clusterer.add(geoObjects);
    map.geoObjects.add(clusterer);
    
    // Automatically center to markers if no constructor bounds were set
    if (geoObjects.length > 0) {
        map.setBounds(clusterer.getBounds(), {
            checkZoomRange: true,
            zoomMargin: 50
        });
    }
}

// UI Interactions
const infoPanel = document.getElementById('info-panel');
const closeBtn = document.getElementById('close-panel');

closeBtn.addEventListener('click', () => {
    infoPanel.classList.remove('visible');
});

function openInfoPanel(station) {
    document.getElementById('st-name').textContent = station.name || 'Неизвестная АЗС';
    document.getElementById('st-addr').textContent = station.address || 'Адрес не указан';
    
    const lat = parseFloat(station.lat).toFixed(6);
    const lng = parseFloat(station.lng).toFixed(6);
    document.getElementById('st-wgs').textContent = `${lat}, ${lng}`;

    const sk42 = convertToSk42(lat, lng);
    document.getElementById('st-sk42').textContent = `X: ${sk42.lat}, Y: ${sk42.lng}`;

    const gmapLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    document.getElementById('st-gmap-link').href = gmapLink;

    infoPanel.classList.add('visible');
}

// Copy functionality
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-copy-target');
        const text = document.getElementById(targetId).textContent;
        navigator.clipboard.writeText(text).then(() => {
            showToast();
        });
    });
});

let toastTimeout;
function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}
