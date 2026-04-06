'use client';

import dynamic from 'next/dynamic';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const BarChart = dynamic(
  () => import('recharts').then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), {
  ssr: false,
});
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), {
  ssr: false,
});

interface ABPair {
  id: string;
  brand: string;
  brandKey: string;
  name: string;
  status: string;
  startDate: string;
  data: { name: string; ctr: number; cvr: number; roas: number }[];
}

const AB_PAIRS: ABPair[] = [
  {
    id: 'kucham-icemachine',
    brand: '쿠참',
    brandKey: 'kucham',
    name: '제빙기 소재 A/B',
    status: '수집 중',
    startDate: '2026-04-01',
    data: [
      { name: 'A안 (현재)', ctr: 3.2, cvr: 1.8, roas: 880 },
      { name: 'B안 (테스트)', ctr: 4.1, cvr: 2.3, roas: 1120 },
    ],
  },
  {
    id: 'uvid-ab',
    brand: '유비드',
    brandKey: 'uvid',
    name: '메인 소재 A/B',
    status: '수집 중',
    startDate: '2026-04-03',
    data: [
      { name: 'A안 (현재)', ctr: 2.8, cvr: 1.5, roas: 260 },
      { name: 'B안 (테스트)', ctr: 3.5, cvr: 1.9, roas: 310 },
    ],
  },
];

const CHART_COLORS = {
  A: '#3b82f6',
  B: '#10b981',
};

export default function ABTest() {
  const { selectedBrand } = useBrandFilter();

  const visible =
    selectedBrand === 'all'
      ? AB_PAIRS
      : AB_PAIRS.filter((p) => p.brandKey === selectedBrand);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-white">소재 A/B 테스트</h2>
        <Badge variant="yellow">데이터 수집 중</Badge>
      </div>

      {visible.length === 0 ? (
        <Card>
          <p className="text-gray-500 text-sm text-center py-16">
            선택한 브랜드의 A/B 테스트가 없습니다.
          </p>
        </Card>
      ) : (
        visible.map((pair) => (
          <Card key={pair.id}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold">{pair.name}</span>
                  <span className="text-xs text-gray-500">
                    ({pair.brand})
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  시작일: {pair.startDate} · 상태:{' '}
                  <span className="text-yellow-400">{pair.status}</span>
                </p>
              </div>
              <div className="text-xs text-gray-500 bg-[#1e2130] rounded px-3 py-1.5">
                ⚠️ 아래 수치는 더미 데이터입니다
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {['ctr', 'cvr', 'roas'].map((metric) => {
                const aVal = pair.data[0][metric as keyof (typeof pair.data)[0]] as number;
                const bVal = pair.data[1][metric as keyof (typeof pair.data)[0]] as number;
                const diff = (((bVal - aVal) / aVal) * 100).toFixed(1);
                const positive = bVal >= aVal;
                const label =
                  metric === 'ctr'
                    ? 'CTR (%)'
                    : metric === 'cvr'
                    ? 'CVR (%)'
                    : 'ROAS (%)';
                return (
                  <div
                    key={metric}
                    className="bg-[#1e2130] rounded-lg p-3 space-y-1"
                  >
                    <p className="text-xs text-gray-400 uppercase">{label}</p>
                    <div className="flex items-end gap-3">
                      <div>
                        <p className="text-xs text-blue-400">A안</p>
                        <p className="text-lg font-bold text-white">{aVal}</p>
                      </div>
                      <div>
                        <p className="text-xs text-green-400">B안</p>
                        <p className="text-lg font-bold text-white">{bVal}</p>
                      </div>
                      <div className="ml-auto">
                        <span
                          className={`text-sm font-semibold ${
                            positive ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {positive ? '+' : ''}
                          {diff}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTR Bar Chart */}
            <div>
              <p className="text-xs text-gray-400 mb-3">CTR 비교 (가로 바 차트)</p>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={pair.data}
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 6]}
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1e2130',
                        border: '1px solid #2a2d3e',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                        fontSize: '12px',
                      }}
                      formatter={(v) => [`${v}%`, 'CTR']}
                    />
                    <Bar
                      dataKey="ctr"
                      fill={CHART_COLORS.A}
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: 'right',
                        fill: '#9ca3af',
                        fontSize: 11,
                        formatter: (v: unknown) => `${v}%`,
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        ))
      )}

      {/* Placeholder */}
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-400 font-medium mb-1">데이터 수집 중</p>
          <p className="text-gray-600 text-sm">
            소재 A/B 테스트 결과는 충분한 데이터가 수집된 후 표시됩니다.
          </p>
        </div>
      </Card>
    </div>
  );
}
