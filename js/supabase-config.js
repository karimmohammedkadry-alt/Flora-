/* Flora Fashion Hijab - Supabase client
 * Put ONLY the Supabase Project URL and Publishable/Anon key here.
 * Never put a service_role/secret key in this file.
 */
window.FLORA_SUPABASE_URL = "https://vznmljvoarfjugnaqdhv.supabase.co";
window.FLORA_SUPABASE_KEY = "sb_publishable_IIHPSmYUP2h00yksg7YOiA_SBg4s6fA";

if (!window.supabase) {
  console.error("Supabase JS failed to load.");
} else if (!window.FLORA_SUPABASE_URL.startsWith("https://") || window.FLORA_SUPABASE_URL.includes("YOUR_")) {
  console.warn("Flora Supabase is not configured yet. Edit js/supabase-config.js.");
}

window.FloraSupabase = {
  client: null,
  ready: false,
  async init() {
    if (this.ready) return this.client;
    if (!window.supabase) throw new Error("Supabase library is unavailable.");
    if (window.FLORA_SUPABASE_URL.includes("YOUR_") || window.FLORA_SUPABASE_KEY.includes("YOUR_")) {
      throw new Error("Supabase is not configured. Add the project URL and publishable/anon key in js/supabase-config.js.");
    }
    this.client = window.supabase.createClient(window.FLORA_SUPABASE_URL, window.FLORA_SUPABASE_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    this.ready = true;
    return this.client;
  }
};
