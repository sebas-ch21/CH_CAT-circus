import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { useAuth } from '../context/AuthContext';
import { useDispatchData } from '../hooks/useDispatchData';
import { WaitingQueue } from '../components/manager/WaitingQueue';
import { OpenSlots } from '../components/manager/OpenSlots';
import { DispatchActionPanel } from '../components/manager/DispatchActionPanel';
import { ScheduledMatchesTable } from '../components/manager/ScheduledMatchesTable';
import { ZoomLinkModal } from '../components/manager/ZoomLinkModal';
import toast from 'react-hot-toast';
import { Clock, CircleCheck as CheckCircle2, Users, ChartBar as BarChart3, Save, Loader } from 'lucide-react';

const TIME_INTERVALS = [
  { val: '07:00', label: '07:00 AM MT' }, { val: '07:30', label: '07:30 AM MT' },
  { val: '08:00', label: '08:00 AM MT' }, { val: '08:30', label: '08:30 AM MT' },
  { val: '09:00', label: '09:00 AM MT' }, { val: '09:30', label: '09:30 AM MT' },
  { val: '10:00', label: '10:00 AM MT' }, { val: '10:30', label: '10:30 AM MT' },
  { val: '11:00', label: '11:00 AM MT' }, { val: '11:30', label: '11:30 AM MT' },
  { val: '12:00', label: '12:00 PM MT' }, { val: '12:30', label: '12:30 PM MT' },
  { val: '13:00', label: '01:00 PM MT' }, { val: '13:30', label: '01:30 PM MT' },
  { val: '14:00', label: '02:00 PM MT' }, { val: '14:30', label: '02:30 PM MT' },
  { val: '15:00', label: '03:00 PM MT' }, { val: '15:30', label: '03:30 PM MT' },
  { val: '16:00', label: '04:00 PM MT' }, { val: '16:30', label: '04:30 PM MT' },
  { val: '17:00', label: '05:00 PM MT' }
];

function getDualTimes(isoString, tz) {
  const ofDate = new Date(isoString);
  const bpsDate = new Date(ofDate.getTime() - 15 * 60000);
  return {
    bps: bpsDate.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }),
    of: ofDate.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  };
}

const getWeekDates = (dateStr) => {
  const [year, month, day] = dateStr.split('-');
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - dayOfWeek + 1);
  const dates = [];
  for (let i = 0; i < 7; i++) {
     const cd = new Date(d);
     cd.setUTCDate(d.getUTCDate() + i);
     dates.push(cd.toISOString().split('T')[0]);
  }
  return dates;
};

