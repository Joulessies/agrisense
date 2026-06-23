import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zftbtjlrdnnlbzbgxcej.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmdGJ0amxyZG5ubGJ6Ymd4Y2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTkzMjMsImV4cCI6MjA5NDQ5NTMyM30.RGpQBDrGIgOWru65gq8MM_UQHGtAdRl6HcjlyabIJHA';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignUp() {
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@agrisense.com',
    password: 'admin@123',
    options: {
      data: { name: 'System Admin', role: 'admin' }
    }
  });
  console.log("SignUp error:", error);
  console.log("SignUp data:", data.user?.id);
}

testSignUp();
