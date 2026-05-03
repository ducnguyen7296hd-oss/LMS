import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client = null;
try {
  if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } else if (supabaseUrl) {
    console.error("Invalid VITE_SUPABASE_URL. Must start with http:// or https://, value was:", supabaseUrl);
  }
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
}

export const supabase = client;
