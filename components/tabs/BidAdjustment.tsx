'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchPending,
  fetchAllHistory,
  fetchPendingExecute,
} from '@/lib/data';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Plan, HistoryRecord, QueueItem } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function calcVerdict(
  d7Roas: number | null,
  preRoas: number
): { label: string; variant: 'green' | 'red' | 'gray' } {
  if (d7Roas === null) return { label: '⏳ 판정중', variant: 'gray' };
  if (preRoas === 0) return { label: '➖ 유지', variant: 'gray' };
  const diff = ((d7Roas - preRoas) / preRoas) * 100;
  if (diff >= 10) return { label: '🔼 상승', variant: 'green' };
  if (diff <= -10) return { label: '🔽 하락', variant: 'red' };
  return { label: '➖ 유지', variant: 'gray' };
}

function fmtDate(iso: string) {
  return iso.replace('T', ' ').slice(0, 16);
}

export default function BidAdjustment() {
  const { selectedBrand } = useBrandFilter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [p, h] = await Promise.all([fetchPending(), fetchAllHistory()]);
    setPlans(p.plans);
    setHistory(h);
    setLoading(false);
  }, []);

  const pollQueue = useCallback(async () => {
    const pe = await fetchPendingExecute();
    setQueue(pe.queue);
  }, []);

  useEffect(() => {
    loadData();
    pollQueue();
    const interval = setInterval(pollQueue, 5000);
    return () => clearInterval(interval);
  }, [loadData, pollQueue]);

  const filteredPlans = (
    selectedBrand === 'all'
      ? plans
      : plans.filter((p) => p.brand === selectedBrand)
  ).filter(
    (p) => !(p.stats_7d.clk_cnt === 0 && p.stats_7d.sales_amt === 0)
  );

  // 노출O/클릭X: clk_cnt===0이지만 sales_amt>0인 그룹 (향후 imp_cnt 추가 시 활용)
  const noClickPlans = (
    selectedBrand === 'all'
      ? plans
      : plans.filter((p) => p.brand === selectedBrand)
  ).filter(
    (p) => p.stats_7d.clk_cnt === 0 && p.stats_7d.sales_amt > 0
  );

  const filteredHistory =
    selectedBrand === 'all'
      ? history
      : history.filter((h) => h.brand === selectedBrand);

  const pendingQueue = queue.filter((q) => q.status === 'pending');

  const allSelected =
    filteredPlans.length > 0 &&
    filteredPlans.every((_, i) => selected.has(i));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredPlans.map((_, i) => i)));
    }
  }

  function toggleOne(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  }

  async function handleApprove() {
    const selectedPlans = filteredPlans.filter((_, i) => selected.has(i));
    try {
      await fetch(`${API_URL}/api/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
        },
        body: JSON.stringify({
          type: 'shopping',
          items: selectedPlans,
          delay_minutes: 5,
        }),
      });
    } catch (e) {
      console.error('Approve failed:', e);
    }
    setSelected(new Set());
  }

  async function handleCancel() {
    try {
      await fetch(`${API_URL}/api/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
        },
        body: JSON.stringify({ queue_id: pendingQueue[0]?.id }),
      });
    } catch (e) {
      console.error('Cancel failed:', e);
    }
  }

  async function handleRollback(rec: (typeof history)[0]) {
    try {
      await fetch(`${API_URL}/api/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
        },
        body: JSON.stringify({
          brand: rec.brand,
          adgroup_id: rec.adgroup_id,
          target_bid: rec.prev_bid,
        }),
      });
    } catch (e) {
      console.error('Rollback failed:', e);
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
      {/* Countdown banner */}
      {pendingQueue.length > 0 && (
        <div className="flex items-center justify-between bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3">
          <span className="text-yellow-300 text-sm font-medium">
            ⏳ {pendingQueue.length}건 실행 대기 중
          </span>
          <button
            onClick={handleCancel}
            className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1 rounded transition-colors"
          >
            취소
          </button>
        </div>
      )}

      {/* Pending plans table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>입찰가 조정 후보 ({filteredPlans.length}건)</CardTitle>
          {selected.size > 0 && (
            <button
              onClick={handleApprove}
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition-colors"
            >
              승인 ({selected.size}건)
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
                  <th className="pb-2 pr-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-blue-500"
                    />
                  </th>
                  <th className="pb-2 pr-3 font-medium">브랜드</th>
                  <th className="pb-2 pr-3 font-medium">광고그룹명</th>
                  <th className="pb-2 pr-3 font-medium text-right">현재입찰가</th>
                  <th className="pb-2 pr-3 font-medium text-right">제안입찰가</th>
                  <th className="pb-2 pr-3 font-medium text-right">ROAS%</th>
                  <th className="pb-2 pr-3 font-medium">방향</th>
                  <th className="pb-2 font-medium">사유</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {filteredPlans.map((plan, i) => (
                  <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggleOne(i)}
                        className="accent-blue-500"
                      />
                    </td>
                    <td className="py-2 pr-3 text-gray-300">
                      {plan.brand_name}
                    </td>
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
                      <span
                        className={
                          plan.stats_7d.roas_pct < 200
                            ? 'text-red-400'
                            : 'text-green-400'
                        }
                      >
                        {plan.stats_7d.roas_pct}%
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          plan.action === 'UP'
                            ? 'green'
                            : plan.action === 'DOWN'
                            ? 'red'
                            : 'gray'
                        }
                      >
                        {plan.action}
                      </Badge>
                    </td>
                    <td className="py-2 text-gray-400 text-xs max-w-[200px] truncate">
                      {plan.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 노출O / 클릭X 소재교체 필요 섹션 */}
      <Card>
        <CardTitle>⚠️ 노출O / 클릭X 그룹 (소재교체 검토 필요)</CardTitle>
        {noClickPlans.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            해당 그룹이 없습니다. (imp_cnt 데이터 추가 시 자동 표시)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                  <th className="pb-2 pr-3 font-medium">브랜드</th>
                  <th className="pb-2 pr-3 font-medium">광고그룹명</th>
                  <th className="pb-2 pr-3 font-medium text-right">클릭수</th>
                  <th className="pb-2 pr-3 font-medium text-right">광고비</th>
                  <th className="pb-2 font-medium text-right">ROAS%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {noClickPlans.map((plan, i) => (
                  <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                    <td className="py-2 pr-3 text-gray-300">{plan.brand_name}</td>
                    <td className="py-2 pr-3 text-white max-w-[160px] truncate">
                      {plan.adgroup_name}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* History table */}
      <Card>
        <CardTitle>변경 이력 ({filteredHistory.length}건)</CardTitle>
        {filteredHistory.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            변경 이력이 없습니다.
          </p>
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
                  <th className="pb-2 pr-3 font-medium text-right">D+7 ROAS</th>
                  <th className="pb-2 pr-3 font-medium">효율판정</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {filteredHistory.map((rec, i) => {
                  const verdict = calcVerdict(rec.d7_roas, rec.pre_change_roas_7d);
                  return (
                    <tr
                      key={i}
                      className="hover:bg-[#1e2130] transition-colors"
                    >
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                        {fmtDate(rec.executed_at)}
                      </td>
                      <td className="py-2 pr-3 text-gray-300">
                        {rec.brand_name}
                      </td>
                      <td className="py-2 pr-3 text-white max-w-[140px] truncate">
                        {rec.adgroup_name}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap text-gray-300">
                        {rec.prev_bid.toLocaleString()}→
                        {rec.new_bid.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.roas_pct}%
                      </td>
                      <td className="py-2 pr-3 text-gray-400 text-xs max-w-[160px] truncate">
                        {rec.reason}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.d7_roas !== null ? `${rec.d7_roas}%` : '-'}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={verdict.variant}>{verdict.label}</Badge>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleRollback(rec)}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          복원
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
    </div>
  );
}
