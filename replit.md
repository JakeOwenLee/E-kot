# E-Kot: E-Jeep Tracker

## Overview
Real-time GPS tracking system for e-jeeps (electric jeepneys). Users can view jeeps moving on a map in real-time, see their routes, and find the nearest stops.

## Current State
Building MVP prototype - Phase 1: Core visualization

## Tech Stack
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML, CSS, JavaScript, Leaflet.js (maps)
- **Real-time**: Socket.IO WebSockets
- **Future**: Upstash Redis (location caching), PostgreSQL (trip history)

## Project Structure
```
/
├── server.js           # Express server + Socket.IO
├── public/            # Frontend files
│   ├── index.html     # Map interface
│   ├── style.css      # Styling
│   └── client.js      # Socket.IO client + map logic
├── simulator/         # GPS simulation
│   └── gps-sim.js     # Simulates jeep movement
└── routes/            # API routes (future)
```

## Recent Changes
- 2025-10-29: Initial project setup, installed Node.js and dependencies

## User Preferences
- Focus on functional MVP first, polish later
- All changes tracked in Git
- Will deploy to Render eventually
