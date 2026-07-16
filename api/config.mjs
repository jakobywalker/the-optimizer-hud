export default function handler(request, response) {
  const url = process.env.HUD_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.HUD_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.HUD_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  response.setHeader("Cache-Control", "no-store");
  if (!url || !key) {
    return response.status(503).json({ error: "Cloud sync is not configured" });
  }

  return response.status(200).json({ url, key });
}
