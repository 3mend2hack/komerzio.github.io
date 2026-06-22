// supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://houfrgnlctliwkzzelmi.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdWZyZ25sY3RsaXdrenplbG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTQ2OTMsImV4cCI6MjA5NjE5MDY5M30.zUfcA755LEjBbn-N05LrmwFqsOFITRP4qLzxjgPIy54'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
