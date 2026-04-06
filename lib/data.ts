import type {
  Settings,
  PendingData,
  HistoryRecord,
  PendingExecute,
  CronStatus,
  KeywordLearning,
  KeywordExpansion,
} from './types';

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

const defaultSettings: Settings = {
  brands: {
    kucham: { bep_roas: 220, target_roas: 1000, keyword_click_threshold: 30 },
    uvid: { bep_roas: 185, target_roas: 300, keyword_click_threshold: 30 },
    meariset: { bep_roas: 176, target_roas: 176, keyword_click_threshold: 30 },
    foremong: { bep_roas: 200, target_roas: 300, keyword_click_threshold: 30 },
  },
  verdict: { up_threshold_pct: 10, down_threshold_pct: -10 },
  updated_at: '',
  previous: null,
};

export async function fetchSettings(): Promise<Settings> {
  return fetchJson<Settings>('/data/settings.json', defaultSettings);
}

export async function fetchPending(): Promise<PendingData> {
  return fetchJson<PendingData>('/data/naver_sa_pending.json', {
    created_at: '',
    approved: false,
    plans: [],
  });
}

export async function fetchHistory(brand: string): Promise<HistoryRecord[]> {
  return fetchJson<HistoryRecord[]>(
    `/data/sa_history/${brand}_sa_history.json`,
    []
  );
}

export async function fetchAllHistory(): Promise<HistoryRecord[]> {
  const brands = ['kucham', 'uvid', 'meariset', 'foremong'];
  const results = await Promise.all(brands.map((b) => fetchHistory(b)));
  return results
    .flat()
    .sort(
      (a, b) =>
        new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
    );
}

export async function fetchPendingExecute(): Promise<PendingExecute> {
  return fetchJson<PendingExecute>('/data/pending_execute.json', { queue: [] });
}

export async function fetchCronStatus(): Promise<CronStatus> {
  return fetchJson<CronStatus>('/data/cron_status.json', {
    updated_at: '',
    crons: [],
  });
}

export async function fetchKeywordLearning(): Promise<KeywordLearning[]> {
  return fetchJson<KeywordLearning[]>('/data/keyword_learning.json', []);
}

export async function fetchKeywordExpansion(): Promise<KeywordExpansion[]> {
  return fetchJson<KeywordExpansion[]>(
    '/data/keyword_expansion_candidates.json',
    []
  );
}
