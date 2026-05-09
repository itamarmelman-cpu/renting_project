# AguGo Locker System

AguGo is a smart locker rental and return system for student equipment. The project combines a browser-based frontend, a Node.js/Express backend with SQLite, and an ESP32 MicroPython locker controller.

## Project Structure

- `frontend/` - Single-page web app, styles, and assets
- `backend/` - Express server and SQLite initialization script
- `esp32/` - MicroPython firmware for the physical locker controller
- `mock_esp32/` - Local mock server for testing without hardware
- `data/seed-data.json` - Legacy seed data used to initialize SQLite

## Requirements

- Node.js 18+
- npm
- SQLite is bundled through the `sqlite3` package
- Optional: ESP32 running MicroPython

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the backend and frontend:

   ```bash
   npm start
   ```

3. Open the app in your browser:

   - http://localhost:3000/

## Optional Local Hardware Simulation

If you do not have the ESP32 connected, run the mock locker server:

```bash
python3 mock_esp32/mock_server.py
```

The frontend uses `http://localhost:5001` by default for locker open/close requests during local development.

## Database Initialization

To create or refresh the SQLite database from the seed data:

```bash
node backend/init-db.js
```

This generates `app.db` in the project root.

## Main Endpoints

- `GET /api/ping`
- `GET /api/inventory`
- `POST /api/inventory`
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id`
- `GET /api/returns`
- `POST /api/returns`
- `GET /api/stats`

## ESP32 Firmware

The file `esp32/main.py` exposes these locker endpoints on the device:

- `POST /api/locker/open`
- `POST /api/locker/close`
- `GET /api/locker/status`

See `esp32/README.md` for deployment notes.