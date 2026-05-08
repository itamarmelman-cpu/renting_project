"""
Simple MicroPython HTTP server for ESP32 to control a servo locker.

Configure `WIFI_SSID` and `WIFI_PASSWORD` below, copy this file to the ESP32
as `/main.py` and reboot. The server exposes these endpoints:
  - POST /api/locker/open   -> moves servo to OPEN position
  - POST /api/locker/close  -> moves servo to CLOSED position
  - GET  /api/locker/status -> returns JSON with `open: true|false`

Test from your computer:
  curl -X POST http://<ESP32_IP>/api/locker/open
  curl -X POST http://<ESP32_IP>/api/locker/close
  curl http://<ESP32_IP>/api/locker/status

Notes:
 - This is written for MicroPython on ESP32. Adjust the `SERVO_PIN` if needed.
 - Tune `OPEN_ANGLE` and `CLOSED_ANGLE` to match your mechanical setup.
"""

import network
import socket
import machine
import time
import ujson as json

# --- Configuration (edit before deploying) ---
WIFI_SSID = 'YOUR_WIFI_SSID'
WIFI_PASSWORD = 'YOUR_WIFI_PASSWORD'

# GPIO pin where the servo signal line is connected
SERVO_PIN = 15

# Servo angles (degrees). Tune to your hardware.
OPEN_ANGLE = 90
CLOSED_ANGLE = 0

# PWM frequency for hobby servo
PWM_FREQ = 50

# How long to hold the servo after move (seconds)
HOLD_TIME = 0.8

# --- End configuration ---


def connect_wifi(ssid, password, timeout=15):
    wlan = network.WLAN(network.STA_IF)
    if not wlan.active():
        wlan.active(True)
    if wlan.isconnected():
        return wlan

    wlan.connect(ssid, password)
    start = time.time()
    while not wlan.isconnected():
        if time.time() - start > timeout:
            raise RuntimeError('WiFi connection timed out')
        time.sleep(0.5)
    return wlan


class Servo:
    def __init__(self, pin_no, freq=PWM_FREQ):
        pin = machine.Pin(pin_no)
        self.pwm = machine.PWM(pin, freq=freq)
        # On ESP32, duty 0-1023. We'll map pulse widths (0.5-2.5 ms) -> duty.
        self._min_us = 500
        self._max_us = 2500
        self._period_us = int(1e6 / freq)
        self.open = False

    def angle_to_duty(self, angle):
        # angle: 0..180
        pulse_us = self._min_us + (angle / 180.0) * (self._max_us - self._min_us)
        duty = int((pulse_us / self._period_us) * 1023)
        # clamp
        if duty < 0:
            duty = 0
        if duty > 1023:
            duty = 1023
        return duty

    def move_to(self, angle):
        duty = self.angle_to_duty(angle)
        try:
            self.pwm.duty(duty)
        except Exception:
            # Some MicroPython builds use duty_u16; try that fallback
            try:
                self.pwm.duty_u16(int(duty * 64))
            except Exception:
                pass


def http_response(conn, status=200, content_type='application/json', body=None):
    if body is None:
        body = ''
    if isinstance(body, (dict, list)):
        body = json.dumps(body)

    resp = 'HTTP/1.1 {} OK\r\n'.format(status)
    resp += 'Content-Type: {}\r\n'.format(content_type)
    resp += 'Content-Length: {}\r\n'.format(len(body))
    resp += 'Connection: close\r\n\r\n'
    conn.send(resp.encode('utf-8'))
    if body:
        conn.send(body.encode('utf-8'))


def run_server(servo):
    addr = socket.getaddrinfo('0.0.0.0', 80)[0][-1]
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(addr)
    s.listen(5)
    print('Listening on', addr)

    while True:
        try:
            conn, addr = s.accept()
            conn.settimeout(3.0)
            req = b''
            try:
                req = conn.recv(1024)
            except Exception:
                pass
            if not req:
                conn.close()
                continue

            try:
                first_line = req.split(b'\r\n', 1)[0].decode()
                method, path, _ = first_line.split(' ')
            except Exception:
                conn.close()
                continue

            # POST /api/locker/open
            if path.startswith('/api/locker/open') and method == 'POST':
                servo.move_to(OPEN_ANGLE)
                time.sleep(HOLD_TIME)
                # Optionally stop PWM or set to neutral
                servo.open = True
                http_response(conn, 200, body={'status': 'ok', 'command': 'open'})
                conn.close()
                continue

            if path.startswith('/api/locker/close') and method == 'POST':
                servo.move_to(CLOSED_ANGLE)
                time.sleep(HOLD_TIME)
                servo.open = False
                http_response(conn, 200, body={'status': 'ok', 'command': 'close'})
                conn.close()
                continue

            if path.startswith('/api/locker/status') and method == 'GET':
                http_response(conn, 200, body={'open': bool(servo.open)})
                conn.close()
                continue

            # default 404
            http_response(conn, 404, body={'error': 'not found'})
            conn.close()

        except Exception as e:
            try:
                conn.close()
            except Exception:
                pass


def main():
    print('Starting locker controller...')
    try:
        wlan = connect_wifi(WIFI_SSID, WIFI_PASSWORD)
        print('Connected to WiFi, IP:', wlan.ifconfig()[0])
    except Exception as e:
        print('WiFi connect failed:', e)
        # still start server on network interface if available

    servo = Servo(SERVO_PIN)
    # initialize to closed
    servo.move_to(CLOSED_ANGLE)
    run_server(servo)


if __name__ == '__main__':
    main()
