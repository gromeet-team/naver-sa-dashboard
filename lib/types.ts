export type Brand = 'all' | 'kucham' | 'uvid' | 'meariset' | 'foremong';

export interface BrandSettings {
  bep_roas: number;
  target_roas: number;
  keyword_click_threshold: number;
}

export interface Settings {
  brands: Record<string, BrandSettings>;
  verdict: {
    up_threshold_pct: number;
    down_threshold_pct: number;
  };
  updated_at: string;
  previous: null | Settings;
}

export interface PlanStats7d {
  clk_cnt: number;
  imp_cnt?: number;
  sales_amt: number;
  conv_amt: number;
  purchase_conv_amt: number;
  purchase_ccnt: number;
  cpc: number;
  avg_rnk: number;
  roas_pct: number;
}

export interface Plan {
  brand: string;
  brand_name: string;
  campaign_id: string;
  campaign_name: string;
  adgroup_id: string;
  adgroup_name: string;
  current_bid: number;
  new_bid: number;
  scenario: string;
  action: string;
  reason: string;
  dow_weight: number;
  approved: boolean;
  stats_7d: PlanStats7d;
  stats_1d: { avg_rnk: number };
}

export interface PendingData {
  created_at: string;
  approved: boolean;
  plans: Plan[];
}

export interface HistoryRecord {
  executed_at: string;
  brand: string;
  brand_name: string;
  campaign_name: string;
  adgroup_id: string;
  adgroup_name: string;
  action: string;
  prev_bid: number;
  new_bid: number;
  roas_pct: number;
  clk_cnt: number;
  reason: string;
  result: string;
  pre_change_roas_7d: number;
  d1_roas: number | null;
  d3_roas: number | null;
  d7_roas: number | null;
  verdict: string | null;
  verdict_at: string | null;
}

export interface QueueItem {
  id: string;
  status: string;
  scheduled_at?: string;
  [key: string]: unknown;
}

export interface PendingExecute {
  queue: QueueItem[];
}

export interface CronJob {
  name: string;
  schedule: string;
  last_run: string | null;
  status: string;
  next_run: string | null;
}

export interface CronStatus {
  updated_at: string;
  crons: CronJob[];
}

export interface AutomationConfig {
  setup_only: boolean;
  allow_diagnosis_execute: boolean;
  allow_negative_keyword_apply: boolean;
  allow_creative_candidate_live: boolean;
  updated_at?: string;
  note?: string;
}

export interface KeywordLearning {
  keyword: string;
  brand: string;
  status: string;
  clk_7d: number;
  roas_7d: number;
  verdict_at: string;
}

export interface BudgetCampaign {
  name: string;
  daily_budget: number;
  today_cost: number;
  ratio: number;
}

export interface BudgetBrand {
  daily_budget?: number;
  today_cost?: number;
  ratio?: number;
  est_exhaust?: string | null;
  campaigns?: BudgetCampaign[];
  error?: string;
}

export type BudgetData = Record<string, BudgetBrand | string>;

export interface CreativeHistoryItem {
  changed_at: string;
  brand: string;
  campaign: string;
  adgroup: string;
  before: string;
  after: string;
  before_roas?: number | null;
  d7_roas?: number | null;
  verdict?: string | null;
  note?: string;
}

export interface KeywordExpansion {
  keyword: string;
  brand: string;
  source: string;
  category: string;
  status: string;
}
