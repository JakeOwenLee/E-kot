const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000';

const route = [
  { lat: 14.6393, lng: 121.0778, stop: 'AGS (Gate 1)' },
  { lat: 14.6405, lng: 121.0770, stop: 'Along Campus Road' },
  { lat: 14.6420, lng: 121.0755, stop: 'G2.5 (JSEC)' },
  { lat: 14.6435, lng: 121.0745, stop: 'Heading to Red Brick Road' },
  { lat: 14.6450, lng: 121.0738, stop: 'Leong Hall Area' },
  { lat: 14.6465, lng: 121.0732, stop: 'Approaching Xavier Hall' },
  { lat: 14.6478, lng: 121.0728, stop: 'Xavier Hall' },
  { lat: 14.6485, lng: 121.0720, stop: 'End of Red Brick Road' },
  { lat: 14.6475, lng: 121.0715, stop: 'Turning towards Old Comm' },
  { lat: 14.6460, lng: 121.0710, stop: 'Old Communications Building' },
  { lat: 14.6445, lng: 121.0720, stop: 'Heading to LHS' },
  { lat: 14.6430, lng: 121.0735, stop: 'LHS Area' },
  { lat: 14.6415, lng: 121.0750, stop: 'Returning to AGS' },
  { lat: 14.6400, lng: 121.0765, stop: 'Near Gate 1' }
];

let currentIndex = 0;
let isRunning = false;
const JEEP_ID = 'EJEEP-001';
const UPDATE_INTERVAL = 3000;

function interpolate(start, end, factor) {
  return start + (end - start) * factor;
}

async function sendLocationUpdate(lat, lng, nearestStop) {
  try {
    const response = await axios.post(`${API_URL}/api/location/update`, {
      jeepId: JEEP_ID,
      latitude: lat,
      longitude: lng,
      timestamp: Date.now(),
      nearestStop: nearestStop
    });
    
    console.log(`📍 Location sent: ${lat.toFixed(6)}, ${lng.toFixed(6)} - Near: ${nearestStop}`);
    return response.data;
  } catch (error) {
    console.error('Error sending location:', error.message);
  }
}

async function simulateMovement() {
  if (currentIndex >= route.length - 1) {
    currentIndex = 0;
    console.log('🔄 Route completed, restarting...\n');
  }
  
  const start = route[currentIndex];
  const end = route[currentIndex + 1];
  const steps = 10;
  
  for (let i = 0; i <= steps; i++) {
    if (!isRunning) break;
    
    const factor = i / steps;
    const lat = interpolate(start.lat, end.lat, factor);
    const lng = interpolate(start.lng, end.lng, factor);
    
    const nearestStop = factor < 0.5 ? start.stop : end.stop;
    
    await sendLocationUpdate(lat, lng, nearestStop);
    
    if (i < steps) {
      await new Promise(resolve => setTimeout(resolve, UPDATE_INTERVAL));
    }
  }
  
  currentIndex++;
  
  if (isRunning) {
    setTimeout(simulateMovement, UPDATE_INTERVAL);
  }
}

async function start() {
  console.log('🚐 E-Jeep GPS Simulator Starting...');
  console.log('📍 Route: AGS → G2.5 → Leong Hall → Xavier Hall → Old Comm → LHS → AGS');
  console.log(`📡 Target API: ${API_URL}`);
  console.log(`🆔 Jeep ID: ${JEEP_ID}`);
  console.log(`⏱️  Update Interval: ${UPDATE_INTERVAL}ms\n`);
  
  try {
    const healthCheck = await axios.get(`${API_URL}/api/health`);
    console.log('✅ Server is reachable:', healthCheck.data);
  } catch (error) {
    console.log('⚠️  Warning: Could not reach server. Proceeding anyway...');
  }
  
  isRunning = true;
  await simulateMovement();
}

function stop() {
  console.log('\n🛑 Stopping GPS simulator...');
  isRunning = false;
}

process.on('SIGINT', () => {
  stop();
  process.exit(0);
});

if (require.main === module) {
  start();
}

module.exports = { start, stop };
