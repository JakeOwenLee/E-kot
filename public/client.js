const socket = io();

let map;
let jeepMarker = null;
let stopMarkers = [];
let pollTimer = null;
const POLL_MS = 5000;

function initMap() {
  map = L.map('map').setView([14.6394, 121.0778], 17);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  
  // Original campus bounds
  const orig = [
    [14.6350, 121.0700],
    [14.6500, 121.0850]
  ];
  // Expand by ~5%
  const latSpan = orig[1][0] - orig[0][0];
  const lonSpan = orig[1][1] - orig[0][1];
  const padLat = latSpan * 0.05;
  const padLon = lonSpan * 0.05;
  const bounds = [
    [orig[0][0] - padLat, orig[0][1] - padLon],
    [orig[1][0] + padLat, orig[1][1] + padLon]
  ];
  map.setMaxBounds(bounds);
  map.setMinZoom(16);
}

const STOP_ICON_A = L.divIcon({
  className: 'stop-icon-a',
  html: '<div style="background:#1976d2;color:#fff;padding:4px 8px;border-radius:12px;font-weight:600;box-shadow:0 1px 6px rgba(0,0,0,0.2)">A</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});
const STOP_ICON_B = L.divIcon({
  className: 'stop-icon-b',
  html: '<div style="background:#d32f2f;color:#fff;padding:4px 8px;border-radius:12px;font-weight:600;box-shadow:0 1px 6px rgba(0,0,0,0.2)">B</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function renderStops() {
  if (!window.STOPS) return;
  stopMarkers.forEach(m => m.remove());
  stopMarkers = [];

  const aLayer = L.layerGroup();
  const bLayer = L.layerGroup();

  (window.STOPS.lineA || []).forEach(s => {
    const m = L.marker(s.coords, { icon: STOP_ICON_A }).bindPopup(`<strong>${s.name}</strong>`);
    m.addTo(aLayer);
    stopMarkers.push(m);
  });
  (window.STOPS.lineB || []).forEach(s => {
    const m = L.marker(s.coords, { icon: STOP_ICON_B }).bindPopup(`<strong>${s.name}</strong>`);
    m.addTo(bLayer);
    stopMarkers.push(m);
  });

  aLayer.addTo(map);
  const polyA = L.polyline((window.STOPS.lineA || []).map(s => s.coords), { color: '#1976d2', weight: 3, opacity: 0.7 });
  const polyB = L.polyline((window.STOPS.lineB || []).map(s => s.coords), { color: '#d32f2f', weight: 3, opacity: 0.7 });
  polyA.addTo(map);
  L.control.layers(null, {
    'Line A Stops': aLayer,
    'Line B Stops': bLayer,
    'Line A Route': polyA,
    'Line B Route': polyB
  }, { collapsed: true }).addTo(map);
}

function haversineMeters([lat1, lon1], [lat2, lon2]) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestStopName(lat, lon) {
  if (!window.STOPS) return 'Unknown';
  let best = { name: 'Unknown', dist: Infinity };
  const all = [...(window.STOPS.lineA || []), ...(window.STOPS.lineB || [])];
  for (const s of all) {
    const d = haversineMeters([lat, lon], s.coords);
    if (d < best.dist) best = { name: s.name, dist: d };
  }
  return best.name;
}

function updateUI(data) {
  document.getElementById('jeep-id').textContent = data.jeepId;
  document.getElementById('status').textContent = 'Tracking Active';
  document.getElementById('status').className = 'value status-active';
  const lat = data.latitude;
  const lon = data.longitude;
  document.getElementById('current-location').textContent = 
    `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  const nearest = data.nearestStop && data.nearestStop !== 'Unknown'
    ? data.nearestStop
    : nearestStopName(lat, lon);
  document.getElementById('nearest-stop').textContent = nearest;
  
  const updateTime = new Date(data.timestamp);
  document.getElementById('last-update').textContent = updateTime.toLocaleTimeString();
}

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('initialLocations', (locations) => {
  console.log('Initial locations:', locations);
  const jeepIds = Object.keys(locations);
  if (jeepIds.length > 0) {
    const firstJeep = locations[jeepIds[0]];
    
    if (!jeepMarker) {
      const jeepIcon = L.divIcon({
        className: 'jeep-icon',
        html: '<div style="background: #4caf50; color: white; padding: 8px 12px; border-radius: 20px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">🚐 E-JEEP</div>',
        iconSize: [80, 30],
        iconAnchor: [40, 15]
      });
      
      jeepMarker = L.marker([firstJeep.latitude, firstJeep.longitude], { icon: jeepIcon }).addTo(map);
      jeepMarker.bindPopup('<strong>Live GPS Tracking</strong>');
    } else {
      jeepMarker.setLatLng([firstJeep.latitude, firstJeep.longitude]);
    }
    
    map.setView([firstJeep.latitude, firstJeep.longitude], 17);
    updateUI(firstJeep);
  }
});

socket.on('locationUpdate', (data) => {
  console.log('Location update:', data);
  
  const newLatLng = [data.latitude, data.longitude];
  
  if (!jeepMarker) {
    const jeepIcon = L.divIcon({
      className: 'jeep-icon',
      html: '<div style="background: #4caf50; color: white; padding: 8px 12px; border-radius: 20px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">🚐 E-JEEP</div>',
      iconSize: [80, 30],
      iconAnchor: [40, 15]
    });
    
    jeepMarker = L.marker(newLatLng, { icon: jeepIcon }).addTo(map);
    jeepMarker.bindPopup('<strong>Live GPS Tracking</strong>');
  } else {
    jeepMarker.setLatLng(newLatLng);
  }
  
  map.panTo(newLatLng);
  
  updateUI(data);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  document.getElementById('status').textContent = 'Disconnected';
  document.getElementById('status').className = 'value status-waiting';
  startPolling();
});

async function pollPositions() {
  try {
    const res = await fetch('/positions');
    if (!res.ok) return;
    const body = await res.json();
    const items = body.items || [];
    if (items.length > 0) {
      const d = items[0];
      const newLatLng = [d.latitude, d.longitude];
      if (!jeepMarker) {
        const jeepIcon = L.divIcon({
          className: 'jeep-icon',
          html: '<div style="background: #4caf50; color: white; padding: 8px 12px; border-radius: 20px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">🚐 E-JEEP</div>',
          iconSize: [80, 30],
          iconAnchor: [40, 15]
        });
        jeepMarker = L.marker(newLatLng, { icon: jeepIcon }).addTo(map);
        jeepMarker.bindPopup('<strong>Live GPS Tracking</strong>');
      } else {
        jeepMarker.setLatLng(newLatLng);
      }
      map.panTo(newLatLng);
      updateUI(d);
    }
  } catch (_) {}
}

function startPolling() {
  if (pollTimer) return;
  document.getElementById('status').textContent = 'Polling...';
  document.getElementById('status').className = 'value status-waiting';
  pollTimer = setInterval(pollPositions, POLL_MS);
  pollPositions();
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

initMap();
renderStops();
