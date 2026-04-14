'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, BRAND_KEYS, BRAND_LABELS } from '@/lib/config';
import { fetchAutomationConfig, fetchCronStatus, fetchSettings } from '@/lib/data';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { AutomationConfig, CronJob, Settings } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const STATUS_INFO: Record<string, { icon: string; variant: 'green' | 'yellow' | 'red' }> = {
  ok: { icon: '✅', variant: 'green' },
  warn: { icon: '⚠️', variant: 'yellow' },
  error: { icon: '❌', variant: 'red' },
};

const CRON_LABELS: Record<string, string> = {
  'naver-sa-daily-report': '일일 리포트',
  'naver-sa-analyze': 'SA 분석',
  'adext-ab-report': '소재 A/B 리포트',
  'keyword-learner-collect': '키워드 수집',
  'keyword-learner-track': '키워드 트래킹',
  'keyword-learner-register': '키워드 등록',
  'sa-diagnosis': 'SA 진단/제안',
  'sa-creative-add': '소재 교체 제안',
  'kucham-sa-monitor': '브랜드 SA 모니터링',
  'slot-rank-collect': '슬롯 순위 수집',
};

const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  setup_only: true,
  allow_diagnosis_execute: false,
  allow_negative_keyword_apply: false,
  allow_creative_candidate_live: false,
  updated_at: '',
  note: '',
};

function modeBadge(enabled: boolean, onText: string, offText = '제안만') {
  return enabled ? <Badge variant="green">{onText}</Badge> : <Badge variant="yellow">{offText}</Badge>;
}

export default function CronStatus() {
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [automation, setAutomation] = useState<AutomationConfig>(DEFAULT_AUTOMATION_CONFIG);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [formSettings, setFormSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([fetchCronStatus(), fetchSettings(), fetchAutomationConfig()]).then(([cs, s, a]) => {
      setCrons(cs.crons);
      setSettings(s);
      setFormSettings(s);
      setAutomation(a);
      setLoading(false);
    });
  }, []);

  function updateBrandField(
    brand: string,
    field: 'bep_roas' | 'target_roas' | 'keyword_click_threshold',
    value: string
  ) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setFormSettings((prev) => ({
      ...prev,
      brands: {
        ...prev.brands,
        [brand]: { ...prev.brands[brand], [field]: num },
      },
    }));
  }

  function updateVerdictField(
    field: 'up_threshold_pct' | 'down_threshold_pct',
    value: string
  ) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setFormSettings((prev) => ({
      ...prev,
      verdict: { ...prev.verdict, [field]: num },
    }));
  }

  async function handleSave() {
    setSaving(true);
    if (API_URL) {
      try {
        await fetch(`${API_URL}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formSettings),
        });
      } catch (e) {
        console.error('Settings save failed:', e);
      }
    } else {
      console.log('설정 저장:', formSettings);
    }
    setSettings(formSettings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <CardTitle>오늘 변경된 자동화 모드</CardTitle>
          {automation.setup_only ? (
            <Badge variant="yellow">setup_only ON</Badge>
          ) : (
            <Badge variant="green">live 가능</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#1e2130] rounded-lg p-4 space-y-2">
            <div className="text-sm text-white font-medium">SA 진단</div>
            <div>{modeBadge(automation.allow_diagnosis_execute, '실행 허용')}</div>
            <div className="text-xs text-gray-400">진단 결과를 자동 집행하지 않고 제안/검토용으로 유지합니다.</div>
          </div>
          <div className="bg-[#1e2130] rounded-lg p-4 space-y-2">
            <div className="text-sm text-white font-medium">제외어 제안</div>
            <div>{modeBadge(automation.allow_negative_keyword_apply, '자동 반영')}</div>
            <div className="text-xs text-gray-400">현재는 승인 전 실제 제외어 등록 없이 후보만 저장합니다.</div>
          </div>
          <div className="bg-[#1e2130] rounded-lg p-4 space-y-2">
            <div className="text-sm text-white font-medium">소재 교체 제안</div>
            <div>{modeBadge(automation.allow_creative_candidate_live, '자동 반영')}</div>
            <div className="text-xs text-gray-400">저CTR 그룹은 실제 추가 대신 교체안 큐만 생성합니다.</div>
          </div>
        </div>
        {automation.note && (
          <div className="mt-4 text-xs text-gray-500">{automation.note}</div>
        )}
      </Card>

      {/* Cron status table */}
      <Card>
        <CardTitle>크론 작업 상태</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                <th className="pb-2 pr-4 font-medium">크론명</th>
                <th className="pb-2 pr-4 font-medium">스케줄</th>
                <th className="pb-2 pr-4 font-medium">마지막 실행</th>
                <th className="pb-2 pr-4 font-medium">상태</th>
                <th className="pb-2 font-medium">다음 실행</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3e]">
              {crons.map((cron) => {
                const info = STATUS_INFO[cron.status] ?? STATUS_INFO.warn;
                return (
                  <tr
                    key={cron.name}
                    className="hover:bg-[#1e2130] transition-colors"
                  >
                    <td className="py-2 pr-4">
                      <div className="text-white text-sm">
                        {CRON_LABELS[cron.name] ?? cron.name}
                      </div>
                      <div className="text-gray-600 text-xs font-mono">
                        {cron.name}
                      </div>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-400">
                      {cron.schedule}
                    </td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">
                      {cron.last_run ?? '-'}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={info.variant}>
                        {info.icon} {cron.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-gray-400 text-xs">
                      {cron.next_run ?? '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Settings panel */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>브랜드 설정</CardTitle>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-green-400 text-sm">✅ 저장됨</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-1.5 rounded transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {BRAND_KEYS.map((brand) => {
            const bs = formSettings.brands[brand] ?? {
              bep_roas: 0,
              target_roas: 0,
              keyword_click_threshold: 30,
            };
            return (
              <div
                key={brand}
                className="bg-[#1e2130] rounded-lg p-4 space-y-3"
              >
                <h4 className="text-white font-semibold text-sm">
                  {BRAND_LABELS[brand]}
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-gray-400">BEP ROAS (%)</span>
                    <input
                      type="number"
                      value={bs.bep_roas}
                      onChange={(e) =>
                        updateBrandField(brand, 'bep_roas', e.target.value)
                      }
                      className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-gray-400">목표 ROAS (%)</span>
                    <input
                      type="number"
                      value={bs.target_roas}
                      onChange={(e) =>
                        updateBrandField(brand, 'target_roas', e.target.value)
                      }
                      className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-gray-400">클릭 임계값</span>
                    <input
                      type="number"
                      value={bs.keyword_click_threshold}
                      onChange={(e) =>
                        updateBrandField(
                          brand,
                          'keyword_click_threshold',
                          e.target.value
                        )
                      }
                      className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Verdict thresholds */}
        <div className="bg-[#1e2130] rounded-lg p-4">
          <h4 className="text-white font-semibold text-sm mb-3">
            효율 판정 임계값
          </h4>
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            <label className="space-y-1">
              <span className="text-xs text-gray-400">상승 기준 (%)</span>
              <input
                type="number"
                value={formSettings.verdict.up_threshold_pct}
                onChange={(e) =>
                  updateVerdictField('up_threshold_pct', e.target.value)
                }
                className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">하락 기준 (%)</span>
              <input
                type="number"
                value={formSettings.verdict.down_threshold_pct}
                onChange={(e) =>
                  updateVerdictField('down_threshold_pct', e.target.value)
                }
                className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
              />
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}
