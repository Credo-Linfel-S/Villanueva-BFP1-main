// lib/supabaseClient.js - CLIENT SIDE ONLY
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Anon Key loaded:", !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables!");
  throw new Error("Missing Supabase environment variables");
}
// In your lib/supabaseClient.js or similar
export const setupClearanceRealtime = (callback) => {
  const subscription = supabase
    .channel('clearance-updates')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'clearance_requests' 
      }, 
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();
    
  return subscription;
};
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Remove the global headers - Supabase handles this automatically
});
