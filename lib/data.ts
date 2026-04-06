import type {
  Settings,
  PendingData,
  HistoryRecord,
  PendingExecute,
  CronStatus,
  KeywordLearning,
  KeywordExpansion,
  BudgetData,
  CreativeHistoryItem,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const TUNNEL_HEADERS = {
  'bypass-tunnel-reminder': 'true',
};

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { headers: TUNNEL_HEADERS });
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
  return fetchJson<Settings>(`${API_URL}/api/settings`, defaultSettings);
}

export async function fetchPending(): Promise<PendingData> {
  return fetchJson<PendingData>(`${API_URL}/api/pending`, {
    created_at: '',
    approved: false,
    plans: [],
  });
}

export async function fetchAllHistory(): Promise<HistoryRecord[]> {
  return fetchJson<HistoryRecord[]>(`${API_URL}/api/history`, []);
}

export async function fetchPendingExecute(): Promise<PendingExecute> {
  return fetchJson<PendingExecute>(`${API_URL}/api/pending-execute`, {
    queue: [],
  });
}

export async function fetchCronStatus(): Promise<CronStatus> {
  return fetchJson<CronStatus>(`${API_URL}/api/cron-status`, {
    updated_at: '',
    crons: [],
  });
}

export async function fetchKeywordLearning(): Promise<KeywordLearning[]> {
  return fetchJson<KeywordLearning[]>(`${API_URL}/api/keyword-learning`, []);
}

export async function fetchKeywordExpansion(): Promise<KeywordExpansion[]> {
  return fetchJson<KeywordExpansion[]>(`${API_URL}/api/keyword-expansion`, []);
}

export async function fetchBudget(): Promise<BudgetData> {
  return fetchJson<BudgetData>(`${API_URL}/api/budget`, {});
}

export async function fetchCreativeHistory(): Promise<CreativeHistoryItem[]> {
  return fetchJson<CreativeHistoryItem[]>(`${API_URL}/api/creative-history`, []);
}
