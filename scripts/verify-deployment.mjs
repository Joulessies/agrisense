import { createClient } from '@supabase/supabase-js';

const errors = [];
const warnings = [];

console.log('🔍 AgriSense Deployment Verification\n');

console.log('📋 Environment Variables:');

const requiredEnvVars = {
  'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
  'NEXT_PUBLIC_OPENWEATHER_API_KEY': process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value || value.includes('YOUR_') || value.includes('placeholder')) {
    console.log(`  ❌ ${key}: NOT SET or placeholder`);
    errors.push(`${key} is missing or placeholder`);
  } else {
    console.log(`  ✅ ${key}: ${value.substring(0, 20)}...`);
  }
}

if (!process.env.NEXT_PUBLIC_DEFAULT_WEATHER_CITY) {
  warnings.push('NEXT_PUBLIC_DEFAULT_WEATHER_CITY not set — will default to Manila');
}

console.log('');

console.log('🔌 Supabase Connection:');

if (errors.length === 0) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .limit(5);

    if (profileError) {
      console.log(`  ❌ Failed to query profiles table: ${profileError.message}`);
      errors.push('Cannot query profiles table — check RLS policies or run migrations');
    } else {
      console.log(`  ✅ Connected — found ${profiles.length} profile(s)`);
      
      const adminProfile = profiles.find(p => p.email === 'admin@agrisense.com');
      if (adminProfile) {
        console.log(`  ✅ Admin account exists (role: ${adminProfile.role})`);
      } else {
        console.log('  ⚠️  Admin account not found — run 99_production_auth_fix.sql');
        warnings.push('Admin account missing');
      }
    }

    const { data: readings, error: readingsError } = await supabase
      .from('sensor_readings')
      .select('id')
      .limit(1);

    if (readingsError) {
      console.log(`  ❌ sensor_readings table error: ${readingsError.message}`);
      errors.push('sensor_readings table missing or inaccessible');
    } else {
      console.log(`  ✅ sensor_readings table accessible`);
    }

    const channel = supabase.channel('test-channel');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('  ✅ Realtime subscriptions working');
        channel.unsubscribe();
      } else if (status === 'CHANNEL_ERROR') {
        console.log('  ⚠️  Realtime error — check Database → Replication settings');
        warnings.push('Realtime may not be working');
        channel.unsubscribe();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (err) {
    console.log(`  ❌ Supabase connection failed: ${err.message}`);
    errors.push('Cannot connect to Supabase');
  }
} else {
  console.log('  ⏭️  Skipped (environment variables missing)');
}

console.log('');

console.log('📊 Summary:');
if (errors.length === 0 && warnings.length === 0) {
  console.log('  ✅ All checks passed! Deployment is ready.');
} else {
  if (errors.length > 0) {
    console.log(`\n  ❌ ${errors.length} error(s) found:`);
    errors.forEach(e => console.log(`     - ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`\n  ⚠️  ${warnings.length} warning(s):`);
    warnings.forEach(w => console.log(`     - ${w}`));
  }
}

console.log('');
process.exit(errors.length > 0 ? 1 : 0);
