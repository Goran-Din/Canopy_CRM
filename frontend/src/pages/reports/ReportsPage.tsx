import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useApiGet } from '@/hooks/useApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['hsl(142, 76%, 36%)', 'hsl(210, 76%, 50%)', 'hsl(45, 93%, 47%)', 'hsl(0, 72%, 51%)', 'hsl(280, 65%, 60%)'];
const AGING_COLORS: Record<string, string> = { current: '#22c55e', '30_days': '#eab308', '60_days': '#f97316', '90_plus': '#ef4444' };

interface RevenueData { monthly: { period: string; revenue: string }[]; ytd: string; priorYtd: string }
interface DivisionData { division: string; revenue: string }
interface AgingData { bucket: string; total: string; count: string }
interface RenewalData { id: string; contract_number: string; customer_name: string; end_date: string; total_value: string; division: string | null; days_until_expiry: string }
interface CrewData { crew_id: string; crew_name: string; jobs_completed: string; total_estimated_minutes: string; total_actual_minutes: string; avg_efficiency: string }
interface TimeData { user_id: string; user_name: string; crew_name: string | null; total_hours: string; regular_hours: string; overtime_hours: string; division: string | null }
interface SnowData { season_id: string; season_name: string; total_runs: string; total_entries: string; total_revenue: string; total_labor_cost: string; profit: string }
interface PipelineData { byStage: { stage: string; count: string; total_value: string; avg_value: string }[]; metrics: { total_projects: string; won: string; lost: string; win_rate: string; avg_days_to_close: string } }
interface ConversionData { source: string; total: string; converted: string; conversion_rate: string; total_value: string }

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">${Number(value).toLocaleString()}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function RevenueTab({ dateFrom, dateTo, division }: { dateFrom: string; dateTo: string; division: string }) {
  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  if (division !== 'all') params.division = division;

  const { data, isLoading } = useApiGet<RevenueData>(['report-revenue', dateFrom, dateTo, division], '/v1/reports/revenue-summary', params);
  if (isLoading) return <Skeleton className="h-80" />;
  if (!data) return null;

  const chartData = [...data.monthly].reverse().map((m) => ({ month: m.period.slice(5), revenue: Number(m.revenue) }));
  const ytdChange = Number(data.priorYtd) > 0 ? ((Number(data.ytd) - Number(data.priorYtd)) / Number(data.priorYtd) * 100).toFixed(1) : 'N/A';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <KPI label="YTD Revenue" value={data.ytd} />
        <KPI label="Prior Year YTD" value={data.priorYtd} />
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">YoY Change</p><p className={`text-2xl font-bold ${Number(ytdChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{ytdChange === 'N/A' ? 'N/A' : `${ytdChange}%`}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Revenue</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} /><Bar dataKey="revenue" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function DivisionTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isLoading } = useApiGet<DivisionData[]>(['report-division', dateFrom, dateTo], '/v1/reports/revenue-by-division', params);
  if (isLoading) return <Skeleton className="h-80" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No division data available.</p>;

  const chartData = data.map((d) => ({ name: d.division.replace(/_/g, ' '), value: Number(d.revenue) }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Revenue by Division</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart><Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>{chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} /><Legend /></PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function AgingTab({ division }: { division: string }) {
  const params: Record<string, string> = {};
  if (division !== 'all') params.division = division;

  const { data, isLoading } = useApiGet<AgingData[]>(['report-aging', division], '/v1/reports/invoice-aging', params);
  if (isLoading) return <Skeleton className="h-80" />;
  if (!data) return null;

  const bucketLabels: Record<string, string> = { current: 'Current', '30_days': '30 Days', '60_days': '60 Days', '90_plus': '90+ Days' };
  const chartData = data.map((d) => ({ name: bucketLabels[d.bucket] || d.bucket, total: Number(d.total), count: Number(d.count) }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {data.map((d) => (
          <Card key={d.bucket}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{bucketLabels[d.bucket] || d.bucket}</p>
              <p className="text-xl font-bold" style={{ color: AGING_COLORS[d.bucket] }}>${Number(d.total).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{d.count} invoices</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Invoice Aging</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} /><Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]}>{chartData.map((_, i) => <Cell key={i} fill={Object.values(AGING_COLORS)[i] || '#888'} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function RenewalsTab() {
  const { data, isLoading } = useApiGet<RenewalData[]>(['report-renewals'], '/v1/reports/contract-renewals', { days_ahead: '90' });
  if (isLoading) return <Skeleton className="h-60" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No contracts expiring in the next 90 days.</p>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Contract Renewals (Next 90 Days)</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Contract</th><th className="pb-2">Customer</th><th className="pb-2">Division</th><th className="pb-2">Value</th><th className="pb-2">Expires</th><th className="pb-2">Days</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.contract_number}</td>
                  <td className="py-2">{r.customer_name}</td>
                  <td className="py-2 capitalize">{r.division?.replace(/_/g, ' ') ?? '-'}</td>
                  <td className="py-2">${Number(r.total_value).toLocaleString()}</td>
                  <td className="py-2">{new Date(r.end_date).toLocaleDateString()}</td>
                  <td className="py-2"><span className={Number(r.days_until_expiry) <= 14 ? 'text-red-600 font-medium' : Number(r.days_until_expiry) <= 30 ? 'text-yellow-600' : ''}>{r.days_until_expiry}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CrewTab({ dateFrom, dateTo, division }: { dateFrom: string; dateTo: string; division: string }) {
  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  if (division !== 'all') params.division = division;

  const { data, isLoading } = useApiGet<CrewData[]>(['report-crew', dateFrom, dateTo, division], '/v1/reports/crew-productivity', params);
  if (isLoading) return <Skeleton className="h-60" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No crew productivity data.</p>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Crew Productivity</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Crew</th><th className="pb-2">Jobs</th><th className="pb-2">Est. Hours</th><th className="pb-2">Actual Hours</th><th className="pb-2">Efficiency</th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.crew_id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{c.crew_name}</td>
                  <td className="py-2">{c.jobs_completed}</td>
                  <td className="py-2">{(Number(c.total_estimated_minutes) / 60).toFixed(1)}</td>
                  <td className="py-2">{(Number(c.total_actual_minutes) / 60).toFixed(1)}</td>
                  <td className="py-2"><span className={Number(c.avg_efficiency) >= 100 ? 'text-green-600 font-medium' : 'text-red-600'}>{c.avg_efficiency}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TimeTab({ dateFrom, dateTo, division }: { dateFrom: string; dateTo: string; division: string }) {
  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  if (division !== 'all') params.division = division;

  const { data, isLoading } = useApiGet<TimeData[]>(['report-time', dateFrom, dateTo, division], '/v1/reports/time-tracking-summary', params);
  if (isLoading) return <Skeleton className="h-60" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No time tracking data.</p>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Time Tracking Summary</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Employee</th><th className="pb-2">Crew</th><th className="pb-2">Total Hours</th><th className="pb-2">Regular</th><th className="pb-2">Overtime</th></tr></thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.user_id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{t.user_name}</td>
                  <td className="py-2">{t.crew_name ?? '-'}</td>
                  <td className="py-2">{t.total_hours}</td>
                  <td className="py-2">{t.regular_hours}</td>
                  <td className="py-2"><span className={Number(t.overtime_hours) > 0 ? 'text-red-600 font-medium' : ''}>{t.overtime_hours}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SnowTab() {
  const { data, isLoading } = useApiGet<SnowData[]>(['report-snow'], '/v1/reports/snow-profitability');
  if (isLoading) return <Skeleton className="h-80" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No snow profitability data.</p>;

  const chartData = data.map((s) => ({ name: s.season_name, revenue: Number(s.total_revenue), cost: Number(s.total_labor_cost), profit: Number(s.profit) }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Snow Season Revenue vs Cost</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} /><Bar dataKey="revenue" fill="#22c55e" name="Revenue" /><Bar dataKey="cost" fill="#ef4444" name="Labor Cost" /><Legend /></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {data.map((s) => (
          <Card key={s.season_id}>
            <CardContent className="pt-6 space-y-1">
              <p className="font-medium text-sm">{s.season_name}</p>
              <p className="text-xs text-muted-foreground">{s.total_runs} runs, {s.total_entries} entries</p>
              <p className="text-xs">Revenue: <span className="font-medium">${Number(s.total_revenue).toLocaleString()}</span></p>
              <p className="text-xs">Cost: <span className="font-medium">${Number(s.total_labor_cost).toLocaleString()}</span></p>
              <p className={`text-sm font-bold ${Number(s.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>Profit: ${Number(s.profit).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PipelineTab() {
  const { data, isLoading } = useApiGet<PipelineData>(['report-pipeline'], '/v1/reports/hardscape-pipeline');
  if (isLoading) return <Skeleton className="h-80" />;
  if (!data) return null;

  const chartData = data.byStage.map((s) => ({ stage: s.stage.replace(/_/g, ' '), count: Number(s.count), value: Number(s.total_value) }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total Projects</p><p className="text-2xl font-bold">{data.metrics.total_projects}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Win Rate</p><p className="text-2xl font-bold text-green-600">{data.metrics.win_rate}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Won / Lost</p><p className="text-2xl font-bold">{data.metrics.won} / {data.metrics.lost}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Avg Days to Close</p><p className="text-2xl font-bold">{Math.round(Number(data.metrics.avg_days_to_close))}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline by Stage</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="stage" /><YAxis /><Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} /><Bar dataKey="value" fill="hsl(210, 76%, 50%)" name="Total Value" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function ConversionTab() {
  const { data, isLoading } = useApiGet<ConversionData[]>(['report-conversion'], '/v1/reports/prospect-conversion');
  if (isLoading) return <Skeleton className="h-60" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No prospect conversion data.</p>;

  const chartData = data.map((d) => ({ name: d.source, value: Number(d.conversion_rate) }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Conversion Rate by Source</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis unit="%" /><Tooltip formatter={(v: number) => `${v}%`} /><Bar dataKey="value" fill="hsl(142, 76%, 36%)" name="Conversion Rate" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Source</th><th className="pb-2">Total</th><th className="pb-2">Converted</th><th className="pb-2">Rate</th><th className="pb-2">Value</th></tr></thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.source} className="border-b last:border-0">
                    <td className="py-2 font-medium capitalize">{d.source}</td>
                    <td className="py-2">{d.total}</td>
                    <td className="py-2">{d.converted}</td>
                    <td className="py-2 text-green-600 font-medium">{d.conversion_rate}%</td>
                    <td className="py-2">${Number(d.total_value).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [division, setDivision] = useState('all');

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Analytics & business intelligence" />

      <div className="flex flex-wrap gap-3">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" placeholder="To" />
        <Select value={division} onValueChange={setDivision}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Division" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            <SelectItem value="landscaping_maintenance">Landscaping Maintenance</SelectItem>
            <SelectItem value="landscaping_projects">Landscaping Projects</SelectItem>
            <SelectItem value="hardscape">Hardscape</SelectItem>
            <SelectItem value="snow_removal">Snow Removal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="division">By Division</TabsTrigger>
          <TabsTrigger value="aging">Invoice Aging</TabsTrigger>
          <TabsTrigger value="renewals">Renewals</TabsTrigger>
          <TabsTrigger value="crew">Crew</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="snow">Snow</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue"><RevenueTab dateFrom={dateFrom} dateTo={dateTo} division={division} /></TabsContent>
        <TabsContent value="division"><DivisionTab dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="aging"><AgingTab division={division} /></TabsContent>
        <TabsContent value="renewals"><RenewalsTab /></TabsContent>
        <TabsContent value="crew"><CrewTab dateFrom={dateFrom} dateTo={dateTo} division={division} /></TabsContent>
        <TabsContent value="time"><TimeTab dateFrom={dateFrom} dateTo={dateTo} division={division} /></TabsContent>
        <TabsContent value="snow"><SnowTab /></TabsContent>
        <TabsContent value="pipeline"><PipelineTab /></TabsContent>
        <TabsContent value="conversion"><ConversionTab /></TabsContent>
      </Tabs>
    </div>
  );
}
