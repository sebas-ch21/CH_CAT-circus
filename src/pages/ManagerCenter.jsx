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

  useEffect(() => { updateDateRange('this_week'); }, []);
  useEffect(() => { if (activeTab === 'team') loadMySchedule(); }, [activeTab, scheduleDate]);
  useEffect(() => { if (activeTab === 'stats') loadStatistics(); }, [activeTab, statsStart, statsEnd]);

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

  const handleDispatchComplete = async () => {
    setSelectedIC(null);
    setSelectedSlot(null);
    await fetchData();
  };

  const getTabClass = (id) =>
    `px-6 py-4 font-bold text-sm transition-all border-b-4 focus:outline-none ${
      activeTab === id
        ? 'border-[#5E4791] text-[#0F172A] bg-white'
        : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20 font-sans relative">
      <TopNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8 w-full flex-1 flex flex-col">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#0F172A]">Manager Center</h1>
            <p className="text-gray-500 mt-1 font-medium">Live dispatching, team schedules, and performance tracking.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex font-bold text-sm shadow-sm">
            <button onClick={() => setTimeZone('America/Denver')} className={`px-5 py-2 rounded-lg transition-all ${timeZone === 'America/Denver' ? 'bg-[#0F172A] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>MT</button>
            <button onClick={() => setTimeZone('America/Chicago')} className={`px-5 py-2 rounded-lg transition-all ${timeZone === 'America/Chicago' ? 'bg-[#0F172A] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>CT</button>
          </div>
        </div>

        <div className="flex rounded-t-2xl border border-gray-200 overflow-hidden shadow-sm mb-6 bg-white">
          <button onClick={() => setActiveTab('dispatch')} className={getTabClass('dispatch')}>
            <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Live Dispatch</div>
          </button>
          <button onClick={() => setActiveTab('scheduled')} className={getTabClass('scheduled')}>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Scheduled Matches</div>
          </button>
          <button onClick={() => setActiveTab('team')} className={getTabClass('team')}>
            <div className="flex items-center gap-2"><Users className="w-4 h-4" /> My Team Schedule</div>
          </button>
          <button onClick={() => setActiveTab('stats')} className={getTabClass('stats')}>
            <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Dispatch Statistics</div>
          </button>
        </div>

        {activeTab === 'dispatch' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1">
            <WaitingQueue
              queue={queue}
              selectedIC={selectedIC}
              onSelectIC={setSelectedIC}
            />
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
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex-1">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" /> Today's Matches
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
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-[1200px] mx-auto w-full">
            <div className="sticky top-0 z-20 bg-white pt-2 pb-4 border-b border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shadow-sm">
              <div>
                <h2 className="text-2xl font-black text-[#0F172A] flex items-center gap-2">
                  <Users className="w-6 h-6 text-[#5E4791]" /> My Team Schedule
                </h2>
              </div>
              <div className="flex items-end gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Date</label>
                  <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg font-black text-[#0F172A] focus:border-[#5E4791] outline-none" />
                </div>
                <button onClick={saveMySchedule} disabled={savingSchedule} className="bg-[#0F172A] text-white font-black px-4 py-2.5 rounded-lg shadow-md hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-2 h-[42px]">
                  {savingSchedule ? <Loader className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex font-black text-[10px] text-gray-400 uppercase tracking-widest px-4 pb-2 border-b border-gray-200 mb-2">
                <div className="w-24">Time (MT)</div>
                {getWeekDates(scheduleDate).map(d => {
                  const label = new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
                  return <div key={d} className="flex-1 text-center">{label}</div>;
                })}
              </div>
              {TIME_INTERVALS.map(int => (
                <div key={int.val} className="flex items-center p-2 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100 group">
                  <div className="w-24 font-bold text-gray-700 text-sm group-hover:text-[#5E4791] whitespace-nowrap overflow-hidden text-ellipsis">{int.label.replace(' MT', '')}</div>
                  {getWeekDates(scheduleDate).map(d => (
                    <div key={d} className="flex-1 px-1">
                      <input
                        type="number" min="0" placeholder="0"
                        value={teamSchedule[d]?.[int.val] !== undefined ? teamSchedule[d][int.val] : ''}
                        onChange={(e) => handleScheduleChange(d, int.val, e.target.value)}
                        className="w-full px-2 py-2 border-2 border-transparent bg-gray-50 hover:border-gray-200 rounded-lg text-center font-black text-sm text-[#5E4791] focus:bg-white focus:border-[#5E4791] focus:ring-0 outline-none transition-colors"
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
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-gray-100 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-[#0F172A] mb-2 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-[#007C8C]" /> Dispatch Statistics
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <select value={statsPreset} onChange={(e) => updateDateRange(e.target.value)} className="px-4 py-2 border-2 border-gray-200 rounded-lg font-bold text-[#0F172A] focus:border-[#007C8C] outline-none">
                    <option value="last_7_days">Last 7 Days</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="custom">Custom Range...</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input type="date" value={statsStart} onChange={(e) => { setStatsPreset('custom'); setStatsStart(e.target.value); }} className="px-3 py-2 border-2 border-gray-200 rounded-lg font-bold text-gray-600 outline-none focus:border-[#007C8C]" />
                    <span className="text-gray-400 font-bold">to</span>
                    <input type="date" value={statsEnd} onChange={(e) => { setStatsPreset('custom'); setStatsEnd(e.target.value); }} className="px-3 py-2 border-2 border-gray-200 rounded-lg font-bold text-gray-600 outline-none focus:border-[#007C8C]" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-[#F3EFF9] border border-[#E7DFF3] rounded-2xl p-6 text-center shadow-sm">
                  <p className="text-xs font-black text-[#5E4791] uppercase tracking-widest mb-2">Total Dispatches</p>
                  <p className="text-5xl font-black text-[#0F172A]">{stats.total}</p>
                </div>
                <div className="bg-[#E0F5F6] border border-[#C1ECEF] rounded-2xl p-6 text-center shadow-sm">
                  <p className="text-xs font-black text-[#007C8C] uppercase tracking-widest mb-2">Tier 1 Dispatches</p>
                  <p className="text-5xl font-black text-[#0F172A]">{stats.byTier[1] || 0}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Tier 2/3 Dispatches</p>
                  <p className="text-5xl font-black text-[#0F172A]">{(stats.byTier[2] || 0) + (stats.byTier[3] || 0)}</p>
                </div>
              </div>
              <h3 className="text-lg font-black text-[#0F172A] mb-4">Total Dispatches per IC</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.byIC).sort((a, b) => b[1] - a[1]).map(([email, count]) => (
                  <div key={email} className="flex justify-between items-center p-4 border-2 border-gray-100 rounded-xl bg-gray-50">
                    <span className="font-bold text-gray-700 truncate pr-4">{email.split('@')[0]}</span>
                    <span className="bg-[#0F172A] text-white px-3 py-1 rounded-lg font-black">{count}</span>
                  </div>
                ))}
                {Object.keys(stats.byIC).length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-400 font-medium border-2 border-dashed rounded-xl">No dispatch logs in this date range.</div>
                )}
              </div>
            </div>
          </div>
        )}
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
