# AgriSense — Production Deployment Checklist

## 1. Supabase Setup

### Run the SQL migrations (in order):

Go to **Supabase Dashboard → SQL Editor** and run these files in order:

1. `supabase/supabase_schema.sql` — **skip this if tables already exist**
2. `supabase/migrations/sensor_readings.sql`
3. `supabase/migrations/setup_sensor_settings.sql`
4. `supabase/migrations/add_email_to_profiles.sql`
5. `supabase/migrations/03_database_processing.sql`
6. **`supabase/migrations/99_production_auth_fix.sql`** ← **CRITICAL — run this last**

The final migration (99) will:
- Fix the trigger function to handle all edge cases
- Create the admin account with pre-confirmed email
- Verify everything is correct

### Expected output after running `99_production_auth_fix.sql`:

```
NOTICE:  Admin account created: admin@agrisense.com / admin@123
NOTICE:  ✓ Admin account verified - all components present
NOTICE:    - auth.users: 1 row(s)
NOTICE:    - public.profiles: 1 row(s)
NOTICE:    - auth.identities: 1 row(s)
```

If you see **all three ✓** notices, the database is ready.

---

## 2. Environment Variables

### Vercel / Netlify / Any hosting platform:

Add these environment variables in your deployment settings:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY  # Only for server-side (not used yet)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
NEXT_PUBLIC_OPENWEATHER_API_KEY=YOUR_OPENWEATHER_KEY
NEXT_PUBLIC_DEFAULT_WEATHER_CITY=Manila
```

**Where to find Supabase keys:**
- Dashboard → Settings → API → Project URL = `NEXT_PUBLIC_SUPABASE_URL`
- Dashboard → Settings → API → Project API keys:
  - `anon` `public` = `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` = `SUPABASE_SERVICE_ROLE_KEY`

---

## 3. Supabase Email Settings (Important!)

By default, Supabase requires email confirmation for new sign-ups. For production:

### Option A: Disable email confirmation (fastest for MVP/demo)
1. Go to **Supabase Dashboard → Authentication → Providers → Email**
2. Toggle **"Confirm email"** to **OFF**
3. Save

Now users can sign up and immediately sign in without checking their email.

### Option B: Keep email confirmation (more secure)
1. Keep **"Confirm email"** enabled
2. Configure a custom SMTP server:
   - Dashboard → Settings → Auth → SMTP Settings
   - Add your own email service (SendGrid, AWS SES, etc.)
3. Users will receive a confirmation email after sign-up

---

## 4. Row Level Security (RLS) Verification

All tables already have RLS enabled with public read/write policies for the MVP.

**For production hardening later**, tighten these policies in SQL Editor:

```sql
-- Example: restrict sensor_settings updates to admins only
DROP POLICY IF EXISTS "sensor_settings_public_update" ON public.sensor_settings;
CREATE POLICY "sensor_settings_admin_only" ON public.sensor_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
```

---

## 5. Test the Deployment

### Sign in as admin:
- Email: `admin@agrisense.com`
- Password: `admin@123`

You should see:
- ✓ Sign-in succeeds
- ✓ "Administrator Panel" banner on dashboard
- ✓ Users tab visible in sidebar
- ✓ All sensor cards show initial values from database

### Register a new farmer account:
- Click "Need an account? Register"
- Fill in name, email, password
- If email confirmation is **OFF**: should redirect immediately to dashboard
- If email confirmation is **ON**: should show "Check your email" message

---

## 6. Hardware Connection

Once the web app is deployed:

1. Flash the ESP32 with `firmware/esp32_agrisense/esp32_agrisense.ino`
2. Copy `agrisense_secrets.h.example` → `agrisense_secrets.h` and fill in:
   - `SUPABASE_HOST` — your project ref (no https://)
   - `SUPABASE_ANON_KEY` — same as web app
   - `WIFI_SSID` / `WIFI_PASS`
3. Open Serial Monitor (115200 baud) — you'll see the device IP
4. Navigate to **Sensors** view on the web app
5. Enter the device IP in the **LAN Direct Connection** panel
6. Click **Fetch** to verify connectivity

After the first reading is sent to Supabase, the device will auto-register in the **Sensor nodes** table.

---

## 7. Known Limitations

### Mixed content warning (HTTPS web app + HTTP device):
- If the web app is served over HTTPS (e.g., Vercel), browsers block `http://` requests to the ESP32's local IP
- **Workaround**: The Supabase push path works fine — use that as primary data source
- The LAN panel is for local dev/debugging on `http://localhost:3000`

### To fix (advanced):
- Implement HTTPS on the ESP32 (requires embedding a certificate in firmware)
- Or use a reverse proxy that terminates TLS

---

## 8. Troubleshooting

### "Invalid email or password" after running the SQL:
- Check browser console for `[AuthOverlay] Sign-in/up failed:` log
- Verify all three migrations ran successfully in SQL Editor
- Try deleting the admin account manually and re-running step 3 of migration 99

### 500 error on sign-in:
- The trigger function is failing — check Supabase logs:
  - Dashboard → Logs → Postgres Logs
- Look for `handle_new_user failed` warnings
- Re-run `99_production_auth_fix.sql`

### Realtime not connecting:
- Check browser console for WebSocket errors
- Verify **Database → Replication** has `supabase_realtime` publication enabled for all tables:
  - `sensor_readings`
  - `nodes`
  - `profiles`
  - `activity_logs`
  - `sensor_settings`
  - `plant_info`

### Sensor readings not showing up:
- Open **Database → Table Editor → sensor_readings** — are rows being inserted?
- If yes: check that `sensor_readings` is in the realtime publication
- If no: check ESP32 Serial Monitor for POST errors

---

## 9. Post-Deployment

### Change the admin password:
```sql
UPDATE auth.users
SET encrypted_password = crypt('YOUR_NEW_PASSWORD', gen_salt('bf'))
WHERE email = 'admin@agrisense.com';
```

### Monitor the system:
- Dashboard → Logs → check for errors
- Database → Table Editor → verify data is flowing
- Analytics view → confirm charts are populating

---

## Support

If you encounter issues not covered here, check:
- Browser console (F12) for frontend errors
- Supabase Dashboard → Logs for backend errors
- ESP32 Serial Monitor (115200 baud) for hardware logs
