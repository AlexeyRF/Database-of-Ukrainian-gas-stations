proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

let borderFeaturesRF = [];
let borderFeaturesBY = [];
let borderFeaturesIR = [];

function loadBorders(url, targetArray) {
    fetch(url)
        .then(res => res.json())
        .then(coords => {
            if (!coords || coords.length === 0) return;
            // The JSON contains polygon coords or multipolygon coords
            // For safety, let's wrap it correctly
            let multiPoly;
            try {
                multiPoly = turf.multiPolygon(coords);
            } catch(e) {
                // If it fails, it might be a single polygon
                multiPoly = turf.polygon(coords);
            }
            const lines = turf.polygonToLine(multiPoly);
            if (lines.type === 'FeatureCollection') {
                targetArray.push(...lines.features);
            } else {
                targetArray.push(lines);
            }
        })
        .catch(e => console.error("Error loading " + url + ":", e));
}

loadBorders('russian_polygons.json', borderFeaturesRF);
loadBorders('belarus_polygons.json', borderFeaturesBY);
loadBorders('iran_polygons.json', borderFeaturesIR);

function getDistanceToLines(pt, linesArr) {
    if (!linesArr || linesArr.length === 0) return null;
    let minDistance = Infinity;
    linesArr.forEach(line => {
        try {
            const dist = turf.pointToLineDistance(pt, line, {units: 'kilometers'});
            if (dist < minDistance) {
                minDistance = dist;
            }
        } catch (e) {
            // Ignore geometry errors
        }
    });
    return minDistance === Infinity ? null : minDistance;
}

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
        return { lat: "Помилка", lng: "Помилка" };
    }
}

ymaps.ready(init);

const categoryStyles = {
    'lun_gas_stations': '#f59e0b',
    'osm_gas_stations': '#fbbf24',
    'osm_factories': '#ef4444',
    'osm_railway_stations': '#3b82f6',
    'osm_substations': '#8b5cf6',
    'osm_logistics': '#10b981'
};

let myMap;
const layerGroups = {};

function init() {
    myMap = new ymaps.Map('map', {
        center: [49.0, 31.0],
        zoom: 6,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    if (typeof compiledDatasets !== 'undefined') {
        for (const [key, points] of Object.entries(compiledDatasets)) {
            
            const clusterer = new ymaps.Clusterer({
                clusterIconColor: categoryStyles[key] || '#3b82f6',
                groupByCoordinates: false,
                clusterDisableClickZoom: false,
                clusterHideIconOnBalloonOpen: false,
                geoObjectHideIconOnBalloonOpen: false
            });

            const geoObjects = [];
            points.forEach(p => {
                if(p.lat && p.lng) {
                    const placemark = new ymaps.Placemark(
                        [p.lat, p.lng],
                        {
                            pointData: p
                        },
                        {
                            preset: 'islands#circleDotIcon',
                            iconColor: categoryStyles[key] || '#ffffff',
                            cursor: 'pointer'
                        }
                    );
                    
                    placemark.events.add('click', function (e) {
                        openInfoPanel(p);
                        myMap.panTo([p.lat, p.lng], { delay: 0, duration: 500 });
                    });
                    
                    geoObjects.push(placemark);
                }
            });
            
            clusterer.add(geoObjects);
            layerGroups[key] = clusterer;
        }
    }
    
    // Checkbox logic
    const checkboxes = document.querySelectorAll('.layer-controls input[type="checkbox"]');

    function updateLayers() {
        checkboxes.forEach(cb => {
            const key = cb.value;
            if (layerGroups[key]) {
                if (cb.checked) {
                    if (myMap.geoObjects.indexOf(layerGroups[key]) === -1) {
                        myMap.geoObjects.add(layerGroups[key]);
                    }
                } else {
                    if (myMap.geoObjects.indexOf(layerGroups[key]) !== -1) {
                        myMap.geoObjects.remove(layerGroups[key]);
                    }
                }
            }
        });
    }

    checkboxes.forEach(cb => cb.addEventListener('change', updateLayers));
    updateLayers();
}

// UI Interactions
const infoPanel = document.getElementById('info-panel');
const closeBtn = document.getElementById('close-panel');

closeBtn.addEventListener('click', () => {
    infoPanel.classList.remove('visible');
});

function openInfoPanel(point) {
    document.getElementById('st-name').textContent = point.name || 'Об\'єкт без назви';
    
    const lat = parseFloat(point.lat).toFixed(6);
    const lng = parseFloat(point.lng).toFixed(6);
    document.getElementById('st-coords').textContent = `${lat}, ${lng}`;

    const sk42 = convertToSk42(lat, lng);
    document.getElementById('st-sk42').textContent = `X: ${sk42.lat}, Y: ${sk42.lng}`;

    const gmapLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    document.getElementById('st-gmap-link').href = gmapLink;

    const pt = turf.point([parseFloat(lng), parseFloat(lat)]);
    const tiraspolPt = turf.point([29.6267, 46.8364]);

    const distRF = getDistanceToLines(pt, borderFeaturesRF);
    const distBY = getDistanceToLines(pt, borderFeaturesBY);
    const distIR = getDistanceToLines(pt, borderFeaturesIR);
    const distTiraspol = turf.distance(pt, tiraspolPt, {units: 'kilometers'});

    document.getElementById('st-distance').textContent = distRF !== null ? distRF.toFixed(2) + ' км' : 'Дані не завантажено';
    document.getElementById('st-dist-belarus').textContent = distBY !== null ? distBY.toFixed(2) + ' км' : 'Дані не завантажено';
    
    if (distRF !== null && distBY !== null) {
        document.getElementById('st-dist-rf-by').textContent = Math.min(distRF, distBY).toFixed(2) + ' км';
    } else if (distRF !== null) {
        document.getElementById('st-dist-rf-by').textContent = distRF.toFixed(2) + ' км';
    } else if (distBY !== null) {
        document.getElementById('st-dist-rf-by').textContent = distBY.toFixed(2) + ' км';
    } else {
        document.getElementById('st-dist-rf-by').textContent = 'Дані не завантажено';
    }

    document.getElementById('st-dist-iran').textContent = distIR !== null ? distIR.toFixed(2) + ' км' : 'Дані не завантажено';
    document.getElementById('st-dist-tiraspol').textContent = distTiraspol.toFixed(2) + ' км';
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
