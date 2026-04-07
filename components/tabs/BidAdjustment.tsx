'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchPending,
  fetchAllHistory,
  fetchCreativeHistory,
} from '@/lib/data';
import { normBrand } from '@/lib/config';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Plan, HistoryRecord, CreativeHistoryItem } from '@/lib/types';

function calcVerdict(
  d7Roas: number | null | undefined,
  d3Roas: number | null | undefined,
  preRoas: number
): { label: string; variant: 'green' | 'red' | 'gray' } {
  const roas = d7Roas ?? d3Roas ?? null;
  if (roas === null) return { label: '⏳ 판정중', variant: 'gray' };
  if (preRoas === 0) return { label: '➖ 유지', variant: 'gray' };
  const diff = ((roas - preRoas) / preRoas) * 100;
  if (diff >= 10) return { label: '🔼 상승', variant: 'green' };
  if (diff <= -10) return { label: '🔽 하락', variant: 'red' };
  return { label: '➖ 유지', variant: 'gray' };
}

function fmtDate(iso: string) {
  return iso.replace('T', ' ').slice(0, 16);
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const TUNNEL_HEADERS = {
  'Content-Type': 'application/json',
  'bypass-tunnel-reminder': 'true',
};

/** 슬랙 붙여넣기용 텍스트 생성 */
function planToSlackText(plans: Plan[]): string {
  const lines = plans.map((p) => {
    const dir = p.action === 'UP' ? '↑' : p.action === 'DOWN' ? '↓' : '-';
    return `• ${p.brand_name} | ${p.adgroup_name} | ${p.current_bid.toLocaleString()}원 → ${p.new_bid.toLocaleString()}원 ${dir} | ROAS ${p.stats_7d.roas_pct}% | ${p.reason}`;
  });
  return `[입찰가 조정 요청]\n${lines.join('\n')}`;
}

function getRankAwareRecommendation(plan: Plan) {
  const roas = plan.stats_7d.roas_pct ?? 0;
  const rank = plan.stats_7d.avg_rnk ?? plan.stats_1d?.avg_rnk ?? null;
  const clicks = plan.stats_7d.clk_cnt ?? 0;
  const purchaseCount = plan.stats_7d.purchase_ccnt ?? 0;

  if (rank !== null && rank > 3 && roas === 0 && clicks >= 80 && purchaseCount === 0) {
    return {
      label: '소재 우선',
      variant: 'yellow' as const,
      note: '순위 낮지만 클릭 충분, 전환 0이라 상향보다 소재/랜딩 점검 우선',
    };
  }

  if (rank !== null && rank > 3) {
    return {
      label: '3위 테스트',
      variant: 'green' as const,
      note: 'ROAS 낮고 순위도 3위 밖이라 3위 안 진입 테스트 우선',
    };
  }

  if (rank !== null && rank <= 3 && roas === 0 && clicks >= 80 && purchaseCount === 0) {
    return {
      label: '동결/소재',
      variant: 'yellow' as const,
      note: '3위 이내인데 전환 0, 입찰보다 소재/랜딩 개선 우선',
    };
  }

  if (rank !== null && rank <= 3) {
    return {
      label: '보수조정',
      variant: 'gray' as const,
      note: '3위 이내 유지 구간이라 강한 하향보다 동결 또는 소폭 조정 권장',
    };
  }

  return {
    label: '기본판단',
    variant: 'gray' as const,
    note: '순위 데이터 기준 추가 판단 필요',
  };
}

export default function BidAdjustment() {
  const { selectedBrand } = useBrandFilter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [creativeHistory, setCreativeHistory] = useState<CreativeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [rollbackLoadingKey, setRollbackLoadingKey] = useState<string | null>(null);
  const [rollbackMessage, setRollbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const [p, h, ch] = await Promise.all([fetchPending(), fetchAllHistory(), fetchCreativeHistory()]);
    setPlans(p.plans);
    setHistory(h);
    setCreativeHistory(ch);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const CLICK_THRESHOLD = 30;

  const brandPlans = selectedBrand === 'all'
    ? plans
    : plans.filter((p) => normBrand(p.brand) === selectedBrand);

  // 노출/매출 모두 0인 유령 항목 제외
  const activePlans = brandPlans.filter(
    (p) => !((p.stats_7d.imp_cnt ?? 0) === 0 && p.stats_7d.sales_amt === 0)
  );

  // 클릭 < 30 → 데이터 부족 스킵
  const filteredPlans = activePlans.filter((p) => (p.stats_7d.clk_cnt ?? 0) >= CLICK_THRESHOLD);
  const skippedPlans  = activePlans.filter((p) => (p.stats_7d.clk_cnt ?? 0) <  CLICK_THRESHOLD);

  // 스킵 브랜드별 집계
  const skippedByBrand = skippedPlans.reduce<Record<string, number>>((acc, p) => {
    const key = p.brand_name || p.brand;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const noClickPlans = (
    selectedBrand === 'all'
      ? plans
      : plans.filter((p) => normBrand(p.brand) === selectedBrand)
  ).filter(
    (p) => (p.stats_7d.imp_cnt ?? 0) > 0 && p.stats_7d.clk_cnt === 0
  );

  const filteredHistory =
    selectedBrand === 'all'
      ? history
      : history.filter((h) => normBrand(h.brand) === selectedBrand);

  async function handleCopy() {
    const text = planToSlackText(filteredPlans);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleRollback(rec: HistoryRecord) {
    const key = `${rec.adgroup_id}:${rec.executed_at}`;
    setRollbackLoadingKey(key);
    setRollbackMessage(null);

    if (!API_URL) {
      setRollbackMessage({
        type: 'error',
        text: '복원 실패, NEXT_PUBLIC_API_URL 이 비어 있습니다.',
      });
      setRollbackLoadingKey(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/rollback`, {
        method: 'POST',
        headers: TUNNEL_HEADERS,
        body: JSON.stringify({
          brand: rec.brand,
          adgroup_id: rec.adgroup_id,
          target_bid: rec.prev_bid,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setRollbackMessage({
        type: 'success',
        text: `${rec.adgroup_name} 복원 요청 완료 (${rec.prev_bid.toLocaleString()}원)`,
      });
      await loadData();
    } catch (e) {
      console.error('Rollback failed:', e);
      setRollbackMessage({
        type: 'error',
        text: `${rec.adgroup_name} 복원 실패, API 상태 확인 필요`,
      });
    } finally {
      setRollbackLoadingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        데이터 로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {rollbackMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            rollbackMessage.type === 'success'
              ? 'border-green-800/50 bg-green-950/20 text-green-300'
              : 'border-red-800/50 bg-red-950/20 text-red-300'
          }`}
        >
          {rollbackMessage.text}
        </div>
      )}

      {/* 스킵 요약 */}
      {Object.keys(skippedByBrand).length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-[#161b27] border border-[#2a2d3e] rounded-lg text-xs text-gray-500">
          <span className="text-gray-600 font-medium">데이터 부족 스킵 (클릭 &lt;{CLICK_THRESHOLD}회):</span>
          {Object.entries(skippedByBrand).map(([brand, cnt]) => (
            <span key={brand} className="bg-[#1e2130] px-2 py-0.5 rounded text-gray-400">
              {brand} {cnt}개
            </span>
          ))}
        </div>
      )}

      {/* 입찰가 조정 후보 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle>입찰가 조정 후보 ({filteredPlans.length}건)</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              기준: ROAS 낮고 순위 3위 밖이면 3위 안 진입 테스트, 3위 이내면 동결 또는 소폭 조정 우선
            </p>
          </div>
          {filteredPlans.length > 0 && (
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 text-sm px-4 py-1.5 rounded transition-colors font-medium ${
                copied
                  ? 'bg-green-700 text-white'
                  : 'bg-[#2a2d3e] hover:bg-[#363a55] text-gray-200'
              }`}
            >
              {copied ? '✅ 복사됨' : '📋 슬랙 복사'}
            </button>
          )}
        </div>
        {filteredPlans.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            조정 후보가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                  <th className="pb-2 pr-3 font-medium">브랜드</th>
                  <th className="pb-2 pr-3 font-medium">광고그룹명</th>
                  <th className="pb-2 pr-3 font-medium text-right">현재입찰가</th>
                  <th className="pb-2 pr-3 font-medium text-right">제안입찰가</th>
                  <th className="pb-2 pr-3 font-medium text-right">ROAS%</th>
                  <th className="pb-2 pr-3 font-medium text-right">평균순위</th>
                  <th className="pb-2 pr-3 font-medium">방향</th>
                  <th className="pb-2 pr-3 font-medium">권장판단</th>
                  <th className="pb-2 font-medium">사유</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {filteredPlans.map((plan, i) => {
                  const recommendation = getRankAwareRecommendation(plan);
                  return (
                  <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                    <td className="py-2 pr-3 text-gray-300">{plan.brand_name}</td>
                    <td className="py-2 pr-3 text-white max-w-[160px] truncate">
                      {plan.adgroup_name}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300">
                      {plan.current_bid.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-white">
                      {plan.new_bid.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span className={plan.stats_7d.roas_pct < 300 ? 'text-red-400' : 'text-green-400'}>
                        {plan.stats_7d.roas_pct}%
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300">
                      {plan.stats_7d.avg_rnk ? plan.stats_7d.avg_rnk.toFixed(1) : '-'}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          plan.action === 'UP' ? 'green' : plan.action === 'DOWN' ? 'red' : 'gray'
                        }
                      >
                        {plan.action}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={recommendation.variant}>{recommendation.label}</Badge>
                    </td>
                    <td className="py-2 text-gray-400 text-xs max-w-[260px] truncate" title={recommendation.note}>
                      {recommendation.note || plan.reason}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 노출O / 클릭X */}
      {noClickPlans.length > 0 && (
        <Card>
          <CardTitle>⚠️ 노출O / 클릭X 그룹 (소재교체 검토 필요)</CardTitle>
          <p className="text-gray-500 text-xs mb-3">
            아래 광고비는 7일 기준 집행액입니다. 클릭은 없고 노출만 발생한 그룹이라 소재/노출명 점검 우선 대상입니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                  <th className="pb-2 pr-3 font-medium">브랜드</th>
                  <th className="pb-2 pr-3 font-medium">광고그룹명</th>
                  <th className="pb-2 pr-3 font-medium">현재 소재명</th>
                  <th className="pb-2 pr-3 font-medium text-right">노출수</th>
                  <th className="pb-2 pr-3 font-medium text-right">클릭수</th>
                  <th className="pb-2 pr-3 font-medium text-right">7일 광고비</th>
                  <th className="pb-2 font-medium text-right">ROAS%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {noClickPlans.map((plan, i) => {
                  const latestCreative = creativeHistory
                    .filter(
                      (c) =>
                        normBrand(c.brand) === normBrand(plan.brand) &&
                        c.adgroup === plan.adgroup_name
                    )
                    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))[0];
                  const creativeName = latestCreative?.after ?? '-';
                  return (
                    <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                      <td className="py-2 pr-3 text-gray-300">{plan.brand_name}</td>
                      <td className="py-2 pr-3 text-white max-w-[140px] truncate">
                        {plan.adgroup_name}
                      </td>
                      <td className="py-2 pr-3 text-gray-400 text-xs max-w-[160px] truncate">
                        {creativeName}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {(plan.stats_7d.imp_cnt ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right text-red-400">
                        {plan.stats_7d.clk_cnt}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {plan.stats_7d.sales_amt.toLocaleString()}원
                      </td>
                      <td className="py-2 text-right text-gray-300">
                        {plan.stats_7d.roas_pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 변경 이력 */}
      <Card>
        <CardTitle>변경 이력 ({filteredHistory.length}건)</CardTitle>
        {filteredHistory.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">변경 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                  <th className="pb-2 pr-3 font-medium">실행일시</th>
                  <th className="pb-2 pr-3 font-medium">브랜드</th>
                  <th className="pb-2 pr-3 font-medium">광고그룹</th>
                  <th className="pb-2 pr-3 font-medium text-right">입찰가 변동</th>
                  <th className="pb-2 pr-3 font-medium text-right">ROAS%</th>
                  <th className="pb-2 pr-3 font-medium">사유</th>
                  <th className="pb-2 pr-3 font-medium text-right">D+1</th>
                  <th className="pb-2 pr-3 font-medium text-right">D+3</th>
                  <th className="pb-2 pr-3 font-medium text-right">D+7</th>
                  <th className="pb-2 pr-3 font-medium">판정</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {filteredHistory.map((rec, i) => {
                  const verdict = calcVerdict(rec.d7_roas, rec.d3_roas, rec.pre_change_roas_7d);
                  return (
                    <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                        {fmtDate(rec.executed_at)}
                      </td>
                      <td className="py-2 pr-3 text-gray-300">{rec.brand_name}</td>
                      <td className="py-2 pr-3 text-white max-w-[140px] truncate">
                        {rec.adgroup_name}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap text-gray-300">
                        {rec.prev_bid.toLocaleString()}→{rec.new_bid.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">{rec.roas_pct}%</td>
                      <td className="py-2 pr-3 text-gray-400 text-xs max-w-[160px] truncate">
                        {rec.reason}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.d1_roas != null ? `${rec.d1_roas}%` : '-'}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.d3_roas != null ? `${rec.d3_roas}%` : '-'}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.d7_roas != null ? `${rec.d7_roas}%` : '-'}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={verdict.variant}>{verdict.label}</Badge>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleRollback(rec)}
                          disabled={rollbackLoadingKey === `${rec.adgroup_id}:${rec.executed_at}`}
                          className="text-xs text-gray-500 hover:text-gray-300 disabled:text-gray-700 transition-colors"
                        >
                          {rollbackLoadingKey === `${rec.adgroup_id}:${rec.executed_at}` ? '복원중...' : '복원'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 소재 변경 이력 */}
      <Card>
        <CardTitle>
          🎨 소재 변경 이력 (
          {creativeHistory.filter(
            (c) => selectedBrand === 'all' || normBrand(c.brand) === selectedBrand
          ).length}
          건)
        </CardTitle>
        {(() => {
          const filtered = creativeHistory
            .filter((c) => selectedBrand === 'all' || normBrand(c.brand) === selectedBrand)
            .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
          if (filtered.length === 0) {
            return <p className="text-gray-500 text-sm text-center py-8">소재 변경 이력이 없습니다.</p>;
          }
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                    <th className="pb-2 pr-3 font-medium">변경일</th>
                    <th className="pb-2 pr-3 font-medium">브랜드</th>
                    <th className="pb-2 pr-3 font-medium">광고그룹</th>
                    <th className="pb-2 pr-3 font-medium">변경 전</th>
                    <th className="pb-2 pr-3 font-medium">변경 후</th>
                    <th className="pb-2 pr-3 font-medium text-right">변경전 ROAS</th>
                    <th className="pb-2 pr-3 font-medium text-right">D+7 ROAS</th>
                    <th className="pb-2 font-medium">판정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d3e]">
                  {filtered.map((item, i) => {
                    const d7 = item.d7_roas;
                    const preRoas = item.before_roas ?? 0;
                    let verdictLabel = '⏳ 추적중';
                    let verdictColor = 'text-gray-500';
                    if (d7 != null) {
                      if (preRoas === 0 || d7 > preRoas * 1.1) {
                        verdictLabel = '🔼 상승';
                        verdictColor = 'text-green-400';
                      } else if (d7 < preRoas * 0.9) {
                        verdictLabel = '🔽 하락';
                        verdictColor = 'text-red-400';
                      } else {
                        verdictLabel = '➡️ 유지';
                        verdictColor = 'text-gray-400';
                      }
                    }
                    return (
                      <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                        <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{item.changed_at}</td>
                        <td className="py-2 pr-3 text-gray-300">{item.brand}</td>
                        <td className="py-2 pr-3 text-white max-w-[120px] truncate">{item.adgroup}</td>
                        <td className="py-2 pr-3 text-gray-400 text-xs max-w-[140px] truncate">{item.before}</td>
                        <td className="py-2 pr-3 text-blue-300 text-xs max-w-[140px] truncate">{item.after}</td>
                        <td className="py-2 pr-3 text-right text-gray-300">
                          {item.before_roas != null ? `${item.before_roas}%` : '-'}
                        </td>
                        <td className="py-2 pr-3 text-right text-gray-300">
                          {d7 != null ? `${d7}%` : '-'}
                        </td>
                        <td className={`py-2 text-sm ${verdictColor}`}>{verdictLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
