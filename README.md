# E-Kot: E-Jeep Real-Time Tracker

Real-time GPS tracking system for ADMU campus e-jeeps using phone GPS.

## How It Works

1. **Phone = GPS Tracker**: Open the tracking page on a phone and allow GPS access
2. **Real-time Updates**: Phone sends GPS coordinates every few seconds
3. **Live Map**: Watch the e-jeep move on the map in real-time
4. **ADMU Campus Only**: Map is limited to campus boundaries

## Quick Start

### Step 1: Start the Server
```bash
npm install
npm start
```

Or set environment variables and then start:

```bash
# Required in production (optional locally)
# Windows PowerShell examples:
$env:DATABASE_URL = "postgres://USER:PASSWORD@HOST:PORT/DB"
$env:UPSTASH_REDIS_REST_URL = "https://<your-upstash-url>"
$env:UPSTASH_REDIS_REST_TOKEN = "<your-upstash-token>"
npm start
```

### Step 2: Track with Phone
On your phone, open:
```
http://YOUR_COMPUTER_IP:5000/track.html
```

Click "Start Tracking" and allow GPS access.

### Step 3: View the Map
On any device, open:
```
http://YOUR_COMPUTER_IP:5000
```

Watch the map update as the phone moves around campus!

### Database Table (PostgreSQL / Supabase)

Run this once to store trip points:

```sql
CREATE TABLE IF NOT EXISTS positions (
  id BIGSERIAL PRIMARY KEY,
  jeep_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  nearest_stop TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS positions_jeep_ts_idx ON positions(jeep_id, ts DESC);
```

When the phone (or any tracker) hits `POST /api/location/update`, the server:
- Emits a Socket.IO `locationUpdate` event for live UI updates
- Writes the point to PostgreSQL (`positions` table)
- Caches the latest point in Upstash Redis for quick reads and `/positions` REST

## Finding Your Computer's IP

**Mac/Linux:**
```bash
ifconfig | grep inet
```

**Windows:**
```bash
ipconfig
```

## Tech Stack

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: Leaflet.js + Geolocation API
- **Real-time**: WebSocket communication

## API Endpoint

**POST /api/location/update**
```json
{
  "jeepId": "PHONE-GPS",
  "latitude": 14.6394,
  "longitude": 121.0778,
  "timestamp": 1234567890
}
```

**POST /api/location/stop**

Body:
```json
{ "jeepId": "PHONE-GPS" }
```
Effect: removes the jeep from active tracking, clears cache, and emits `locationRemove` to clients.

**GET /positions**

Returns the latest known coordinates for active jeeps (from Redis cache, falling back to memory):

```json
{
  "items": [
    {
      "jeepId": "PHONE-GPS",
      "latitude": 14.6394,
      "longitude": 121.0778,
      "nearestStop": "Leong Hall E-Jeep Station",
      "timestamp": 1710000000000
    }
  ]
}
```

## Deployment

Ready to deploy to Render:
1. Push to GitHub
2. Connect to Render
3. Deploy!

Use the deployed URL on your phone for tracking from anywhere.

## UI Tabs

- Main map: `/` (ADMU map with ~5% expanded bounds, line A/B stops overlaid)
- Private tracker: `/track.html` (phone-only page to send GPS updates)

## License

ISC
