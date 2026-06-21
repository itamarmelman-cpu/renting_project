"""
===========================================================================
lock/controller.py  -  GrabIt Renting System
===========================================================================
Locker control - Python HTTP client that delegates to the
Node.js Arduino bridge running on localhost:5001.

  - Try to reach the bridge with a 3-second timeout
  - If bridge unreachable → return mocked response immediately
  - If bridge says alreadyInState → return current state immediately
  - Otherwise → wait up to 30 seconds for /api/locker/callback to fire

The serial communication and Arduino protocol are handled in
bridge/arduino-bridge.js (Node.js).
"""

from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from typing import Optional

BRIDGE_URL   = "http://localhost:5001"
BRIDGE_TIMEOUT_S  = 3    # seconds to wait for bridge connection
LOCKER_WAIT_S     = 30   # seconds to wait for hardware callback


class LockerController:
    """
    Manages open/close requests to the Arduino bridge.
    Thread-safe: multiple concurrent requests for different commands are
    supported (one pending event per command direction).
    """

    def __init__(self):
        self._pending: dict[str, Optional[threading.Event]] = {
            "open":  None,
            "close": None,
        }
        self._result: dict[str, Optional[dict]] = {
            "open":  None,
            "close": None,
        }
        self._lock = threading.Lock()

    # ===========================================================================
    # Public API
    # ===========================================================================

    def request(self, command: str) -> dict:
        """
        Send open or close command.  Returns a dict ready for jsonify():
          {"status": "open"|"closed"}
          {"status": ..., "mocked": True}
          {"status": ..., "timedOut": True}
        """
        if command not in ("open", "close"):
            raise ValueError(f"Invalid locker command: {command!r}")

        bridge_response = self._call_bridge(command)

        # Bridge unreachable → mock mode
        if bridge_response is None:
            return {"status": "open" if command == "open" else "closed", "mocked": True}

        # Bridge says already in desired state
        if bridge_response.get("alreadyInState"):
            return {"status": bridge_response["status"]}

        # Wait for hardware callback (bridge POSTs to /api/locker/callback)
        event = threading.Event()
        with self._lock:
            self._pending[command] = event
            self._result[command]  = None

        timed_out = not event.wait(timeout=LOCKER_WAIT_S)

        with self._lock:
            self._pending[command] = None
            result = self._result[command]

        if timed_out:
            return {"status": "open" if command == "open" else "closed", "timedOut": True}

        return result or {"status": "open" if command == "open" else "closed"}

    def handle_callback(self, status: str) -> bool:
        """
        Called by Flask when the bridge POSTs /api/locker/callback.
        Resolves the waiting Event.  Returns True if a pending request existed.
        """
        if status not in ("open", "closed"):
            return False

        command = "open" if status == "open" else "close"
        with self._lock:
            event = self._pending.get(command)
            if event is None:
                return False
            self._result[command] = {"status": status}
            event.set()
        return True

    # ===========================================================================
    # Internal
    # ===========================================================================

    def _call_bridge(self, command: str) -> Optional[dict]:
        """
        POST to the Node.js bridge at localhost:5001.
        Returns the parsed JSON response, or None if the bridge is unreachable.
        """
        url     = f"{BRIDGE_URL}/api/locker/{command}"
        payload = json.dumps({"command": command}).encode()
        req     = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=BRIDGE_TIMEOUT_S) as resp:
                return json.loads(resp.read())
        except (urllib.error.URLError, OSError):
            return None
