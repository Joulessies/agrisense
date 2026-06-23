const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkDB() {
  console.log("Checking DB connection...");
  const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
  if (error) {
    console.error("DB Error:", JSON.stringify(error, null, 2));
  } else {
    console.log("DB Connection OK! Count:", data);
  }
}

checkDB();
