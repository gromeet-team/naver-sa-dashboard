'use client';

import { useEffect, useState } from 'react';
import { fetchSettings, fetchPending, fetchAllHistory } from '@/lib/data';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Settings, Plan, HistoryRecord } from '@/lib/types';

const BRAND_KEYS = ['kucham', 'uvid', 'meariset', 'foremong'] as const;
const BRAND_LABELS: Record<string, string> = {
  kucham: '쿠참',
  uvid: '유비드',
  meariset: '메아리셋',
  foremong: '포레몽',
};

function roasVariant(
  roas: number,
  bep: number,
  target: number
): 'red' | 'yellow' | 'green' {
  if (roas < bep) return 'red';
  if (roas >= target) return 'green';
  return 'yellow';
}

export default function TodayStatus() {
  const { selectedBrand } = useBrandFilter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchPending(), fetchAllHistory()]).then(
      ([s, p, h]) => {
        setSettings(s);
        setPlans(p.plans);
        setHistory(h);
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        데이터 로딩 중...
      </div>
    );
  }

  // 노출0+클릭0+광고비0 그룹 제외
  const activePlans = plans.filter(
    (p) => !(p.stats_7d.clk_cnt === 0 && p.stats_7d.sales_amt === 0)
  );

  // Weighted-average ROAS per brand from plans (clk_cnt > 0, sales_amt 기반)
  const latestRoasByBrand: Record<string, number | null> = {};
  BRAND_KEYS.forEach((brand) => {
    const brandPlans = activePlans.filter(
      (p) => p.brand === brand && p.stats_7d.clk_cnt > 0
    );
    if (brandPlans.length === 0) {
      latestRoasByBrand[brand] = null;
    } else {
      const totalSales = brandPlans.reduce(
        (sum, p) => sum + p.stats_7d.sales_amt,
        0
      );
      if (totalSales === 0) {
        latestRoasByBrand[brand] = null;
      } else {
        const weightedRoas =
          brandPlans.reduce(
            (sum, p) => sum + p.stats_7d.roas_pct * p.stats_7d.sales_amt,
            0
          ) / totalSales;
        latestRoasByBrand[brand] = Math.round(weightedRoas);
      }
    }
  });

  // BEP-below group count per brand from activePlans
  const bepBelowCountByBrand: Record<string, number> = {};
  BRAND_KEYS.forEach((brand) => {
    const bep = settings?.brands[brand]?.bep_roas ?? 0;
    bepBelowCountByBrand[brand] = activePlans.filter(
      (p) => p.brand === brand && p.stats_7d.roas_pct < bep
    ).length;
  });

  const visibleBrands =
    selectedBrand === 'all'
      ? BRAND_KEYS
      : BRAND_KEYS.filter((b) => b === selectedBrand);

  // Anomaly table: BEP 이하 activePlans
  const anomalyPlans = activePlans.filter((p) => {
    const bep = settings?.brands[p.brand]?.bep_roas ?? 0;
    const matchesBrand =
      selectedBrand === 'all' || p.brand === selectedBrand;
    return matchesBrand && p.stats_7d.roas_pct < bep;
  });

  return (
    <div className="space-y-6">
      {/* Brand summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleBrands.map((brand) => {
          const roas = latestRoasByBrand[brand];
          const bep = settings?.brands[brand]?.bep_roas ?? 0;
          const target = settings?.brands[brand]?.target_roas ?? 0;
          const variant =
            roas !== null ? roasVariant(roas, bep, target) : 'gray';
          const bepBelow = bepBelowCountByBrand[brand] ?? 0;

          return (
            <Card key={brand}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-base font-semibold text-white">
                  {BRAND_LABELS[brand]}
                </span>
                <Badge variant={variant}>
                  {variant === 'red'
                    ? 'BEP 미달'
                    : variant === 'green'
                    ? '목표 달성'
                    : '관리 중'}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">최신 ROAS</span>
                  <span
                    className={
                      variant === 'red'
                        ? 'text-red-400 font-semibold'
                        : variant === 'green'
                        ? 'text-green-400 font-semibold'
                        : 'text-yellow-400 font-semibold'
                    }
                  >
                    {roas !== null ? `${roas}%` : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">BEP ROAS</span>
                  <span className="text-gray-300">{bep}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">목표 ROAS</span>
                  <span className="text-gray-300">{target}%</span>
                </div>
                <div className="flex justify-between text-sm border-t border-[#2a2d3e] pt-2 mt-2">
                  <span className="text-gray-400">BEP 미달 그룹</span>
                  <span
                    className={
                      bepBelow > 0
                        ? 'text-red-400 font-semibold'
                        : 'text-gray-300'
                    }
                  >
                    {bepBelow}개
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Anomaly table */}
      <Card>
        <CardTitle>이상 그룹 (BEP 미달)</CardTitle>
        {anomalyPlans.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            BEP 미달 그룹이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">광고그룹명</th>
                  <th className="pb-2 pr-4 font-medium">브랜드</th>
                  <th className="pb-2 pr-4 font-medium text-right">ROAS%</th>
                  <th className="pb-2 pr-4 font-medium">조정방향</th>
                  <th className="pb-2 font-medium text-right">제안입찰가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {anomalyPlans.map((plan, i) => (
                  <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                    <td className="py-2 pr-4 text-white max-w-[200px] truncate">
                      {plan.adgroup_name}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">
                      {plan.brand_name}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <span className="text-red-400 font-semibold">
                        {plan.stats_7d.roas_pct}%
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant={plan.action === 'UP' ? 'green' : plan.action === 'DOWN' ? 'red' : 'gray'}
                      >
                        {plan.action}
                      </Badge>
                    </td>
                    <td className="py-2 text-right text-gray-300">
                      {plan.new_bid.toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
