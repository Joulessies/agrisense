const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createAdmin() {
  console.log("Checking for admin user...");
  
  // Create user
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@agrisense.com',
    password: 'admin@123',
    email_confirm: true,
    user_metadata: { name: 'System Admin', role: 'admin' }
  });
  
  if (error) {
    console.error("Error creating user:", JSON.stringify(error, null, 2));
    return;
  }
  
  console.log("Admin user created successfully!");
  console.log(data);
}

createAdmin();
