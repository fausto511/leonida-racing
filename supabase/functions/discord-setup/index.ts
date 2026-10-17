// discord-setup -- RETIRED 17.10.2026 (RS-0071 setup finished, server has changed since the
// 15.10. snapshot, so a restore would do more harm than good). Does nothing anymore.
// Source of the original one-off setup: git history of supabase/functions/discord-setup/.
// Delete this function in the Supabase dashboard (Edge Functions -> discord-setup -> Delete).
Deno.serve(() => new Response("gone", { status: 410 }));