export function ManagerCenter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dispatch');
  const { queue, openSlots, scheduledSlots, fetchData } = useDispatchData();

  const [selectedIC, setSelectedIC] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [timeZone, setTimeZone] = useState('America/Denver');
  const [editingSlot, setEditingSlot] = useState(null);

  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamSchedule, setTeamSchedule] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [stats, setStats] = useState({ total: 0, byIC: {}, byTier: { 1: 0, 2: 0, 3: 0 } });
  const [statsPreset, setStatsPreset] = useState('this_week');
  const [statsStart, setStatsStart] = useState('');
  const [statsEnd, setStatsEnd] = useState('');

  const updateDateRange = (preset) => {
    setStatsPreset(preset);
    const now = new Date();
    let start = new Date(), end = new Date();
    if (preset === 'this_week') { const day = now.getDay() || 7; start.setDate(now.getDate() - day + 1); end.setDate(start.getDate() + 6); }
    else if (preset === 'last_week') { const day = now.getDay() || 7; start.setDate(now.getDate() - day - 6); end.setDate(start.getDate() + 6); }
    else if (preset === 'this_month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
    else if (preset === 'last_month') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (preset === 'last_7_days') { start.setDate(now.getDate() - 7); }
    else if (preset === 'custom') return;
    setStatsStart(start.toISOString().split('T')[0]);
    setStatsEnd(end.toISOString().split('T')[0]);
  };

  const loadStatistics = async () => {
    if (!statsStart || !statsEnd) return;
    const { data: logs } = await supabase
      .from('dispatch_logs').select('*')
      .gte('matched_at', new Date(`${statsStart}T00:00:00`).toISOString())
      .lte('matched_at', new Date(`${statsEnd}T23:59:59`).toISOString());
    if (logs) {
      const byIC = {}, byTier = { 1: 0, 2: 0, 3: 0 };
      logs.forEach(log => {
        byIC[log.ic_email] = (byIC[log.ic_email] || 0) + 1;
        byTier[log.tier_rank] = (byTier[log.tier_rank] || 0) + 1;
      });
      setStats({ total: logs.length, byIC, byTier });
    }
  };

  const loadMySchedule = async () => {
    if (!user?.email) return;
    const dates = getWeekDates(scheduleDate);
    const { data } = await supabase.from('manager_schedules')
      .select('schedule_date, schedule_data')
      .eq('manager_email', user.email)
      .gte('schedule_date', dates[0])
      .lte('schedule_date', dates[6]);

    const newSched = {};
    dates.forEach(d => newSched[d] = {});
    if (data) {
      data.forEach(row => {
        newSched[row.schedule_date] = row.schedule_data || {};
      });
    }
    setTeamSchedule(newSched);
  };

  const handleScheduleChange = (dateStr, timeVal, val) => {
    setTeamSchedule(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [timeVal]: val === '' ? '' : parseInt(val)
      }
    }));
  };

  const saveMySchedule = async () => {
    setSavingSchedule(true);
    const dates = getWeekDates(scheduleDate);
    const upserts = dates.map(dStr => ({
      manager_email: user.email,
      schedule_date: dStr,
      schedule_data: teamSchedule[dStr] || {},
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('manager_schedules').upsert(upserts, { onConflict: 'manager_email, schedule_date' });
    if (error) {
      toast.error('Failed to save schedule');
      console.error(error);
    } else {
      toast.success('Schedule saved');
      await loadMySchedule();
    }
    setSavingSchedule(false);
  };

  useEffect(() => { updateDateRange('this_week'); }, []);
  useEffect(() => {
    if (activeTab === 'team') loadMySchedule();
  }, [activeTab, scheduleDate, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'stats') loadStatistics();
  }, [activeTab, statsStart, statsEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDispatchComplete = async () => {
    setSelectedIC(null);
    setSelectedSlot(null);
    await fetchData();
  };

  const getTabClass = (id) =>
    `px-5 py-4 font-semibold text-sm transition-colors border-b-2 focus:outline-none ${
      activeTab === id
        ? 'border-[#005682] text-[#12142A] bg-white'
        : 'border-transparent text-[#58534C] hover:text-[#12142A] hover:bg-[#F1ECE7]'
    }`;

  return (
    <div className="min-h-[100dvh] ch-paper flex flex-col pb-20">
      <TopNav />
      <div className="max-w-[1440px] mx-auto px-6 py-10 w-full flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-micro text-[#58534C] font-semibold mb-2">
              Manager Center
            </p>
            <h1 className="font-display text-[44px] sm:text-[52px] text-[#12142A] tracking-tight leading-none">
              Live dispatch &amp; team rhythm
            </h1>
            <p className="text-[#58534C] mt-3 font-medium max-w-xl">
              Route patients to available ICs, coordinate your team schedule, and watch performance in real time.
            </p>
          </div>
          <div className="bg-white border border-[#EDE7DE] rounded-full p-1 flex font-semibold text-sm">
            <button
              onClick={() => setTimeZone('America/Denver')}
              className={`px-5 py-2 rounded-full transition-colors ${timeZone === 'America/Denver' ? 'bg-[#12142A] text-[#FAF8F5]' : 'text-[#58534C] hover:bg-[#F1ECE7]'}`}
            >
              MT
            </button>
            <button
              onClick={() => setTimeZone('America/Chicago')}
              className={`px-5 py-2 rounded-full transition-colors ${timeZone === 'America/Chicago' ? 'bg-[#12142A] text-[#FAF8F5]' : 'text-[#58534C] hover:bg-[#F1ECE7]'}`}
            >
              CT
            </button>
          </div>
        </div>

        <div className="flex rounded-t-2xl border border-[#EDE7DE] border-b-0 overflow-hidden bg-white mb-0">
          <button onClick={() => setActiveTab('dispatch')} className={getTabClass('dispatch')}>
            <div className="flex items-center gap-2"><Clock className="w-4 h-4" strokeWidth={1.8} /> Live dispatch</div>
          </button>
          <button onClick={() => setActiveTab('scheduled')} className={getTabClass('scheduled')}>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" strokeWidth={1.8} /> Scheduled matches</div>
          </button>
          <button onClick={() => setActiveTab('team')} className={getTabClass('team')}>
            <div className="flex items-center gap-2"><Users className="w-4 h-4" strokeWidth={1.8} /> Team schedule</div>
          </button>
          <button onClick={() => setActiveTab('stats')} className={getTabClass('stats')}>
            <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4" strokeWidth={1.8} /> Statistics</div>
          </button>
        </div>

        <div className="bg-white border border-[#EDE7DE] rounded-b-2xl p-6 sm:p-8 flex-1">
          {activeTab === 'dispatch' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <WaitingQueue queue={queue} selectedIC={selectedIC} onSelectIC={setSelectedIC} />
              <OpenSlots
                openSlots={openSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                onEditSlot={setEditingSlot}
                getDualTimes={getDualTimes}
                timeZone={timeZone}
              />
              <DispatchActionPanel
                selectedIC={selectedIC}
                selectedSlot={selectedSlot}
                onDispatchComplete={handleDispatchComplete}
                getDualTimes={getDualTimes}
                timeZone={timeZone}
              />
            </div>
          )}

          {activeTab === 'scheduled' && (
            <div>
              <h2 className="font-display text-2xl text-[#12142A] mb-6 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#335649]" strokeWidth={1.8} /> Today&rsquo;s matches
              </h2>
              <ScheduledMatchesTable
                scheduledSlots={scheduledSlots}
                getDualTimes={getDualTimes}
                timeZone={timeZone}
                onDataChange={fetchData}
              />
            </div>
          )}

          {activeTab === 'team' && (
            <div className="max-w-[1200px] mx-auto w-full">
              <div className="sticky top-0 z-20 bg-white pt-2 pb-5 border-b border-[#EDE7DE] mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-micro text-[#58534C] font-semibold">Team</p>
                  <h2 className="font-display text-3xl text-[#12142A] flex items-center gap-2 leading-tight">
                    <Users className="w-6 h-6 text-[#005682]" strokeWidth={1.8} /> My team schedule
                  </h2>
                </div>
                <div className="flex items-end gap-3 bg-[#F1ECE7] p-3 rounded-xl border border-[#EDE7DE]">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#58534C] uppercase tracking-micro mb-1">Target date</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="px-3 py-2 border border-[#D7D1C8] rounded-lg font-semibold text-[#12142A] focus:border-[#005682] outline-none bg-white"
                    />
                  </div>
                  <button
                    onClick={saveMySchedule}
                    disabled={savingSchedule}
                    className="bg-[#12142A] text-[#FAF8F5] font-semibold px-4 py-2.5 rounded-lg hover:bg-[#011537] disabled:opacity-50 transition-colors flex items-center gap-2 h-[42px] ch-focus-ring"
                  >
                    {savingSchedule ? <Loader className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" strokeWidth={1.8} /> Save</>}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex font-semibold text-[10px] text-[#58534C] uppercase tracking-micro px-4 pb-2 border-b border-[#EDE7DE] mb-2">
                  <div className="w-24">Time (MT)</div>
                  {getWeekDates(scheduleDate).map(d => {
                    const label = new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
                    return <div key={d} className="flex-1 text-center">{label}</div>;
                  })}
                </div>
                {TIME_INTERVALS.map(int => (
                  <div
                    key={int.val}
                    className="flex items-center p-2 hover:bg-[#F1ECE7] rounded-xl transition-colors border border-transparent hover:border-[#EDE7DE] group"
                  >
                    <div className="w-24 font-semibold text-[#495654] text-sm group-hover:text-[#005682] whitespace-nowrap overflow-hidden text-ellipsis">
                      {int.label.replace(' MT', '')}
                    </div>
                    {getWeekDates(scheduleDate).map(d => (
                      <div key={d} className="flex-1 px-1">
                        <input
                          type="number" min="0" placeholder="0"
                          value={teamSchedule[d]?.[int.val] !== undefined ? teamSchedule[d][int.val] : ''}
                          onChange={(e) => handleScheduleChange(d, int.val, e.target.value)}
                          className="w-full px-2 py-2 border border-transparent bg-[#F1ECE7] hover:border-[#D7D1C8] rounded-lg text-center font-semibold text-sm text-[#005682] focus:bg-white focus:border-[#005682] focus:ring-0 outline-none transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-2 gap-4 border-b border-[#EDE7DE] pb-6">
                <div>
                  <p className="text-[11px] uppercase tracking-micro text-[#58534C] font-semibold mb-1">Performance</p>
                  <h2 className="font-display text-3xl text-[#12142A] flex items-center gap-2 leading-tight">
                    <BarChart3 className="w-6 h-6 text-[#005682]" strokeWidth={1.8} /> Dispatch statistics
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-[#F1ECE7] p-3 rounded-xl border border-[#EDE7DE]">
                  <select
                    value={statsPreset}
                    onChange={(e) => updateDateRange(e.target.value)}
                    className="px-4 py-2 border border-[#D7D1C8] rounded-lg font-semibold text-[#12142A] focus:border-[#005682] outline-none bg-white"
                  >
                    <option value="last_7_days">Last 7 days</option>
                    <option value="this_week">This week</option>
                    <option value="last_week">Last week</option>
                    <option value="this_month">This month</option>
                    <option value="last_month">Last month</option>
                    <option value="custom">Custom range...</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={statsStart}
                      onChange={(e) => { setStatsPreset('custom'); setStatsStart(e.target.value); }}
                      className="px-3 py-2 border border-[#D7D1C8] rounded-lg font-semibold text-[#495654] outline-none focus:border-[#005682] bg-white"
                    />
                    <span className="text-[#A29A8E] font-semibold">to</span>
                    <input
                      type="date"
                      value={statsEnd}
                      onChange={(e) => { setStatsPreset('custom'); setStatsEnd(e.target.value); }}
                      className="px-3 py-2 border border-[#D7D1C8] rounded-lg font-semibold text-[#495654] outline-none focus:border-[#005682] bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-[#12142A] rounded-2xl p-8 text-[#FAF8F5] relative overflow-hidden">
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-[#A8C8C2] mb-4">Total dispatches</p>
                  <p className="font-display text-[72px] leading-none tracking-tight">{stats.total}</p>
                </div>
                <div className="bg-[#CFE4EB] border border-[#A8C8C2] rounded-2xl p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-[#005682] mb-4">Tier 1 dispatches</p>
                  <p className="font-display text-[72px] leading-none tracking-tight text-[#12142A]">{stats.byTier[1] || 0}</p>
                </div>
                <div className="bg-[#E8F0EE] border border-[#A8C8C2] rounded-2xl p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-[#335649] mb-4">Tier 2 / 3 dispatches</p>
                  <p className="font-display text-[72px] leading-none tracking-tight text-[#12142A]">
                    {(stats.byTier[2] || 0) + (stats.byTier[3] || 0)}
                  </p>
                </div>
              </div>

              <h3 className="font-display text-xl text-[#12142A] mb-4">Dispatches per IC</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.byIC).sort((a, b) => b[1] - a[1]).map(([email, count]) => (
                  <div
                    key={email}
                    className="flex justify-between items-center p-4 border border-[#EDE7DE] rounded-xl bg-[#FAF8F5]"
                  >
                    <span className="font-semibold text-[#12142A] truncate pr-4">{email.split('@')[0]}</span>
                    <span className="bg-[#12142A] text-[#FAF8F5] px-3 py-1 rounded-full font-semibold text-sm">{count}</span>
                  </div>
                ))}
                {Object.keys(stats.byIC).length === 0 && (
                  <div className="col-span-full text-center py-10 text-[#A29A8E] font-medium border border-dashed border-[#D7D1C8] rounded-xl bg-[#FAF8F5]">
                    No dispatch logs in this date range.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {editingSlot && (
        <ZoomLinkModal
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSave={fetchData}
        />
      )}
    </div>
  );
}
