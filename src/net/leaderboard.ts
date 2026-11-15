import type { Era } from '../data/config';

/**
 * Online leaderboard (Cloudflare Pages Function + D1) with a local fallback
 * so the board still works offline or in local dev.
 */

export interface ScoreRow {
  name: string;
  message: string;
  score: number;
  stage: number;
  created_at?: number;
}

const API = '/api/scores';
const localKey = (era: Era) => `sw.lb.${era}`;

function readLocal(era: Era): ScoreRow[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(era)) ?? '[]') as ScoreRow[];
  } catch {
    return [];
  }
}

function writeLocal(era: Era, row: ScoreRow) {
  try {
    const rows = [...readLocal(era), row].sort((a, b) => b.score - a.score).slice(0, 50);
    localStorage.setItem(localKey(era), JSON.stringify(rows));
  } catch {
    /* storage unavailable */
  }
}

async function withTimeout(p: Promise<Response>, ms: number) {
  return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

export async function fetchTop(era: Era, limit = 10): Promise<{ rows: ScoreRow[]; online: boolean }> {
  try {
    const res = await withTimeout(fetch(`${API}?era=${era}&limit=${limit}`), 5000);
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error('offline');
    const data = (await res.json()) as { scores: ScoreRow[] };
    return { rows: data.scores, online: true };
  } catch {
    return { rows: readLocal(era).slice(0, limit), online: false };
  }
}

export async function submitScore(
  era: Era,
  row: ScoreRow,
): Promise<{ ok: boolean; rank?: number; online: boolean; error?: string }> {
  writeLocal(era, row);
  try {
    const res = await withTimeout(
      fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...row, era }) }),
      6000,
    );
    if (!(res.headers.get('content-type') ?? '').includes('json')) throw new Error('offline');
    const data = (await res.json()) as { ok?: boolean; rank?: number; error?: string };
    if (!res.ok) return { ok: false, online: true, error: data.error };
    return { ok: true, rank: data.rank, online: true };
  } catch {
    const rank = readLocal(era).findIndex((r) => r.score === row.score && r.name === row.name) + 1;
    return { ok: true, rank, online: false };
  }
}

export const nick = {
  get() {
    try {
      return localStorage.getItem('sw.nick') ?? '';
    } catch {
      return '';
    }
  },
  set(v: string) {
    try {
      localStorage.setItem('sw.nick', v);
    } catch {
      /* ignore */
    }
  },
};
