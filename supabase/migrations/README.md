# Database Migrations — Run Order

These SQL files set up the complete AgriSense database schema in Supabase.

## Fresh Setup (new Supabase project):

Run these **in order** via **Supabase Dashboard → SQL Editor**:

1. `supabase_schema.sql` — core tables (profiles, nodes, activity_logs, plant_info)
2. `sensor_readings.sql` — sensor data table
3. `setup_sensor_settings.sql` — threshold configuration table
4. `add_email_to_profiles.sql` — adds email column and backfills
5. `03_database_processing.sql` — alert triggers and analytics views
6. **`99_production_auth_fix.sql`** ← **MOST IMPORTANT — run this last**

## Existing Setup (tables already exist):

If you see **"relation already exists"** errors, skip step 1 and run only:

1. ~~`supabase_schema.sql`~~ — **skip this**
2. `sensor_readings.sql` — might fail if table exists, that's OK
3. `setup_sensor_settings.sql` — safe (uses IF NOT EXISTS)
4. `add_email_to_profiles.sql` — safe (uses IF NOT EXISTS)
5. `03_database_processing.sql` — safe (uses CREATE OR REPLACE)
6. **`99_production_auth_fix.sql`** ← **CRITICAL — always run this**

## What does `99_production_auth_fix.sql` do?

This is the **most important** migration — it fixes all auth issues:

- ✅ Ensures `profiles` table has all required columns (`email`, `role`, `name`, `status`)
- ✅ Back-fills missing data from `auth.users`
- ✅ Replaces the trigger function with a production-safe version that won't crash on edge cases
- ✅ Creates the admin account (`admin@agrisense.com` / `admin@123`) with pre-confirmed email
- ✅ Verifies all three auth components are present (users, identities, profiles)

**Expected output:**
```
NOTICE:  Admin account created: admin@agrisense.com / admin@123
NOTICE:  ✓ Admin account verified - all components present
NOTICE:    - auth.users: 1 row(s)
NOTICE:    - public.profiles: 1 row(s)
NOTICE:    - auth.identities: 1 row(s)
```

If you see all three NOTICEs, the database is ready and sign-in will work.

## If sign-in still fails after running migrations:

Check the browser console (F12) for:
```
[AuthOverlay] Sign-in/up failed: <error message>
```

Then check Supabase Dashboard → Logs → Postgres Logs for:
```
handle_new_user failed for user <uuid>: <SQL error>
```

If you see a trigger error, re-run `99_production_auth_fix.sql` — it's safe to run multiple times.
