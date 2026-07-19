// Butuh script UMD Supabase dimuat sebelum file ini (lihat tag <script> di setiap halaman).
window.EK = window.EK || {};
EK.supabaseClient = supabase.createClient(EK.SUPABASE_URL, EK.SUPABASE_ANON_KEY);
