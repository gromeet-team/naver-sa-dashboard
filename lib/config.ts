import type { Brand, Settings } from './types';

export const BRAND_KEYS = ['kucham', 'uvid', 'meariset', 'foremong'] as const;

export const BRAND_LABELS: Record<Exclude<Brand, 'all'>, string> = {
  kucham: '쿠참',
  uvid: '유비드',
  meariset: '메아리셋',
  foremong: '포레몽',
};

export const BRAND_MAP: Record<string, Exclude<Brand, 'all'>> = {
  kucham: 'kucham',
  uvid: 'uvid',
  betterworld: 'uvid',
  meariset: 'meariset',
  foremong: 'foremong',
};

export function normBrand(brand: string): Exclude<Brand, 'all'> | string {
  return BRAND_MAP[brand] ?? brand;
}

export const DEFAULT_SETTINGS: Settings = {
  brands: {
    kucham: { bep_roas: 220, target_roas: 300, keyword_click_threshold: 30 },
    uvid: { bep_roas: 185, target_roas: 300, keyword_click_threshold: 30 },
    meariset: { bep_roas: 176, target_roas: 176, keyword_click_threshold: 30 },
    foremong: { bep_roas: 200, target_roas: 300, keyword_click_threshold: 30 },
  },
  verdict: { up_threshold_pct: 10, down_threshold_pct: -10 },
  updated_at: '',
  previous: null,
};
