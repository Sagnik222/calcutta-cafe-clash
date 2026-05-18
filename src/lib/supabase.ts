import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://acanqsqtwjcltgkantlk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjYW5xc3F0d2pjbHRna2FudGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTU1MzYsImV4cCI6MjA5NDY5MTUzNn0.phLHSsosnRw-cITCmcda67OJqBzIqp3berN6KFseODo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
