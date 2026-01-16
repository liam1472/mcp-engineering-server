/*
  Blink LED Example
  Arduino test fixture
*/

const int LED_PIN = 13;
const int BLINK_DELAY = 1000;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(BLINK_DELAY);
  digitalWrite(LED_PIN, LOW);
  delay(BLINK_DELAY);
}
