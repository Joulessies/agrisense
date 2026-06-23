import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectDB() {
  console.log("Fetching tables...");
  // Use a query against a known table, or try to select from information_schema if possible via postgrest.
  // Actually, PostgREST doesn't expose information_schema by default.
  // We can just try selecting from expected tables.
  const tables = ['sensor_readings', 'sensor_settings', 'profiles', 'activity_logs', 'nodes', 'plant_info'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`Table ${table}: EXISTS`);
    }
  }
}

inspectDB();
