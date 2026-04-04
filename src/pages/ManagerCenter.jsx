import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { useAuth } from '../context/AuthContext';
import { Clock, User, Calendar, CircleCheck, CheckCircle2, AlertCircle, X, Loader, Link as LinkIcon, BarChart3, Users } from 'lucide-react';

const TIME_INTERVALS = [
  { val: '07:00', label: '07:00 AM MT' }, { val: '07:30', label: '07:30 AM MT' }, { val: '08:00', label: '08:00 AM MT' },
  { val: '08:30', label: '08:30 AM MT' }, { val: '09:00', label: '09:00 AM MT' }, { val: '09:30', label: '09:30 AM MT' },
  { val: '10:00', label: '10:00 AM MT' }, { val: '10:30', label: '10:30 AM MT' }, { val: '11:00', label: '11:00 AM MT' },
  { val: '11:30', label: '11:30 AM MT' }, { val: '12:00', label: '12:00 PM MT' }, { val: '12:30', label: '12:30 PM MT' },
  { val: '13:00', label: '01:00 PM MT' }, { val: '13:30', label: '01:30 PM MT' }, { val: '14:00', label: '02:00 PM MT' },
  { val: '14:30', label: '02:30 PM MT' }, { val: '15:00', label: '03:00 PM MT' }, { val: '15:30', label: '03:30 PM MT' },
  { val: '16:00', label: '04:00 PM MT' }, { val: '16:30', label: '04:30 PM MT' }, { val: '17:00', label: '05:00 PM MT' }
];

