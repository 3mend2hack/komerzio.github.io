// supabase-client.js
const SUPABASE_URL = 'https://houfrgnlctliwkzzelmi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdWZyZ25sY3RsaXdrenplbG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTQ2OTMsImV4cCI6MjA5NjE5MDY5M30.zUfcA755LEjBbn-N05LrmwFqsOFITRP4qLzxjgPIy54';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabase;
export { supabase };