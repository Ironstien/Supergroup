import { getSupabaseAdmin } from './supabase.js';
import { puzzleDateUtc } from './daily.js';

const GRADES = new Set(['S', 'A', 'B', 'C', 'D', 'F']);

export async function submitScore(body) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      status: 503,
      payload: {
        error: 'Score saving is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
      },
    };
  }

  const grade = String(body.grade ?? '').toUpperCase();
  if (!GRADES.has(grade)) {
    return { status: 400, payload: { error: 'grade must be S, A, B, C, D, or F' } };
  }

  const puzzleDate = body.puzzleDate ?? puzzleDateUtc();
  const playerName = body.playerName?.trim()?.slice(0, 40) || null;

  const row = {
    puzzle_date: puzzleDate,
    player_name: playerName,
    grade,
    supergroup: Boolean(body.supergroup),
    charts_score: Number(body.goals?.charts?.score ?? body.chartsScore ?? 0),
    tour_score: Number(body.goals?.tour?.score ?? body.tourScore ?? 0),
    reviews_score: Number(body.goals?.reviews?.score ?? body.reviewsScore ?? 0),
    lineup: body.lineup ?? body.picks ?? null,
  };

  const { data, error } = await supabase.from('game_scores').insert(row).select('id').single();
  if (error) {
    return { status: 502, payload: { error: error.message } };
  }

  return { status: 201, payload: { ok: true, id: data.id } };
}
