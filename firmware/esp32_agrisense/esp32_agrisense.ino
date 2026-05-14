#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <math.h>

static const char *WIFI_SSID = "Password"
static const char *WIFI_PASS = "password";

static const int PIN_DHT = 4;
static const int PIN_SOIL_ADC = 34;
static const int PIN_I2C_SDA = 21;
static const int PIN_I2C_SCL = 22;

static const int SOIL_ADC_DRY = 3200;
static const int SOIL_ADC_WET = 1400;

static WebServer server(80);
static DHT dht(PIN_DHT, DHT22);
static BH1750 lightMeter;

static unsigned long lastDhtMs = 0;
static float lastTempC = NAN;
static float lastHumidity = NAN;

static int soilMoisturePercent() {
  int raw = analogRead(PIN_SOIL_ADC);
  if (SOIL_ADC_DRY == SOIL_ADC_WET) return 0;
  int p = map(raw, SOIL_ADC_DRY, SOIL_ADC_WET, 0, 100);
  if (p < 0) p = 0;
  if (p > 100) p = 100;
  return p;
}

static void appendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
}

static void updateDhtIfDue() {
  const unsigned long now = millis();
  if (now - lastDhtMs < 2100) return;
  lastDhtMs = now;
  lastHumidity = dht.readHumidity();
  lastTempC = dht.readTemperature();
}

static void handleApiReadings() {
  if (server.method() == HTTP_OPTIONS) {
    appendCors();
    server.send(204);
    return;
  }
  if (server.method() != HTTP_GET) {
    server.send(405, "text/plain", "Method Not Allowed");
    return;
  }

  appendCors();

  updateDhtIfDue();

  float lux = lightMeter.readLightLevel();
  if (lux < 0) lux = 0;

  const int soil = soilMoisturePercent();

  char body[384];
  const bool dhtOk = !isnan(lastTempC) && !isnan(lastHumidity);
  int n;
  if (dhtOk) {
    n = snprintf(
        body, sizeof(body),
        "{"
        "\"soilMoisture\":%d,"
        "\"temperature\":%.1f,"
        "\"humidity\":%.1f,"
        "\"lux\":%.0f"
        "}",
        soil, lastTempC, lastHumidity, lux);
  } else {
    n = snprintf(
        body, sizeof(body),
        "{"
        "\"soilMoisture\":%d,"
        "\"lux\":%.0f"
        "}",
        soil, lux);
  }

  if (n <= 0 || (size_t)n >= sizeof(body)) {
    server.send(500, "application/json", "{\"error\":\"buffer\"}");
    return;
  }

  server.send(200, "application/json", body);
}

void setup() {
  Serial.begin(115200);
  delay(200);

  analogSetPinAttenuation(PIN_SOIL_ADC, ADC_11db);
  dht.begin();
  delay(2200);
  lastHumidity = dht.readHumidity();
  lastTempC = dht.readTemperature();
  lastDhtMs = millis();

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println(F("BH1750 not found — check I2C wiring"));
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print(F("WiFi "));
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  Serial.println(WiFi.localIP());

  server.on("/api/readings", handleApiReadings);
  server.begin();
}

void loop() {
  server.handleClient();
}
