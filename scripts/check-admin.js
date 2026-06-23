const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkAdmin() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error fetching users:", error.message);
    return;
  }
  
  const adminUser = data.users.find(u => u.email === "admin@agrisense.com");
  if (adminUser) {
    console.log("Admin user exists!");
    console.log("Email confirmed at:", adminUser.email_confirmed_at);
    console.log("Metadata:", adminUser.user_metadata);
  } else {
    console.log("Admin user does NOT exist in Supabase auth.");
  }
}

checkAdmin();
