/**
 * AgriSense ESP32 Firmware
 * ========================
 * Reads: DHT22 (temp + humidity), BH1750 (lux), capacitive soil sensor (ADC)
 * Outputs:
 *   1. Pushes a row to Supabase  sensor_readings  table every PUSH_INTERVAL_MS
 *   2. Serves a local HTTP GET /api/readings endpoint on port 80 for LAN polling
 *
 * Setup
 * -----
 *  1. Copy agrisense_secrets.h.example → agrisense_secrets.h and fill in values.
 *  2. Install libraries via Arduino Library Manager:
 *       - DHT sensor library  (Adafruit)
 *       - Adafruit Unified Sensor
 *       - BH1750  (claws/BH1750)
 *  3. Board: "ESP32 Dev Module" (or your specific variant), Flash: 4 MB, CPU: 240 MHz
 *  4. Upload, open Serial Monitor at 115200 baud.
 *
 * Wiring
 * ------
 *  DHT22  DATA  → GPIO 4     (with 10 kΩ pull-up to 3.3 V)
 *  BH1750 SDA   → GPIO 21
 *  BH1750 SCL   → GPIO 22
 *  Soil sensor  → GPIO 34    (ADC1 — do not use GPIO 35/36 for power issues)
 *
 * Calibration
 * -----------
 *  SOIL_ADC_DRY — raw ADC reading when sensor is in dry air
 *  SOIL_ADC_WET — raw ADC reading when sensor is fully submerged in water
 *  Open Serial Monitor, insert the sensor dry then wet, note the values.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <math.h>
#include <string.h>

// ── Secrets ──────────────────────────────────────────────────────────────────
// Prefer agrisense_secrets.h; fall back to the compile-time defaults below.
#if defined(__has_include)
#  if __has_include("agrisense_secrets.h")
#    include "agrisense_secrets.h"
#  endif
#endif

#ifndef SUPABASE_HOST
#  define SUPABASE_HOST   "YOUR_PROJECT_REF.supabase.co"
#endif
#ifndef SUPABASE_ANON_KEY
#  define SUPABASE_ANON_KEY "YOUR_SUPABASE_ANON_KEY"
#endif
#ifndef DEVICE_ID
#  define DEVICE_ID       "agrisense-001"
#endif
#ifndef WIFI_SSID
#  define WIFI_SSID       "YOUR_WIFI_SSID"
#endif
#ifndef WIFI_PASS
#  define WIFI_PASS       "YOUR_WIFI_PASSWORD"
#endif

// ── Pin & sensor config ───────────────────────────────────────────────────────
static const int PIN_DHT      = 4;
static const int PIN_SOIL_ADC = 34;
static const int PIN_I2C_SDA  = 21;
static const int PIN_I2C_SCL  = 22;

// Capacitive soil sensor calibration — adjust for your specific sensor batch
static const int SOIL_ADC_DRY = 3200;  // raw ADC in dry air
static const int SOIL_ADC_WET = 1400;  // raw ADC fully submerged

// How often to push a reading to Supabase (milliseconds)
static const unsigned long PUSH_INTERVAL_MS  = 30000UL;  // 30 s
// Retry delay after a failed Supabase POST
static const unsigned long RETRY_DELAY_MS    = 10000UL;  // 10 s
// Maximum consecutive Supabase failures before backing off further
static const int           MAX_RETRIES       = 3;

// ── Globals ───────────────────────────────────────────────────────────────────
static WebServer server(80);
static DHT       dht(PIN_DHT, DHT22);
static BH1750    lightMeter;

static unsigned long lastDhtMs       = 0;
static float         lastTempC       = NAN;
static float         lastHumidity    = NAN;

static unsigned long lastPushMs      = 0;
static int           failCount       = 0;
static bool          secretsWarned   = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

static int soilMoisturePercent() {
  const int raw = analogRead(PIN_SOIL_ADC);
  if (SOIL_ADC_DRY == SOIL_ADC_WET) return 0;
  int p = map(raw, SOIL_ADC_DRY, SOIL_ADC_WET, 0, 100);
  p = constrain(p, 0, 100);
  return p;
}

static void updateDhtIfDue() {
  const unsigned long now = millis();
  if (now - lastDhtMs < 2100UL) return;
  lastDhtMs    = now;
  lastHumidity = dht.readHumidity();
  lastTempC    = dht.readTemperature();
}

static bool secretsConfigured() {
  return strcmp(SUPABASE_HOST,    "YOUR_PROJECT_REF.supabase.co") != 0
      && strncmp(SUPABASE_ANON_KEY, "YOUR_", 5) != 0
      && strcmp(WIFI_SSID, "YOUR_WIFI_SSID") != 0;
}

static void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
}

// ── Supabase push ─────────────────────────────────────────────────────────────

static bool pushReadingToSupabase() {
  if (!secretsConfigured()) {
    if (!secretsWarned) {
      Serial.println();
      Serial.println(F("╔══════════════════════════════════════════════════════╗"));
      Serial.println(F("║  SETUP REQUIRED                                      ║"));
      Serial.println(F("║  Copy agrisense_secrets.h.example →                  ║"));
      Serial.println(F("║       agrisense_secrets.h                            ║"));
      Serial.println(F("║  Fill in SUPABASE_HOST, SUPABASE_ANON_KEY,           ║"));
      Serial.println(F("║  DEVICE_ID, WIFI_SSID, WIFI_PASS.                   ║"));
      Serial.println(F("╚══════════════════════════════════════════════════════╝"));
      secretsWarned = true;
    }
    return false;
  }

  updateDhtIfDue();

  float lux  = lightMeter.readLightLevel();
  if (lux < 0) lux = 0;
  const int  soil  = soilMoisturePercent();
  const bool dhtOk = !isnan(lastTempC) && !isnan(lastHumidity);

  // Build JSON payload
  char json[384];
  int  n;
  if (dhtOk) {
    n = snprintf(json, sizeof(json),
      "{\"device_id\":\"%s\","
      "\"soil_moisture\":%d,"
      "\"temperature\":%.1f,"
      "\"humidity\":%.1f,"
      "\"lux\":%.0f}",
      DEVICE_ID, soil, lastTempC, lastHumidity, lux);
  } else {
    n = snprintf(json, sizeof(json),
      "{\"device_id\":\"%s\","
      "\"soil_moisture\":%d,"
      "\"lux\":%.0f}",
      DEVICE_ID, soil, lux);
    Serial.println(F("Supabase: DHT22 read failed — posting without temp/humidity"));
  }

  if (n <= 0 || (size_t)n >= sizeof(json)) {
    Serial.println(F("Supabase: JSON buffer overflow"));
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();  // Skip cert verification — acceptable for IoT sensor data

  HTTPClient http;
  const String url = String("https://") + SUPABASE_HOST + "/rest/v1/sensor_readings";

  if (!http.begin(client, url)) {
    Serial.println(F("Supabase: HTTP begin failed"));
    http.end();
    return false;
  }

  http.addHeader("apikey",        SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Prefer",        "return=minimal");
  http.setTimeout(8000);

  const int code = http.POST(json);

  if (code >= 200 && code < 300) {
    Serial.printf("[Supabase] row inserted — soil=%d%%", soil);
    if (dhtOk) Serial.printf(" temp=%.1f°C hum=%.1f%%", lastTempC, lastHumidity);
    Serial.printf(" lux=%.0f\n", lux);
    http.end();
    return true;
  } else {
    Serial.printf("[Supabase] POST failed HTTP %d: ", code);
    Serial.println(http.getString());
    http.end();
    return false;
  }
}

// ── Local HTTP /api/readings ──────────────────────────────────────────────────

static void handleApiReadings() {
  if (server.method() == HTTP_OPTIONS) {
    addCorsHeaders();
    server.send(204);
    return;
  }
  if (server.method() != HTTP_GET) {
    server.send(405, "text/plain", "Method Not Allowed");
    return;
  }

  addCorsHeaders();

  // Force a fresh DHT read for LAN requests — ignore the 2.1 s guard
  lastDhtMs = 0;
  updateDhtIfDue();

  float lux  = lightMeter.readLightLevel();
  if (lux < 0) lux = 0;
  const int  soil  = soilMoisturePercent();
  const bool dhtOk = !isnan(lastTempC) && !isnan(lastHumidity);

  char body[512];
  int  n;
  if (dhtOk) {
    n = snprintf(body, sizeof(body),
      "{"
        "\"device_id\":\"%s\","
        "\"soilMoisture\":%d,"
        "\"temperature\":%.1f,"
        "\"humidity\":%.1f,"
        "\"lux\":%.0f,"
        "\"uptime_ms\":%lu"
      "}",
      DEVICE_ID, soil, lastTempC, lastHumidity, lux, millis());
  } else {
    n = snprintf(body, sizeof(body),
      "{"
        "\"device_id\":\"%s\","
        "\"soilMoisture\":%d,"
        "\"lux\":%.0f,"
        "\"dht_error\":true,"
        "\"uptime_ms\":%lu"
      "}",
      DEVICE_ID, soil, lux, millis());
  }

  if (n <= 0 || (size_t)n >= sizeof(body)) {
    server.send(500, "application/json", "{\"error\":\"buffer\"}");
    return;
  }

  server.send(200, "application/json", body);
}

static void handleRoot() {
  addCorsHeaders();
  char page[512];
  snprintf(page, sizeof(page),
    "<html><body style='font-family:monospace'>"
    "<h2>AgriSense Node — %s</h2>"
    "<p>Uptime: %lu s</p>"
    "<p><a href='/api/readings'>GET /api/readings</a> — live sensor JSON</p>"
    "</body></html>",
    DEVICE_ID, millis() / 1000UL);
  server.send(200, "text/html", page);
}

// ── Setup & Loop ──────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println(F("AgriSense firmware booting..."));

  // Soil ADC
  analogSetPinAttenuation(PIN_SOIL_ADC, ADC_11db);

  // DHT22 — needs >2 s warm-up
  dht.begin();
  delay(2200);
  lastHumidity = dht.readHumidity();
  lastTempC    = dht.readTemperature();
  lastDhtMs    = millis();
  if (!isnan(lastTempC)) {
    Serial.printf("[DHT22]  temp=%.1f°C  humidity=%.1f%%\n", lastTempC, lastHumidity);
  } else {
    Serial.println(F("[DHT22]  no reading yet — check wiring (GPIO 4 + 10kΩ pull-up)"));
  }

  // BH1750
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.printf("[BH1750] %.0f lux\n", lightMeter.readLightLevel());
  } else {
    Serial.println(F("[BH1750] not found — check I2C wiring (SDA=21, SCL=22)"));
  }

  // Soil sensor raw reading for calibration help
  Serial.printf("[Soil]   raw ADC=%d  → %d%%\n", analogRead(PIN_SOIL_ADC), soilMoisturePercent());

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[WiFi]   connecting to \"%s\"", WIFI_SSID);

  const unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 30000UL) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi]   connected — IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[HTTP]   local endpoint: http://%s/api/readings\n",
                  WiFi.localIP().toString().c_str());
  } else {
    Serial.println(F("[WiFi]   connection timed out"));
    Serial.println(F("[WiFi]   starting fallback AP \"AgriSense-Setup\" (192.168.4.1)"));
    WiFi.disconnect(true);
    WiFi.mode(WIFI_AP);
    WiFi.softAP("AgriSense-Setup");
    Serial.printf("[AP]     IP: %s\n", WiFi.softAPIP().toString().c_str());
  }

  // HTTP server
  server.on("/",            handleRoot);
  server.on("/api/readings", handleApiReadings);
  server.begin();
  Serial.println(F("[HTTP]   server started on port 80"));

  // Immediate first push, then start the interval from now
  if (WiFi.status() == WL_CONNECTED) {
    const bool ok = pushReadingToSupabase();
    if (!ok) failCount = 1;
  }
  lastPushMs = millis();  // reset AFTER the push so the next fires after a full interval

  Serial.println(F("\nAgriSense ready. Loop running."));
}

void loop() {
  // Always serve HTTP regardless of WiFi STA state (AP fallback still needs it)
  server.handleClient();

  // Only push to Supabase when connected to STA WiFi
  if (WiFi.status() != WL_CONNECTED) return;

  const unsigned long now = millis();

  // Determine next push interval (back off on failures)
  unsigned long interval = PUSH_INTERVAL_MS;
  if (failCount >= MAX_RETRIES) {
    interval = PUSH_INTERVAL_MS * 4;  // 2 min back-off after 3 consecutive failures
  } else if (failCount > 0) {
    interval = RETRY_DELAY_MS;
  }

  if (now - lastPushMs >= interval) {
    lastPushMs = now;
    const bool ok = pushReadingToSupabase();
    if (ok) {
      failCount = 0;
    } else {
      failCount++;
      Serial.printf("[Supabase] fail #%d — retrying in %lu s\n",
                    failCount, (failCount >= MAX_RETRIES ? PUSH_INTERVAL_MS * 4 : RETRY_DELAY_MS) / 1000UL);
    }
  }
}
