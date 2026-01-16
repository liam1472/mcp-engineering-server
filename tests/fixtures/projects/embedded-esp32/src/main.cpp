#include <Arduino.h>
#include <WiFi.h>

const char* ssid = "test_ssid";
const char* password = "test_password";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("Connected!");
}

void loop() {
  delay(1000);
}