export function ManagerCenter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dispatch'); // dispatch, scheduled, team, stats
  
  // Dispatch States
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);
  const [selectedIC, setSelectedIC] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [timeZone, setTimeZone] = useState('America/Denver'); 
  
  // Modal & Edit States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEditSlotModal, setShowEditSlotModal] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [zoomLinkInput, setZoomLinkInput] = useState('');
  
  // My Team Schedule States
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamSchedule, setTeamSchedule] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Statistics States
  const [stats, setStats] = useState({ total: 0, byIC: {}, byTier: { 1: 0, 2: 0, 3: 0 } });

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      runAutomatedSweeper();
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'team') loadMySchedule();
    if (activeTab === 'stats') loadStatistics();
  }, [activeTab, scheduleDate]);

  // --- AUTOMATED SWEEPER ---
  const runAutomatedSweeper = async () => {
    const now = new Date().getTime();
    
    // 1. Sweep Queue (25 Mins)
    const twentyFiveMinsAgo = new Date(now - 25 * 60000).toISOString();
    const { data: expiredQ } = await supabase.from('queue_entries').select('*').lt('entered_at', twentyFiveMinsAgo);
    if (expiredQ && expiredQ.length > 0) {
      const icIds = expiredQ.map(q => q.ic_id);
      await supabase.from('queue_entries').delete().in('id', expiredQ.map(q => q.id));
      await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).in('id', icIds);
    }

    // 2. Sweep Pending Confirmations (5 Mins)
    const fiveMinsAgo = new Date(now - 5 * 60000).toISOString();
    const { data: expiredS } = await supabase.from('bps_slots').select('*').eq('status', 'ASSIGNED').lt('assigned_at', fiveMinsAgo);
    if (expiredS && expiredS.length > 0) {
      const slotIds = expiredS.map(s => s.id);
      const icIds = expiredS.map(s => s.assigned_ic_id).filter(Boolean);
      await supabase.from('bps_slots').update({ status: 'OPEN', assigned_ic_id: null, assigned_at: null }).in('id', slotIds);
      if (icIds.length > 0) await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).in('id', icIds);
    }
  };

  // --- FETCH CORE DATA ---
  const fetchData = async () => {
    const { data: qData } = await supabase.from('queue_entries').select('*, profiles(email, tier_rank)').order('entered_at');
    if (qData) {
      setQueue(qData.sort((a, b) => {
        const tA = a.profiles?.tier_rank || 3;
        const tB = b.profiles?.tier_rank || 3;
        if (tA !== tB) return tA - tB;
        return new Date(a.entered_at) - new Date(b.entered_at);
      }));
    }

    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    const endOfToday = new Date(); endOfToday.setHours(23,59,59,999);

    const { data: oSlots } = await supabase.from('bps_slots').select('*').eq('status', 'OPEN').gte('start_time', startOfToday.toISOString()).lte('start_time', endOfToday.toISOString()).order('start_time');
    if (oSlots) setOpenSlots(oSlots);

    const { data: sSlots } = await supabase.from('bps_slots').select('*, profiles(email)').in('status', ['ASSIGNED', 'CONFIRMED']).gte('start_time', startOfToday.toISOString()).lte('start_time', endOfToday.toISOString()).order('start_time');
    if (sSlots) setScheduledSlots(sSlots);
  };

  const loadStatistics = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: logs } = await supabase.from('dispatch_logs').select('*').gte('matched_at', sevenDaysAgo.toISOString());
    
    if (logs) {
      const byIC = {};
      const byTier = { 1: 0, 2: 0, 3: 0 };
      logs.forEach(log => {
        byIC[log.ic_email] = (byIC[log.ic_email] || 0) + 1;
        byTier[log.tier_rank] = (byTier[log.tier_rank] || 0) + 1;
      });
      setStats({ total: logs.length, byIC, byTier });
    }
  };

  // --- MY TEAM SCHEDULE LOGIC ---
  const loadMySchedule = async () => {
    if (!user?.email) return;
    const { data } = await supabase.from('manager_schedules').select('schedule_data').eq('manager_email', user.email).eq('schedule_date', scheduleDate).maybeSingle();
    setTeamSchedule(data?.schedule_data || {});
  };

  const handleScheduleChange = (timeVal, attendeesStr) => {
    setTeamSchedule(prev => ({ ...prev, [timeVal]: parseInt(attendeesStr) || 0 }));
  };

  const saveMySchedule = async () => {
    setSavingSchedule(true);
    await supabase.from('manager_schedules').upsert({
      manager_email: user.email,
      schedule_date: scheduleDate,
      schedule_data: teamSchedule,
      updated_at: new Date().toISOString()
    }, { onConflict: 'manager_email, schedule_date' });
    setSavingSchedule(false);
  };

  // --- DISPATCH ACTIONS ---
  const openConfirmModal = () => {
    setZoomLinkInput(selectedSlot?.zoom_link || '');
    setShowConfirmModal(true);
  };

  const openEditModal = (slot) => {
    setSelectedSlot(slot);
    setZoomLinkInput(slot.zoom_link || '');
    setShowEditSlotModal(true);
  };

  const saveSlotEdit = async () => {
    await supabase.from('bps_slots').update({ zoom_link: zoomLinkInput }).eq('id', selectedSlot.id);
    setShowEditSlotModal(false);
    setSelectedSlot(null);
    fetchData();
  };

  const executeDispatch = async () => {
    if (!selectedIC || !selectedSlot) return;
    setDispatching(true);
    try {
      await supabase.from('bps_slots').update({
        status: 'ASSIGNED',
        assigned_ic_id: selectedIC.ic_id,
        assigned_at: new Date().toISOString(),
        zoom_link: zoomLinkInput || selectedSlot.zoom_link // Save link if added during dispatch
      }).eq('id', selectedSlot.id);

      await supabase.from('profiles').update({ current_status: 'BUSY' }).eq('id', selectedIC.ic_id);
      
      setSelectedIC(null);
      setSelectedSlot(null);
      setShowConfirmModal(false);
      fetchData();
    } catch (error) { console.error("Dispatch Error:", error); } 
    finally { setDispatching(false); }
  };

  const getDualTimes = (isoString) => {
    const ofDate = new Date(isoString);
    const bpsDate = new Date(ofDate.getTime() - 15 * 60000);
    return {
      bps: bpsDate.toLocaleTimeString('en-US', { timeZone: timeZone, hour: 'numeric', minute: '2-digit' }),
      of: ofDate.toLocaleTimeString('en-US', { timeZone: timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    };
  };

  const getTabClass = (id) => `px-6 py-4 font-bold text-sm transition-all border-b-4 focus:outline-none ${activeTab === id ? 'border-[#5E4791] text-[#0F172A] bg-white' : 'border-transparent text-gray-500 hover:text-gray-900 bg-gray-50'}`;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">
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

        <div className="flex rounded-t-2xl border border-gray-200 overflow-hidden shadow-sm mb-6">
          <button onClick={() => setActiveTab('dispatch')} className={getTabClass('dispatch')}><div className="flex items-center gap-2"><Clock className="w-4 h-4"/> Live Dispatch Board</div></button>
          <button onClick={() => setActiveTab('scheduled')} className={getTabClass('scheduled')}><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Scheduled Matches</div></button>
          <button onClick={() => setActiveTab('team')} className={getTabClass('team')}><div className="flex items-center gap-2"><Users className="w-4 h-4"/> My Team Schedule</div></button>
          <button onClick={() => setActiveTab('stats')} className={getTabClass('stats')}><div className="flex items-center gap-2"><BarChart3 className="w-4 h-4"/> Dispatch Statistics</div></button>
        </div>

        {/* TAB 1: LIVE DISPATCH */}
        {activeTab === 'dispatch' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1">
            
            <div className="xl:col-span-4 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col h-[700px]">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 flex items-center gap-2"><User className="w-5 h-5 text-[#5E4791]" /> Waiting Queue</h2>
                <span className="bg-[#F3EFF9] text-[#5E4791] px-3 py-1 rounded-full text-xs font-black">{queue.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {queue.map(entry => (
                  <button key={entry.id} onClick={() => setSelectedIC(entry)} className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedIC?.id === entry.id ? 'border-[#5E4791] bg-purple-50 shadow-md ring-4 ring-purple-500/20' : 'border-gray-100 hover:border-gray-300 bg-gray-50'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-black text-lg text-[#0F172A] truncate">{entry.profiles?.email?.split('@')[0]}</span>
                      <span className="bg-gray-800 text-white text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md shadow-sm">Tier {entry.profiles?.tier_rank}</span>
                    </div>
                    <div className="text-xs font-bold text-red-500 flex items-center gap-1.5 bg-red-50 w-fit px-2 py-1 rounded-md">
                      <Clock className="w-3 h-3" /> Wait: {Math.round((new Date() - new Date(entry.entered_at)) / 60000)} mins
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="xl:col-span-4 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col h-[700px]">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-[#007C8C]" /> Open Slots</h2>
                <span className="bg-[#E0F5F6] text-[#007C8C] px-3 py-1 rounded-full text-xs font-black">{openSlots.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {openSlots.map(slot => {
                  const times = getDualTimes(slot.start_time);
                  return (
                    <div key={slot.id} className={`w-full text-left p-4 rounded-xl border-2 transition-all flex flex-col ${selectedSlot?.id === slot.id ? 'border-[#007C8C] bg-[#E0F5F6] shadow-md ring-4 ring-[#007C8C]/20' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <div onClick={() => setSelectedSlot(slot)} className="cursor-pointer">
                        <div className="flex justify-between items-start mb-3">
                          <div className="font-black text-lg text-[#0F172A]">{slot.patient_identifier}</div>
                          {slot.host_manager && <span className="text-[#007C8C] font-bold text-[9px] uppercase tracking-widest bg-white border border-[#007C8C]/20 shadow-sm px-2 py-1 rounded-md">Host: {slot.host_manager.split('@')[0]}</span>}
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 rounded-lg p-2 mb-3 border border-gray-100">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center flex-1 border-r border-gray-200">
                            <span className="block text-gray-400 mb-0.5">BPS</span>
                            {times.bps}
                          </div>
                          <div className="text-[10px] font-bold text-[#5E4791] uppercase tracking-widest text-center flex-1">
                            <span className="block text-purple-300 mb-0.5">Overflow</span>
                            {times.of}
                          </div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(slot); }} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-dashed border-blue-200">
                        <LinkIcon className="w-3 h-3" /> {slot.zoom_link ? 'Edit Zoom Link' : 'Add Zoom Link'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="xl:col-span-4 bg-[#0F172A] rounded-2xl p-6 shadow-xl text-white flex flex-col h-[700px] relative overflow-hidden">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><CircleCheck className="w-5 h-5 text-[#007C8C]" /> Match & Dispatch</h2>
              
              <div className="space-y-4 flex-1">
                <div className="bg-white/5 p-5 rounded-xl border border-white/10">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><User className="w-3 h-3"/> Selected Staff (IC)</p>
                  {selectedIC ? <p className="font-bold text-xl text-white">{selectedIC.profiles.email.split('@')[0]}</p> : <p className="text-gray-500 italic font-medium">Waiting for selection...</p>}
                </div>
                
                <div className="bg-white/5 p-5 rounded-xl border border-white/10">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><Calendar className="w-3 h-3"/> Selected Room (Slot)</p>
                  {selectedSlot ? (
                    <div>
                      <p className="font-bold text-xl text-white mb-2">{selectedSlot.patient_identifier}</p>
                      <div className="bg-black/30 rounded-lg p-3 text-sm font-medium">
                        OF Time: <span className="text-purple-300 font-bold">{getDualTimes(selectedSlot.start_time).of}</span>
                      </div>
                    </div>
                  ) : <p className="text-gray-500 italic font-medium">Waiting for selection...</p>}
                </div>
              </div>

              <button onClick={openConfirmModal} disabled={!selectedIC || !selectedSlot} className="w-full mt-auto py-5 rounded-xl font-black text-lg transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 bg-white text-[#0F172A] hover:bg-gray-200">
                Initiate Dispatch
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULED MATCHES */}
        {activeTab === 'scheduled' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex-1">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6 flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-500" /> Today's Matches</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                    <th className="p-4 text-[10px] font-bold text-[#5E4791] uppercase tracking-widest">OF Time</th>
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">BPS Time</th>
                    <th className="p-4 text-[10px] font-bold text-[#0F172A] uppercase tracking-widest">Room ID</th>
                    <th className="p-4 text-[10px] font-bold text-[#007C8C] uppercase tracking-widest">Assigned Staff</th>
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">OF Host</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledSlots.length === 0 ? (
                    <tr><td colSpan="6" className="p-12 text-center text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-xl mt-4">No slots scheduled yet today.</td></tr>
                  ) : (
                    scheduledSlots.map(slot => {
                      const times = getDualTimes(slot.start_time);
                      return (
                        <tr key={slot.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${slot.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {slot.status === 'ASSIGNED' ? 'PENDING (5m)' : 'CONFIRMED'}
                            </span>
                          </td>
                          <td className="p-4 font-black text-[#5E4791]">{times.of}</td>
                          <td className="p-4 font-bold text-gray-400">{times.bps}</td>
                          <td className="p-4 font-black text-[#0F172A]">{slot.patient_identifier}</td>
                          <td className="p-4 font-bold text-[#007C8C]">{slot.profiles?.email?.split('@')[0] || 'Unknown'}</td>
                          <td className="p-4 font-bold text-gray-600">{slot.host_manager?.split('@')[0] || 'Unassigned'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: MY TEAM SCHEDULE */}
        {activeTab === 'team' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-end mb-8 border-b border-gray-100 pb-6">
              <div>
                <h2 className="text-2xl font-black text-[#0F172A] flex items-center gap-2"><Users className="w-6 h-6 text-[#5E4791]" /> My Team Schedule</h2>
                <p className="text-gray-500 font-medium mt-1">Input the total BPS appointments your team has per interval.</p>
              </div>
              <div className="text-right">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Date</label>
                <input 
                  type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-200 rounded-xl font-black text-[#0F172A] focus:ring-2 focus:ring-[#5E4791] outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex font-black text-[10px] text-gray-400 uppercase tracking-widest px-4 pb-2 border-b border-gray-200">
                <div className="flex-1">Time Interval (MT)</div>
                <div className="w-32 text-center">Team BPS Count</div>
              </div>
              {TIME_INTERVALS.map(int => (
                <div key={int.val} className="flex items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-200">
                  <div className="flex-1 font-bold text-gray-700 text-lg">{int.label}</div>
                  <input 
                    type="number" min="0" placeholder="0"
                    value={teamSchedule[int.val] || ''}
                    onChange={(e) => handleScheduleChange(int.val, e.target.value)}
                    className="w-24 px-3 py-2 border-2 border-gray-200 rounded-xl text-center font-black text-xl text-[#5E4791] focus:border-[#5E4791] outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
            
            <button onClick={saveMySchedule} disabled={savingSchedule} className="w-full mt-8 bg-[#0F172A] text-white font-black py-4 rounded-xl shadow-lg hover:bg-gray-800 transition-all flex justify-center items-center gap-2 text-lg">
              {savingSchedule ? <Loader className="w-6 h-6 animate-spin" /> : 'Save Team Schedule'}
            </button>
          </div>
        )}

        {/* TAB 4: STATISTICS */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              <h2 className="text-2xl font-black text-[#0F172A] mb-2 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-[#007C8C]" /> Dispatch Statistics (Last 7 Days)</h2>
              <p className="text-gray-500 font-medium mb-8">Performance metrics based on permanently logged successful dispatches.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-[#F3EFF9] border border-[#E7DFF3] rounded-2xl p-6 text-center">
                  <p className="text-xs font-black text-[#5E4791] uppercase tracking-widest mb-2">Total Dispatches</p>
                  <p className="text-5xl font-black text-[#0F172A]">{stats.total}</p>
                </div>
                <div className="bg-[#E0F5F6] border border-[#C1ECEF] rounded-2xl p-6 text-center">
                  <p className="text-xs font-black text-[#007C8C] uppercase tracking-widest mb-2">Tier 1 Dispatches</p>
                  <p className="text-5xl font-black text-[#0F172A]">{stats.byTier[1] || 0}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Tier 2/3 Dispatches</p>
                  <p className="text-5xl font-black text-[#0F172A]">{(stats.byTier[2] || 0) + (stats.byTier[3] || 0)}</p>
                </div>
              </div>

              <h3 className="text-lg font-black text-[#0F172A] mb-4">Total Dispatches per IC</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.byIC).sort((a,b)=>b[1]-a[1]).map(([email, count]) => (
                  <div key={email} className="flex justify-between items-center p-4 border-2 border-gray-100 rounded-xl bg-gray-50">
                    <span className="font-bold text-gray-700 truncate pr-4">{email.split('@')[0]}</span>
                    <span className="bg-[#0F172A] text-white px-3 py-1 rounded-lg font-black">{count}</span>
                  </div>
                ))}
                {Object.keys(stats.byIC).length === 0 && <div className="col-span-full text-center py-8 text-gray-400 font-medium border-2 border-dashed rounded-xl">No logs found for the last 7 days.</div>}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --- ADD ZOOM LINK MODAL --- */}
      {showEditSlotModal && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 p-8 text-center">
            <LinkIcon className="w-12 h-12 text-[#5E4791] mx-auto mb-4" />
            <h2 className="text-2xl font-black text-[#0F172A] mb-2">Add Zoom Link</h2>
            <p className="text-gray-500 font-medium mb-6">Attach a meeting link to Room <strong>{selectedSlot.patient_identifier}</strong> before dispatching.</p>
            <input 
              type="text" 
              placeholder="https://zoom.us/j/..." 
              value={zoomLinkInput} 
              onChange={(e) => setZoomLinkInput(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-medium focus:border-[#5E4791] focus:ring-0 outline-none mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowEditSlotModal(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100">Cancel</button>
              <button onClick={saveSlotEdit} className="flex-1 py-3 rounded-xl font-bold bg-[#5E4791] text-white hover:bg-[#4a3872] shadow-md">Save Link</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DISPATCH CONFIRMATION MODAL --- */}
      {showConfirmModal && selectedIC && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2"><AlertCircle className="w-6 h-6 text-[#007C8C]" /> Confirm Assignment</h2>
              <button onClick={() => setShowConfirmModal(false)} disabled={dispatching} className="text-gray-400 hover:text-gray-900 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8">
              <div className="bg-gray-50 border-2 border-gray-100 rounded-2xl p-5 shadow-sm space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Staff Member</span>
                  <span className="font-black text-[#007C8C] text-lg">{selectedIC.profiles.email.split('@')[0]}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Room ID</span>
                  <span className="font-black text-[#0F172A] text-lg">{selectedSlot.patient_identifier}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Overflow Time</span>
                  <span className="font-black text-[#5E4791] text-lg bg-purple-50 px-3 py-1 rounded-lg">{getDualTimes(selectedSlot.start_time).of}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><LinkIcon className="w-3 h-3"/> Zoom Link (Required for IC)</label>
                <input 
                  type="text" placeholder="Paste Zoom link here..." 
                  value={zoomLinkInput} onChange={(e) => setZoomLinkInput(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium focus:border-[#5E4791] focus:ring-0 outline-none"
                />
              </div>
            </div>

            <div className="p-6 flex gap-3 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setShowConfirmModal(false)} disabled={dispatching} className="flex-1 py-4 rounded-xl font-bold text-gray-600 bg-white border-2 border-gray-200 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={executeDispatch} disabled={dispatching} style={{ backgroundColor: '#0F172A', color: '#ffffff' }} className="flex-1 py-4 rounded-xl font-black shadow-lg hover:opacity-90 transition-opacity flex justify-center items-center gap-2">
                {dispatching ? <><Loader className="w-5 h-5 animate-spin"/> Routing...</> : 'Route IC Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}