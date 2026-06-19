#include <Servo.h>
#include <EEPROM.h>
#include <Adafruit_NeoPixel.h>

Servo lockServo;

const int SERVO_PIN         = 9;
const int MOVE_DELAY        = 3800;
const int EEPROM_STATE_ADDR = 0;

const int SERVO_STOP        = 90;
const int SERVO_OPEN_DIR    = 180;
const int SERVO_CLOSE_DIR   = 0;

const int LED_PIN           = 6;
const int LED_COUNT         = 4;

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

bool isLocked = true;

void setLEDs(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < LED_COUNT; i++) {
    strip.setPixelColor(i, strip.Color(r, g, b));
  }
  strip.show();
}

// Vivid saturated versions of the app palette - pastels become white on LEDs.
// Amber (mustard), Cyan (teal), Hot-pink (coral/danger), Yellow.
// Each LED shows a different color; the assignment rotates every 100ms.
void animateTransition() {
  const uint8_t colors[4][3] = {
    {255, 140,   0},  // Amber   (mustard → vivid)
    {  0, 200, 230},  // Cyan    (teal → vivid)
    {255,  30,  90},  // Hot-pink (coral/danger → vivid)
    {255, 210,   0},  // Yellow  (mustard warm accent)
  };

  unsigned long start = millis();
  int step = 0;

  while (millis() - start < MOVE_DELAY) {
    for (int i = 0; i < LED_COUNT; i++) {
      int ci = (i + step) % 4;
      strip.setPixelColor(i, strip.Color(colors[ci][0], colors[ci][1], colors[ci][2]));
    }
    strip.show();
    delay(100);
    step++;
  }
}

void setup() {
  Serial.begin(9600);
  lockServo.attach(SERVO_PIN);
  lockServo.write(SERVO_STOP);

  strip.begin();
  strip.show();

  byte savedState = EEPROM.read(EEPROM_STATE_ADDR);
  if (savedState != 0 && savedState != 1) {
    savedState = 1;
  }

  isLocked = (savedState == 1);

  if (isLocked) {
    setLEDs(255, 0, 0);
  } else {
    setLEDs(0, 255, 0);
  }

  Serial.println(isLocked ? "STATE:LOCKED" : "STATE:UNLOCKED");
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command == "OPEN" && isLocked) {
      openLock();
    } else if (command == "CLOSE" && !isLocked) {
      closeLock();
    } else if (command == "STATUS") {
      Serial.println(isLocked ? "STATE:LOCKED" : "STATE:UNLOCKED");
    }
  }
}

void openLock() {
  lockServo.write(SERVO_OPEN_DIR);
  animateTransition();                  // Color chase while servo opens
  lockServo.write(SERVO_STOP);
  isLocked = false;
  EEPROM.update(EEPROM_STATE_ADDR, 0);
  setLEDs(0, 255, 0);                   // Green = open
  Serial.println("OPENED");
}

void closeLock() {
  lockServo.write(SERVO_CLOSE_DIR);
  animateTransition();                  // Color chase while servo closes
  lockServo.write(SERVO_STOP);
  isLocked = true;
  EEPROM.update(EEPROM_STATE_ADDR, 1);
  setLEDs(255, 0, 0);                   // Red = locked
  Serial.println("CLOSED");
}
