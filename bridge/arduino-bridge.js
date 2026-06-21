// ===========================================================================
// bridge/arduino-bridge.js  -  GrabIt Renting System
// ===========================================================================
// Node.js Express server that relays HTTP commands from Flask to the Arduino
// via serial communication.

const express = require("express");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const app = express();
app.use(express.json());

const HTTP_PORT   = 5001;
const MAIN_SERVER = "http://localhost:5000"; // Flask server
const ARDUINO_COM = "COM5";

// ===========================================================================
// Serial Connection
// ===========================================================================

const arduino = new SerialPort({ path: ARDUINO_COM, baudRate: 9600, autoOpen: false });
const parser  = arduino.pipe(new ReadlineParser({ delimiter: "\n" }));

// Internal state mirror — kept in sync with every Arduino message
// null = unknown (bridge just started, Arduino not yet connected)
let currentState  = null;  // 'open' | 'closed' | null
let isConnecting  = false; // true while arduino.open() is in-flight

function connectArduino() {
  // Guard against both "already open" and "open() call in-flight".
  // arduino.isOpen is false while open() is pending, so without isConnecting
  // two concurrent callers would both call arduino.open() simultaneously.
  if (arduino.isOpen || isConnecting) return;
  isConnecting = true;
  arduino.open((err) => {
    isConnecting = false;
    if (err) {
      console.log("Arduino not connected:", err.message, "— retrying in 3s");
      setTimeout(connectArduino, 3000);
      return;
    }
    console.log("Arduino connected on " + ARDUINO_COM);
  });
}

arduino.on("close", () => {
  console.log("Arduino disconnected — retrying in 3s");
  isConnecting = false; // reset in case close fires while open was in-flight
  setTimeout(connectArduino, 3000);
});

connectArduino();

// ===========================================================================
// Parse Arduino Messages
// ===========================================================================
//
// Arduino vocabulary:
//   STATE:UNLOCKED  → sent on boot (locker is open)
//   STATE:LOCKED    → sent on boot (locker is closed)
//   OPENED          → sent after physically opening
//   CLOSED          → sent after physically closing

parser.on("data", async (line) => {
  const msg = line.trim().toUpperCase();
  console.log("Arduino →", msg);

  let status = null;

  if (msg === "OPENED" || msg === "STATE:UNLOCKED") {
    currentState = "open";
    status = "open";
  } else if (msg === "CLOSED" || msg === "STATE:LOCKED") {
    currentState = "closed";
    status = "closed";
  }

  // STATE:* on boot → just update local state, no pending request on main server
  // OPENED / CLOSED  → signal the main server so it can resolve the long-poll
  if (msg !== "OPENED" && msg !== "CLOSED") return;

  if (!status) return;

  try {
    const r = await fetch(`${MAIN_SERVER}/api/locker/callback`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    console.log(`Callback → main server: status=${status} (HTTP ${r.status})`);
  } catch (err) {
    console.error("Could not reach main server:", err.message);
  }
});

// ===========================================================================
// HTTP Endpoints
// ===========================================================================

app.post("/api/locker/open", (req, res) => {
  if (!arduino.isOpen) {
    return res.status(500).json({ error: "Arduino not connected" });
  }

  // Arduino ignores OPEN when already open → resolve immediately so main server
  // doesn't wait 30 seconds for a callback that will never arrive.
  if (currentState === "open") {
    console.log("Already open — skipping OPEN command");
    return res.json({ ok: true, alreadyInState: true, status: "open" });
  }

  arduino.write("OPEN\n");
  console.log("OPEN sent to Arduino");
  res.json({ ok: true });
});

app.post("/api/locker/close", (req, res) => {
  if (!arduino.isOpen) {
    return res.status(500).json({ error: "Arduino not connected" });
  }

  if (currentState === "closed") {
    console.log("Already closed — skipping CLOSE command");
    return res.json({ ok: true, alreadyInState: true, status: "closed" });
  }

  arduino.write("CLOSE\n");
  console.log("CLOSE sent to Arduino");
  res.json({ ok: true });
});

// Optional: query current state without sending a command
app.get("/api/locker/status", (req, res) => {
  if (!arduino.isOpen) {
    return res.status(500).json({ error: "Arduino not connected" });
  }
  arduino.write("STATUS\n");
  // currentState will be updated when Arduino replies STATE:*
  res.json({ currentState });
});

app.listen(HTTP_PORT, () => {
  console.log("Arduino bridge running on http://localhost:" + HTTP_PORT);
});
