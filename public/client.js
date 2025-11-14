const socket = io();

let map;
let jeepMarkers = {}; // jeepId -> marker
let stopMarkers = [];
let pollTimer = null;
const POLL_MS = 5000;

function initMap() {
  map = L.map('map').setView([14.6394, 121.0778], 17);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  
  // Expanded bounds covering ADMU → Arton Rockwell → UP Town Center
  const bounds = [
    [14.6200, 121.0550], // SW
    [14.6700, 121.1000]  // NE
  ];
  map.setMaxBounds(bounds);
  map.setMinZoom(14);
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

  (window.STOPS.lineA || []).forEach(s => {
    const m = L.marker(s.coords, { icon: STOP_ICON_A }).bindPopup(`<strong>${s.name}</strong>`);
    m.addTo(map);
    stopMarkers.push(m);
  });
  (window.STOPS.lineB || []).forEach(s => {
    const m = L.marker(s.coords, { icon: STOP_ICON_B }).bindPopup(`<strong>${s.name}</strong>`);
    m.addTo(map);
    stopMarkers.push(m);
  });
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
  const lineA = window.STOPS.lineA || [];
  const lineB = window.STOPS.lineB || [];

  function nearest(list) {
    let best = { name: 'Unknown', dist: Infinity };
    for (const s of list) {
      const d = haversineMeters([lat, lon], s.coords);
      if (d < best.dist) best = { name: s.name, dist: d };
    }
    return best;
  }

  const a = nearest(lineA);
  if (a.dist !== Infinity) return a.name;
  const b = nearest(lineB);
  return b.name;
}

function updateUI(data) {
  document.getElementById('jeep-id').textContent = data.jeepId;
  document.getElementById('status').textContent = 'Tracking Active';
  document.getElementById('status').className = 'value status-active';
  const lat = data.latitude;
  const lon = data.longitude;
  document.getElementById('current-location').textContent = 
    `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  const nearest = (data.nearestStop && data.nearestStop !== 'Unknown' && data.nearestStop !== 'Phone GPS')
    ? data.nearestStop
    : nearestStopName(lat, lon);
  document.getElementById('nearest-stop').textContent = nearest;
  
  const updateTime = new Date(data.timestamp);
  document.getElementById('last-update').textContent = updateTime.toLocaleTimeString();
}

socket.on('connect', () => {
  console.log('Connected to server');
});

function buildJeepIcon(labelNumber) {
  const number = labelNumber || 1;
  const html = `
    <div style="position:relative;width:28px;height:28px;border-radius:50%;background-image:url('img/ejeep-logo.png');background-size:cover;background-position:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
      <div style="position:absolute;top:-6px;right:-6px;background:#003a6c;color:#fff;width:18px;height:18px;border-radius:50%;font-size:11px;display:flex;align-items:center;justify-content:center;border:1px solid #fff;">${number}</div>
    </div>`;
  return L.divIcon({ className: 'jeep-badge-icon', html, iconSize: [28, 28], iconAnchor: [14, 14] });
}

socket.on('initialLocations', (locations) => {
  const ids = Object.keys(locations);
  ids.forEach((id, idx) => {
    const d = locations[id];
    const icon = buildJeepIcon(idx + 1);
    const marker = L.marker([d.latitude, d.longitude], { icon }).addTo(map);
    jeepMarkers[id] = marker;
    if (idx === 0) {
      map.setView([d.latitude, d.longitude], 17);
      updateUI(d);
    }
  });
});

socket.on('locationUpdate', (data) => {
  const id = data.jeepId;
  const pos = [data.latitude, data.longitude];
  if (!jeepMarkers[id]) {
    const icon = buildJeepIcon(1);
    jeepMarkers[id] = L.marker(pos, { icon }).addTo(map);
  } else {
    jeepMarkers[id].setLatLng(pos);
  }
  updateUI(data);
});

socket.on('locationRemove', ({ jeepId }) => {
  const marker = jeepMarkers[jeepId];
  if (marker) {
    marker.remove();
    delete jeepMarkers[jeepId];
  }
  const remainingIds = Object.keys(jeepMarkers);
  if (remainingIds.length === 0) {
    document.getElementById('jeep-id').textContent = '-';
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Waiting for GPS data...';
    statusEl.className = 'value status-waiting';
    document.getElementById('current-location').textContent = '-';
    document.getElementById('nearest-stop').textContent = '-';
    document.getElementById('last-update').textContent = '-';
  }
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
