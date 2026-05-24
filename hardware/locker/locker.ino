#include <Servo.h>
#include <EEPROM.h>

Servo lockServo;

const int SERVO_PIN        = 9;
const int MOVE_DELAY       = 6000;
const int EEPROM_STATE_ADDR = 0;

const int SERVO_STOP       = 90;
const int SERVO_OPEN_DIR   = 180;  // Continuous rotation - open direction
const int SERVO_CLOSE_DIR  = 0;    // Continuous rotation - close direction

bool isLocked = true;

void setup() {
  Serial.begin(9600);
  lockServo.attach(SERVO_PIN);

  // Stop the servo immediately on boot - do NOT restore position
  lockServo.write(SERVO_STOP);

  // Read last known state from EEPROM
  byte savedState = EEPROM.read(EEPROM_STATE_ADDR);

  // If value is invalid (fresh EEPROM = 255), default to unlocked
  if (savedState != 0 && savedState != 1) {
    savedState = 0;
  }

  isLocked = (savedState == 1);

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
  lockServo.write(SERVO_STOP);          // Stop after 6 seconds
  isLocked = false;
  EEPROM.update(EEPROM_STATE_ADDR, 0);  // Save unlocked state
  Serial.println("OPENED");
}

void closeLock() {
  lockServo.write(SERVO_CLOSE_DIR);     // Rotate in close direction
  delay(MOVE_DELAY);
  lockServo.write(SERVO_STOP);          // Stop after 6 seconds
  isLocked = true;
  EEPROM.update(EEPROM_STATE_ADDR, 1);  // Save locked state
  Serial.println("CLOSED");
}
