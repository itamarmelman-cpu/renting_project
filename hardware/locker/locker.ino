#include <Servo.h>
#include <EEPROM.h>
#include <Adafruit_NeoPixel.h>

Servo lockServo;

const int SERVO_PIN         = 9;
const int MOVE_DELAY        = 5000;
const int EEPROM_STATE_ADDR = 0;

const int SERVO_STOP        = 90;
const int SERVO_OPEN_DIR    = 180;  // Continuous rotation - open direction
const int SERVO_CLOSE_DIR   = 0;    // Continuous rotation - close direction

const int LED_PIN           = 6;    // Data pin for HV-2812-4
const int LED_COUNT         = 4;    // 4 LEDs on the HV-2812-4

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

bool isLocked = true;

void setLEDs(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < LED_COUNT; i++) {
    strip.setPixelColor(i, strip.Color(r, g, b));
  }
  strip.show();
}

void setup() {
  Serial.begin(9600);
  lockServo.attach(SERVO_PIN);

  // Stop the servo immediately on boot - do NOT restore position
  lockServo.write(SERVO_STOP);

  strip.begin();
  strip.show(); // All off initially

  // Read last known state from EEPROM
  byte savedState = EEPROM.read(EEPROM_STATE_ADDR);

  // If value is invalid (fresh EEPROM = 255), default to locked
  if (savedState != 0 && savedState != 1) {
    savedState = 1;
  }

  isLocked = (savedState == 1);

  // Reflect restored state on LEDs immediately
  if (isLocked) {
    setLEDs(255, 0, 0); // Red = locked
  } else {
    setLEDs(0, 255, 0); // Green = open
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
  lockServo.write(SERVO_OPEN_DIR);      // Rotate in open direction
  delay(MOVE_DELAY);
  lockServo.write(SERVO_STOP);          // Stop after delay
  isLocked = false;
  EEPROM.update(EEPROM_STATE_ADDR, 0);  // Save unlocked state
  setLEDs(0, 255, 0);                   // Green = open
  Serial.println("OPENED");
}

void closeLock() {
  lockServo.write(SERVO_CLOSE_DIR);     // Rotate in close direction
  delay(MOVE_DELAY);
  lockServo.write(SERVO_STOP);          // Stop after delay
  isLocked = true;
  EEPROM.update(EEPROM_STATE_ADDR, 1);  // Save locked state
  setLEDs(255, 0, 0);                   // Red = locked
  Serial.println("CLOSED");
}
