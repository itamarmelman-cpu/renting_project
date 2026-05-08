ESP32 MicroPython locker controller
=================================

Quick steps
-----------

1. Edit `/esp32/main.py` and set `WIFI_SSID` and `WIFI_PASSWORD`.
2. Connect your ESP32 to your computer and use `mpremote` (recommended) or Thonny/ampy to copy the file:

   mpremote connect /dev/ttyUSB0 fs cp esp32/main.py :/main.py

3. Reboot the ESP32. It will connect to Wi‑Fi and start an HTTP server on port 80.
4. Find the device IP (printed in the REPL or router DHCP list) and update `ESP32_BASE_URL` in `app.js` to `http://<ESP32_IP>`.

Test endpoints from your computer:

  curl -X POST http://<ESP32_IP>/api/locker/open
  curl -X POST http://<ESP32_IP>/api/locker/close
  curl http://<ESP32_IP>/api/locker/status

Notes
-----
- Adjust `SERVO_PIN`, `OPEN_ANGLE` and `CLOSED_ANGLE` to match your wiring and mechanics.
- If your board uses a different MicroPython build you may need to adapt PWM calls (`duty` vs `duty_u16`).
- For development you can also run a simple Python mock server on your computer and point `ESP32_BASE_URL` to `http://localhost:5001`.
