const SUPABASE_URL = "https://czktibdfhntosgymvyxn.supabase.co";
const SUPABASE_KEY = "sb_publishable_7HKjbrqoGDMl7A8pmJba3Q_5YwXujnd";

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

