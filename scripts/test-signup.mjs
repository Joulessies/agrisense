import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  console.log("Testing sign up...");
  const { data, error } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@gmail.com',
    password: 'password123',
    options: {
      data: {
        name: 'Test User',
        role: 'farmer'
      }
    }
  });

  if (error) {
    console.error("Signup failed:", error);
  } else {
    console.log("Signup success:", data.user?.email);
  }
}

testSignup();
