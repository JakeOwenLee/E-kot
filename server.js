const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
const { Redis } = require('@upstash/redis');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let jeepLocations = {};

// Initialize Postgres (Supabase) if configured
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

// Initialize Upstash Redis if configured
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

async function persistToDb(locationData) {
  if (!pool) return;
  const { jeepId, latitude, longitude, timestamp, nearestStop } = locationData;
  await pool.query(
    `INSERT INTO positions (jeep_id, latitude, longitude, nearest_stop, ts)
     VALUES ($1, $2, $3, $4, to_timestamp($5/1000.0))`,
    [jeepId, latitude, longitude, nearestStop || null, timestamp || Date.now()]
  );
}

async function cacheToRedis(locationData) {
  if (!redis) return;
  const key = `pos:${locationData.jeepId}`;
  await redis.hset(key, {
    jeepId: locationData.jeepId,
    latitude: String(locationData.latitude),
    longitude: String(locationData.longitude),
    nearestStop: locationData.nearestStop || '',
    timestamp: String(locationData.timestamp || Date.now())
  });
  await redis.expire(key, 60 * 10);
  await redis.sadd('jeeps', locationData.jeepId);
  await redis.publish('locationUpdate', JSON.stringify(locationData)).catch(() => {});
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', connectedClients: io.engine.clientsCount, db: !!pool, redis: !!redis });
});

app.post('/api/location/update', async (req, res) => {
  try {
    const { jeepId, latitude, longitude, timestamp, nearestStop } = req.body;
    if (!jeepId || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Invalid data: jeepId, latitude, and longitude required' });
    }

    const locationData = {
      jeepId,
      latitude,
      longitude,
      timestamp: timestamp || Date.now(),
      nearestStop: nearestStop || 'Unknown'
    };

    jeepLocations[jeepId] = locationData;

    persistToDb(locationData).catch(console.error);
    cacheToRedis(locationData).catch(console.error);

    io.emit('locationUpdate', locationData);
    res.status(200).json({ success: true, data: locationData });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/location/:jeepId', (req, res) => {
  const { jeepId } = req.params;
  const location = jeepLocations[jeepId];
  
  if (!location) {
    return res.status(404).json({ error: 'Jeep not found' });
  }
  
  res.json(location);
});

app.get('/api/locations', (req, res) => {
  res.json(jeepLocations);
});

// REST polling endpoint for latest positions
app.get('/positions', async (req, res) => {
  try {
    if (redis) {
      const jeepIds = await redis.smembers('jeeps');
      const keys = jeepIds.map(id => `pos:${id}`);
      const results = await Promise.all(keys.map(k => redis.hgetall(k)));
      const items = results.filter(Boolean).map(x => ({
        jeepId: x.jeepId,
        latitude: Number(x.latitude),
        longitude: Number(x.longitude),
        nearestStop: x.nearestStop || 'Unknown',
        timestamp: Number(x.timestamp)
      }));
      if (items.length > 0) return res.json({ items });
    }
    const items = Object.values(jeepLocations);
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not fetch positions' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.emit('initialLocations', jeepLocations);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://0.0.0.0:${PORT} to view the tracker`);
});
