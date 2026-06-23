import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'isadmin@agrisense.compass';
const ADMIN_PASSWORD = 'admin@123';

async function upsertProfile(supabase, userId) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      name: 'System Admin',
      email: ADMIN_EMAIL,
      role: 'admin',
      status: 'active',
    },
    { onConflict: 'id' }
  );
  if (error) {
    console.error("Warning: could not upsert profile row:", error.message);
  } else {
    console.log("Profile row upserted in public.profiles.");
  }
}

async function createAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Upserting admin: ${ADMIN_EMAIL}`);

  // Attempt to create first
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'System Admin', role: 'admin' },
  });

  if (!createError) {
    console.log("Admin auth user created successfully!");
    await upsertProfile(supabase, created.user.id);
    console.log(`\n  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    return;
  }

  // User already exists — look up UUID from profiles table
  const alreadyExists =
    createError.message?.toLowerCase().includes('already been registered') ||
    createError.message?.toLowerCase().includes('already exists') ||
    createError.status === 422;

  if (!alreadyExists) {
    console.error("Unexpected error creating admin:", JSON.stringify(createError, null, 2));
    process.exit(1);
  }

  console.log("User already exists — looking up UUID from profiles table...");

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("Could not find profile row for this email. Ensure the email column exists in public.profiles.");
    process.exit(1);
  }

  // Update the auth user password and metadata
  const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'System Admin', role: 'admin' },
  });

  if (updateError) {
    console.error("Error updating admin user:", JSON.stringify(updateError, null, 2));
    process.exit(1);
  }

  console.log("Admin auth user updated successfully!");
  await upsertProfile(supabase, profile.id);
  console.log(`\n  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
}

createAdmin();
