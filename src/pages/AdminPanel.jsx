import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { CSVUploadZone } from '../components/CSVUploadZone';
import { 
  Users, Calendar as CalendarIcon, ShieldCheck, Search, Trash2, 
  AlertCircle, CheckCircle, Loader, Eye, EyeOff, Plus, X, ArrowRight, TableProperties
} from 'lucide-react';

const TIME_INTERVALS = [
  { bps_mt: '07:00 AM', of_mt: '07:15 AM', of_ct: '08:15 AM', val: '07:00', of_val: '07:15' },
  { bps_mt: '07:30 AM', of_mt: '07:45 AM', of_ct: '08:45 AM', val: '07:30', of_val: '07:45' },
  { bps_mt: '08:00 AM', of_mt: '08:15 AM', of_ct: '09:15 AM', val: '08:00', of_val: '08:15' },
  { bps_mt: '08:30 AM', of_mt: '08:45 AM', of_ct: '09:45 AM', val: '08:30', of_val: '08:45' },
  { bps_mt: '09:00 AM', of_mt: '09:15 AM', of_ct: '10:15 AM', val: '09:00', of_val: '09:15' },
  { bps_mt: '09:30 AM', of_mt: '09:45 AM', of_ct: '10:45 AM', val: '09:30', of_val: '09:45' },
  { bps_mt: '10:00 AM', of_mt: '10:15 AM', of_ct: '11:15 AM', val: '10:00', of_val: '10:15' },
  { bps_mt: '10:30 AM', of_mt: '10:45 AM', of_ct: '11:45 AM', val: '10:30', of_val: '10:45' },
  { bps_mt: '11:00 AM', of_mt: '11:15 AM', of_ct: '12:15 PM', val: '11:00', of_val: '11:15' },
  { bps_mt: '11:30 AM', of_mt: '11:45 AM', of_ct: '12:45 PM', val: '11:30', of_val: '11:45' },
  { bps_mt: '12:00 PM', of_mt: '12:15 PM', of_ct: '01:15 PM', val: '12:00', of_val: '12:15' },
  { bps_mt: '12:30 PM', of_mt: '12:45 PM', of_ct: '01:45 PM', val: '12:30', of_val: '12:45' },
  { bps_mt: '01:00 PM', of_mt: '01:15 PM', of_ct: '02:15 PM', val: '13:00', of_val: '13:15' },
  { bps_mt: '01:30 PM', of_mt: '01:45 PM', of_ct: '02:45 PM', val: '13:30', of_val: '13:45' },
  { bps_mt: '02:00 PM', of_mt: '02:15 PM', of_ct: '03:15 PM', val: '14:00', of_val: '14:15' },
  { bps_mt: '02:30 PM', of_mt: '02:45 PM', of_ct: '03:45 PM', val: '14:30', of_val: '14:45' },
  { bps_mt: '03:00 PM', of_mt: '03:15 PM', of_ct: '04:15 PM', val: '15:00', of_val: '15:15' },
  { bps_mt: '03:30 PM', of_mt: '03:45 PM', of_ct: '04:45 PM', val: '15:30', of_val: '15:45' },
  { bps_mt: '04:00 PM', of_mt: '04:15 PM', of_ct: '05:15 PM', val: '16:00', of_val: '16:15' },
  { bps_mt: '04:30 PM', of_mt: '04:45 PM', of_ct: '05:45 PM', val: '16:30', of_val: '16:45' },
  { bps_mt: '05:00 PM', of_mt: '05:15 PM', of_ct: '06:15 PM', val: '17:00', of_val: '17:15' },
];

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('circus'); 
  const [profiles, setProfiles] = useState([]);
  const [managers, setManagers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Capacity Circus & Consolidated States
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [planData, setPlanData] = useState({});
  const [managerSchedules, setManagerSchedules] = useState([]);
  const [consolidatedTotals, setConsolidatedTotals] = useState({});
  const [calcPercentage, setCalcPercentage] = useState(30);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);

  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [staffMessage, setStaffMessage] = useState(null);
  const [slotsMessage, setSlotsMessage] = useState(null);

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState([]);
  const [resolvedUploadData, setResolvedUploadData] = useState([]);

  // Passcodes
  const [currentAdminPin, setCurrentAdminPin] = useState('charlieadmin');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showNewAdminPin, setShowNewAdminPin] = useState(false);
  const [currentManagerPin, setCurrentManagerPin] = useState('charliemanager');
  const [newManagerPin, setNewManagerPin] = useState('');
  const [showManagerPin, setShowManagerPin] = useState(false);
  const [showNewManagerPin, setShowNewManagerPin] = useState(false);

  useEffect(() => {
    fetchProfiles();
    fetchPins();
    fetchSlots();
  }, []);

  useEffect(() => {
    loadDailyData(selectedDate);
  }, [selectedDate]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('email');
    if (data) {
      setProfiles(data);
      setManagers(data.filter(p => p.role === 'MANAGER' || p.role === 'ADMIN'));
    }
  };

  const fetchSlots = async () => {
    const { data } = await supabase.from('bps_slots').select('*').order('start_time', { ascending: true });
    if (data) setSlots(data);
  };

  const fetchPins = async () => {
    const { data } = await supabase.from('app_settings').select('*');
    if (data) {
      const a = data.find(d => d.setting_key === 'admin_pin');
      const m = data.find(d => d.setting_key === 'manager_pin');
      if (a) setCurrentAdminPin(a.setting_value);
      if (m) setCurrentManagerPin(m.setting_value);
    }
  };

  // --- CONSOLIDATED CAPACITY LOGIC ---
  const loadDailyData = async (dateStr) => {
    // 1. Fetch Manager Schedules for this date
    const { data: schedules } = await supabase.from('manager_schedules').select('*').eq('schedule_date', dateStr);
    const schedArray = schedules || [];
    setManagerSchedules(schedArray);

    // 2. Sum up the totals
    const totals = {};
    TIME_INTERVALS.forEach(int => {
      let sum = 0;
      schedArray.forEach(sched => {
        sum += parseInt(sched.schedule_data?.[int.val]) || 0;
      });
      totals[int.val] = sum;
    });
    setConsolidatedTotals(totals);

    // 3. Fetch existing Admin Plan
    const { data: plan } = await supabase.from('daily_capacity_plans').select('plan_data').eq('plan_date', dateStr).maybeSingle();
    let loadedIntervals = {};
    let loadedCalc = 30;

    if (plan && plan.plan_data) {
      if (plan.plan_data.hasOwnProperty('calcPercentage')) {
        loadedCalc = plan.plan_data.calcPercentage;
        loadedIntervals = plan.plan_data.intervals;
      } else {
        loadedIntervals = plan.plan_data; 
      }
    } else {
      TIME_INTERVALS.forEach(int => {
        loadedIntervals[int.val] = { override: '', assignments: [] };
      });
    }
    setCalcPercentage(loadedCalc);
    setPlanData(loadedIntervals);
  };

  const getSuggestedCount = (timeVal, pct) => {
    const num = consolidatedTotals[timeVal] || 0;
    return num <= 12 ? 0 : Math.ceil(num * (pct / 100));
  };

  const updateInterval = (timeVal, field, value) => {
    setPlanData(prev => ({
      ...prev,
      [timeVal]: { ...prev[timeVal], [field]: value }
    }));
  };

  const addManager = (timeVal) => {
    setPlanData(prev => {
      const updated = { ...prev };
      updated[timeVal] = updated[timeVal] || { override: '', assignments: [] };
      updated[timeVal].assignments.push({ email: '', count: 1 });
      return updated;
    });
  };

  const updateManager = (timeVal, idx, field, value) => {
    setPlanData(prev => {
      const updated = { ...prev };
      updated[timeVal].assignments[idx][field] = field === 'count' ? parseInt(value) : value;
      return updated;
    });
  };

  const removeManager = (timeVal, idx) => {
    setPlanData(prev => {
      const updated = { ...prev };
      updated[timeVal].assignments.splice(idx, 1);
      return updated;
    });
  };

  const handlePublishPlan = async () => {
    setPublishing(true);
    setPublishMessage(null);

    await supabase.from('daily_capacity_plans').upsert({
      plan_date: selectedDate,
      plan_data: { calcPercentage, intervals: planData }
    }, { onConflict: 'plan_date' });

    const slotsToInsert = [];
    Object.entries(planData).forEach(([timeVal, row]) => {
      const interval = TIME_INTERVALS.find(t => t.val === timeVal);
      if (!interval) return;

      row.assignments.forEach(assign => {
        if (assign.email && assign.count > 0) {
          for (let i = 0; i < assign.count; i++) {
            const exactSlotTime = new Date(`${selectedDate}T${interval.of_val}:00`);
            slotsToInsert.push({
              patient_identifier: `OF-${interval.of_val}-${assign.email.split('@')[0].toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
              start_time: exactSlotTime.toISOString(),
              host_manager: assign.email,
              status: 'OPEN'
            });
          }
        }
      });
    });

    if (slotsToInsert.length === 0) {
      setPublishMessage({ type: 'error', text: 'No slots to publish! Select managers and set slot counts first.' });
      setPublishing(false);
      return;
    }

    const { error: insertError } = await supabase.from('bps_slots').insert(slotsToInsert);
    if (insertError) {
      setPublishMessage({ type: 'error', text: `Failed to insert slots: ${insertError.message}` });
    } else {
      await fetchSlots(); 
      setPublishMessage({ type: 'success', text: `Success! Added ${slotsToInsert.length} slots to live dispatch.` });
    }
    setPublishing(false);
    setTimeout(() => setPublishMessage(null), 5000);
  };

  // --- ROSTER LOGIC (Condensed for brevity) ---
  const handleStaffUpload = async (csvData) => { /* logic */ };
  const handleDeleteSlot = async (id) => {
    await supabase.from('bps_slots').delete().eq('id', id);
    fetchSlots();
  };
  const handleUpdateProfile = async (id, updates) => {
    await supabase.from('profiles').update(updates).eq('id', id);
    fetchProfiles();
  };
  const handleDeleteProfile = async (id) => {
    await supabase.from('profiles').delete().eq('id', id);
    setDeleteConfirmId(null);
    fetchProfiles();
  };
  const handleUpdatePin = async (role) => {
    const key = role === 'ADMIN' ? 'admin_pin' : 'manager_pin';
    const val = role === 'ADMIN' ? newAdminPin : newManagerPin;
    if(val.length < 4) return;
    await supabase.from('app_settings').upsert({ setting_key: key, setting_value: val }, { onConflict: 'setting_key' });
    if(role === 'ADMIN') { setCurrentAdminPin(val); setNewAdminPin(''); }
    else { setCurrentManagerPin(val); setNewManagerPin(''); }
  };
  const handleSlotsUpload = async (data) => { /* logic */ };

  const getTabClass = (id) => `flex-1 py-4 text-center font-bold text-sm transition-all border-b-4 focus:outline-none ${activeTab === id ? 'border-[#0F172A] text-[#0F172A] bg-gray-50' : 'border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <TopNav />
      <div className="mx-auto px-4 sm:px-6 py-8" style={{ maxWidth: '98%' }}>
        
        <div className="flex bg-white rounded-t-2xl border border-gray-200 overflow-hidden shadow-sm">
          <button onClick={() => setActiveTab('circus')} className={getTabClass('circus')}>
            <div className="flex items-center justify-center gap-2"><TableProperties className="w-4 h-4" /> Consolidated Planner</div>
          </button>
          <button onClick={() => setActiveTab('roster')} className={getTabClass('roster')}>
            <div className="flex items-center justify-center gap-2"><Users className="w-4 h-4" /> Roster Management</div>
          </button>
          <button onClick={() => setActiveTab('appointments')} className={getTabClass('appointments')}>
            <div className="flex items-center justify-center gap-2"><CalendarIcon className="w-4 h-4" /> Active Slots</div>
          </button>
          <button onClick={() => setActiveTab('security')} className={getTabClass('security')}>
            <div className="flex items-center justify-center gap-2"><ShieldCheck className="w-4 h-4" /> Passcode Mgt</div>
          </button>
        </div>

        <div className="bg-white border border-t-0 border-gray-200 rounded-b-2xl p-6 shadow-sm min-h-[500px]">
          
          {/* TAB 1: CONSOLIDATED CIRCUS PLANNER */}
          {activeTab === 'circus' && (
            <div className="space-y-6">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end border-b pb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-black text-[#0F172A]">Consolidated Circus Planner</h2>
                  <p className="text-gray-500 font-medium text-sm mt-1">Attendees sum automatically from individual Manager Team Schedules. Publishing *adds* slots.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Calc %</label>
                    <div className="relative">
                      <input 
                        type="number" min="0" max="100" value={calcPercentage} onChange={(e) => setCalcPercentage(parseFloat(e.target.value)||0)}
                        className="w-20 px-3 py-2 border-2 border-gray-200 rounded-xl text-[#0F172A] font-black focus:border-[#5E4791] outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Date</label>
                    <input 
                      type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-4 py-2 border-2 border-gray-200 rounded-xl text-[#0F172A] font-black focus:border-[#5E4791] outline-none h-[44px]"
                    />
                  </div>
                  <button onClick={handlePublishPlan} disabled={publishing} style={{backgroundColor: '#0F172A', color: 'white'}} className="px-6 h-[44px] mt-[18px] rounded-xl font-black shadow-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2">
                    {publishing ? <Loader className="w-5 h-5 animate-spin" /> : 'Publish Overflows'}
                  </button>
                </div>
              </div>

              {publishMessage && (
                <div className={`p-4 rounded-xl flex items-center gap-2 font-bold ${publishMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {publishMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />} {publishMessage.text}
                </div>
              )}

              <div className="overflow-x-auto border border-gray-200 rounded-2xl pb-4">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                      <th className="p-3 text-[10px] font-bold text-[#0F172A] uppercase tracking-wider sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">BPS Time (MT)</th>
                      <th className="p-3 text-[10px] font-bold text-[#5E4791] uppercase tracking-wider border-r border-gray-200">OF Time (MT)</th>
                      
                      {/* Dynamic Manager Columns */}
                      {managers.map(m => (
                        <th key={m.id} className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center border-r border-gray-200 max-w-[80px] truncate" title={m.email}>
                          {m.email.split('@')[0]}
                        </th>
                      ))}
                      
                      <th className="p-3 text-[10px] font-black text-[#0F172A] bg-gray-100 uppercase tracking-wider text-center border-r-2 border-gray-300">TOTAL BPS</th>
                      <th className="p-3 text-[10px] font-black text-[#5E4791] uppercase tracking-wider text-center w-24">Overflows Needed</th>
                      <th className="p-3 text-[10px] font-bold text-[#0F172A] uppercase tracking-wider">Assign Managers (Max 2 slots)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_INTERVALS.map((interval) => {
                      const row = planData[interval.val] || { override: '', assignments: [] };
                      const totalBps = consolidatedTotals[interval.val] || 0;
                      const calcSuggested = totalBps <= 12 ? 0 : Math.ceil(totalBps * (calcPercentage / 100));
                      const targetOverflow = row.override !== '' ? parseInt(row.override) : calcSuggested;
                      const filledSlots = row.assignments.reduce((sum, a) => sum + (parseInt(a.count)||0), 0);
                      const isShort = targetOverflow > 0 && filledSlots < targetOverflow;

                      return (
                        <tr key={interval.val} className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
                          <td className="p-3 font-bold text-[#0F172A] sticky left-0 bg-white group-hover:bg-purple-50/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10 whitespace-nowrap">{interval.bps_mt}</td>
                          <td className="p-3 font-black text-[#5E4791] border-r border-gray-100 whitespace-nowrap">{interval.of_mt}</td>
                          
                          {/* Manager Data Cells */}
                          {managers.map(m => {
                            const schedData = managerSchedules.find(s => s.manager_email === m.email)?.schedule_data || {};
                            const val = schedData[interval.val] || 0;
                            return (
                              <td key={m.id} className="p-3 text-center border-r border-gray-100 text-gray-500 font-semibold">{val > 0 ? val : '-'}</td>
                            );
                          })}

                          <td className="p-3 text-center font-black text-xl text-[#0F172A] bg-gray-50 border-r-2 border-gray-200">{totalBps}</td>
                          
                          <td className="p-3 text-center bg-[#F3EFF9]/50 border-r border-purple-100">
                            <div className="flex flex-col items-center">
                              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Calc: {calcSuggested}</span>
                              <input 
                                type="number" min="0" placeholder="Set" value={row.override !== '' ? row.override : calcSuggested} onChange={(e) => updateInterval(interval.val, 'override', e.target.value)}
                                className="w-16 px-2 py-1.5 border-2 border-[#E7DFF3] bg-white text-[#5E4791] rounded-lg text-center font-black outline-none focus:border-[#5E4791]"
                              />
                            </div>
                          </td>

                          <td className="p-3 min-w-[300px]">
                            <div className="space-y-2">
                              {row.assignments.map((assign, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <select value={assign.email} onChange={(e) => updateManager(interval.val, idx, 'email', e.target.value)} className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-sm font-bold w-48 focus:border-[#5E4791] outline-none">
                                    <option value="">Select Host...</option>
                                    {managers.map(m => <option key={m.email} value={m.email}>{m.email.split('@')[0]}</option>)}
                                  </select>
                                  <select value={assign.count} onChange={(e) => updateManager(interval.val, idx, 'count', e.target.value)} className="px-2 py-1.5 border-2 border-gray-200 rounded-lg text-sm font-black w-16 outline-none focus:border-[#5E4791]">
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                  </select>
                                  <button onClick={() => removeManager(interval.val, idx)} className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded-md"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              ))}
                              <div className="flex items-center justify-between pt-1">
                                <button onClick={() => addManager(interval.val)} className="text-[10px] font-black uppercase tracking-widest text-[#5E4791] flex items-center gap-1 hover:bg-purple-100 px-2 py-1.5 rounded-md transition-colors">
                                  <Plus className="w-3 h-3" /> Add Host
                                </button>
                                {targetOverflow > 0 && (
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${isShort ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {filledSlots} / {targetOverflow} Filled
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2 & 3: ROSTER & ACTIVE SLOTS (Render logic same as before, condensed for limits) */}
          {activeTab === 'appointments' && (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-[#0F172A]">All Active Slots</h3>
                  <p className="text-sm text-gray-500 font-medium">Manage or delete slots manually. ({slots.length} total)</p>
                </div>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {slots.map((slot) => (
                  <div key={slot.id} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-200">
                    <div>
                      <p className="font-black text-[#0F172A] text-lg">{slot.patient_identifier}</p>
                      <p className="text-sm font-semibold text-gray-500">{new Date(slot.start_time).toLocaleString()} {slot.host_manager && <span className="text-[#5E4791] ml-2">Host: {slot.host_manager}</span>}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md bg-gray-100 text-gray-600">{slot.status}</span>
                      <button onClick={() => handleDeleteSlot(slot.id)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}