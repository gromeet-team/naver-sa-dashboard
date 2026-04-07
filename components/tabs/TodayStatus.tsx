'use client';

import { useEffect, useState } from 'react';
import { fetchSettings, fetchPending, fetchAllHistory, fetchBudget } from '@/lib/data';
import { BRAND_KEYS, BRAND_LABELS, normBrand } from '@/lib/config';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Settings, Plan, HistoryRecord, BudgetData } from '@/lib/types';

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
  const [pendingCreatedAt, setPendingCreatedAt] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchPending(), fetchAllHistory(), fetchBudget()]).then(
      ([s, p, h, b]) => {
        setSettings(s);
        setPlans(p.plans);
        setPendingCreatedAt(p.created_at ?? null);
        setHistory(h);
        setBudget(b);
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
    (p) => !((p.stats_7d.imp_cnt ?? 0) === 0 && p.stats_7d.sales_amt === 0)
  );

  // ROAS 0% (광고비는 있는데 전환 없는) 그룹 수 per brand
  const zeroRoasByBrand: Record<string, number> = {};
  BRAND_KEYS.forEach((brand) => {
    zeroRoasByBrand[brand] = activePlans.filter(
      (p) => normBrand(p.brand) === brand && p.stats_7d.sales_amt > 0 && p.stats_7d.roas_pct === 0
    ).length;
  });

  // Weighted-average ROAS per brand from plans (clk_cnt > 0, sales_amt 기반)
  const latestRoasByBrand: Record<string, number | null> = {};
  BRAND_KEYS.forEach((brand) => {
    const brandPlans = activePlans.filter(
      (p) => normBrand(p.brand) === brand && p.stats_7d.clk_cnt > 0
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
      (p) => normBrand(p.brand) === brand && p.stats_7d.roas_pct < bep
    ).length;
  });

  const visibleBrands =
    selectedBrand === 'all'
      ? BRAND_KEYS
      : BRAND_KEYS.filter((b) => b === selectedBrand);

  // BEP 이하 activePlans
  const allBepBelow = activePlans.filter((p) => {
    const nb = normBrand(p.brand);
    const bep = settings?.brands[nb]?.bep_roas ?? 0;
    const matchesBrand =
      selectedBrand === 'all' || nb === selectedBrand;
    return matchesBrand && p.stats_7d.roas_pct < bep;
  });

  // ① 입찰가 조정 대상: 클릭O + 전환O (ROAS > 0이지만 BEP 미달)
  const bidAdjustPlans = allBepBelow.filter(
    (p) => p.stats_7d.roas_pct > 0
  );

  // ② 소재교체 검토: 클릭O + 전환X (ROAS 0%)
  const creativeReviewPlans = allBepBelow.filter(
    (p) => p.stats_7d.roas_pct === 0 && p.stats_7d.clk_cnt > 0
  );

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
                {(() => {
                  const bd = budget[brand] as { ratio?: number; today_cost?: number; daily_budget?: number; est_exhaust?: string | null; error?: string } | undefined;
                  if (!bd || bd.error) return null;
                  const ratio = bd.ratio ?? 0;
                  return (
                    <div className="flex justify-between text-sm border-t border-[#2a2d3e] pt-2 mt-2">
                      <span className="text-gray-400">예산 소진율</span>
                      <span className={ratio >= 80 ? 'text-red-400 font-semibold' : ratio >= 50 ? 'text-yellow-400' : 'text-gray-300'}>
                        {ratio}%
                        {bd.est_exhaust && <span className="text-gray-500 text-xs ml-1">({bd.est_exhaust} 소진예상)</span>}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 데이터 수집 현황 */}
      <Card>
        <CardTitle>📊 데이터 수집 현황</CardTitle>
        <div className="mt-3 space-y-2 text-sm">
          <div className="text-gray-400">
            마지막 수집:{' '}
            <span className="text-white">
              {pendingCreatedAt ? pendingCreatedAt.replace('T', ' ').slice(0, 16) : '-'}
            </span>
            {pendingCreatedAt && (() => {
              const diffH = (Date.now() - new Date(pendingCreatedAt).getTime()) / 3600000;
              return diffH > 6 ? (
                <span className="ml-2 text-yellow-400">⚠️ {Math.round(diffH)}시간 전 (오래된 데이터)</span>
              ) : null;
            })()}
          </div>
          {BRAND_KEYS.map((brand) => {
            const zero = zeroRoasByBrand[brand] ?? 0;
            const total = activePlans.filter((p) => normBrand(p.brand) === brand).length;
            return (
              <div key={brand} className="flex items-center gap-3 text-gray-300">
                <span className="w-16 font-medium">{BRAND_LABELS[brand]}</span>
                <span className="text-gray-500">{total}개 그룹</span>
                {total === 0 && (
                  <span className="text-red-400 text-xs">❌ 데이터 없음 — API 연동 확인</span>
                )}
                {total > 0 && zero >= 3 && (
                  <span className="text-yellow-400 text-xs">⚠️ ROAS 0% {zero}개 — 소재/랜딩 확인 권장</span>
                )}
                {total > 0 && zero > 0 && zero < 3 && (
                  <span className="text-gray-500 text-xs">ROAS 0% {zero}개</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 입찰가 조정 대상 */}
      <Card>
        <div className="mb-3">
          <CardTitle>🚨 입찰가 조정 필요 (BEP 미달 + 전환 있음)</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            순위 반영 기준, 3위 밖 저ROAS는 3위 안 테스트 우선, 3위 이내 저ROAS는 동결 또는 소폭 조정 우선
          </p>
        </div>
        {bidAdjustPlans.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            입찰가 조정 대상 그룹이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">광고그룹명</th>
                  <th className="pb-2 pr-4 font-medium">브랜드</th>
                  <th className="pb-2 pr-4 font-medium text-right">ROAS%</th>
                  <th className="pb-2 pr-4 font-medium text-right">클릭</th>
                  <th className="pb-2 pr-4 font-medium text-right">평균순위</th>
                  <th className="pb-2 pr-4 font-medium">조정방향</th>
                  <th className="pb-2 font-medium text-right">제안입찰가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {bidAdjustPlans.map((plan, i) => (
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
                    <td className="py-2 pr-4 text-right text-gray-300">
                      {plan.stats_7d.clk_cnt}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-300">
                      {plan.stats_7d.avg_rnk ? plan.stats_7d.avg_rnk.toFixed(1) : '-'}
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

      {/* 소재교체 검토 대상 */}
      {creativeReviewPlans.length > 0 && (
        <Card>
          <CardTitle>⚠️ 소재교체 검토 (클릭O / 전환X)</CardTitle>
          <p className="text-gray-500 text-xs mb-3">
            클릭은 발생하지만 구매전환이 없는 그룹입니다. 입찰가보다 소재(노출명) 교체를 검토해 보세요.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">광고그룹명</th>
                  <th className="pb-2 pr-4 font-medium">브랜드</th>
                  <th className="pb-2 pr-4 font-medium text-right">7일 클릭</th>
                  <th className="pb-2 pr-4 font-medium text-right">광고비</th>
                  <th className="pb-2 font-medium text-right">현재 입찰가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {creativeReviewPlans.map((plan, i) => (
                  <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                    <td className="py-2 pr-4 text-white max-w-[200px] truncate">
                      {plan.adgroup_name}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">
                      {plan.brand_name}
                    </td>
                    <td className="py-2 pr-4 text-right text-yellow-400">
                      {plan.stats_7d.clk_cnt}회
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-300">
                      {plan.stats_7d.sales_amt.toLocaleString()}원
                    </td>
                    <td className="py-2 text-right text-gray-300">
                      {plan.current_bid.toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
