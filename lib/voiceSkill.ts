import fs from "fs";
import path from "path";
import { getSupabase } from "./supabase";

let cached: string | null = null;

// Bundled fallback — the voice profile built from Meera's 4 LinkedIn posts + 11
// newsletters (the published/ folder). This is also what seeds the voice_skill
// table in Supabase on first run, so the profile can be edited later without a
// redeploy: update the row in Supabase and it takes over immediately.
function readBundledVoiceSkill(): string {
  const p = path.join(process.cwd(), "voice-skill.txt");
  return fs.readFileSync(p, "utf-8");
}

export async function getVoiceSkill(): Promise<string> {
  if (cached) return cached;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("voice_skill")
    .select("content")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Supabase not reachable/configured yet — fall back to the bundled file so
    // drafting still works.
    cached = readBundledVoiceSkill();
    return cached;
  }

  if (data?.content) {
    cached = data.content as string;
    return cached;
  }

  // Table exists but is empty — seed it from the bundled file.
  const bundled = readBundledVoiceSkill();
  await supabase.from("voice_skill").insert({ content: bundled });
  cached = bundled;
  return cached;
}
