/**
 * Leaderboard API (Cloudflare Pages Function + D1).
 *   GET  /api/scores?era=ww2&limit=10   -> { scores: [...] }
 *   POST /api/scores { name, message, score, stage, era } -> { ok, rank }
 */

interface Env {
  DB: D1Database;
}

const ERAS = ['ww2', 'modern', 'future'];
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function clean(s: unknown, max: number) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function hashIp(ip: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('steel-wings:' + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const era = url.searchParams.get('era') ?? 'ww2';
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10', 10) || 10));
  if (!ERAS.includes(era)) return json({ error: 'bad era' }, 400);
  const { results } = await env.DB.prepare(
    'SELECT name, message, score, stage, created_at FROM scores WHERE era = ? ORDER BY score DESC, created_at ASC LIMIT ?',
  )
    .bind(era, limit)
    .all();
  return json({ scores: results });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const name = clean(body.name, 12);
  const message = clean(body.message, 40);
  const era = String(body.era ?? '');
  const score = Math.floor(Number(body.score));
  const stage = Math.floor(Number(body.stage));
  if (!name) return json({ error: 'name required' }, 400);
  if (!ERAS.includes(era)) return json({ error: 'bad era' }, 400);
  if (!Number.isFinite(stage) || stage < 1 || stage > 999) return json({ error: 'bad stage' }, 400);
  // plausibility: no stage can yield more than ~800k points
  if (!Number.isFinite(score) || score < 0 || score > stage * 800000) return json({ error: 'bad score' }, 400);

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await hashIp(ip);
  const now = Date.now();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, now - 60_000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 3) return json({ error: 'too many submissions, try again in a minute' }, 429);

  await env.DB.prepare('INSERT INTO scores (name, message, score, stage, era, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(name, message, score, stage, era, ipHash, now)
    .run();
  const higher = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE era = ? AND score > ?').bind(era, score).first<{ n: number }>();
  return json({ ok: true, rank: (higher?.n ?? 0) + 1 });
};
