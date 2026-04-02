import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { CSVUploadZone } from '../components/CSVUploadZone';
import { 
  Users, Calendar as CalendarIcon, ShieldCheck, Search, Trash2, 
  AlertCircle, CheckCircle, Loader, Eye, EyeOff, Plus, X
} from 'lucide-react';

const TIME_INTERVALS = [
  { mt: '07:00 AM', ct: '08:00 AM', val: '07:00' },
  { mt: '07:30 AM', ct: '08:30 AM', val: '07:30' },
  { mt: '08:00 AM', ct: '09:00 AM', val: '08:00' },
  { mt: '08:30 AM', ct: '09:30 AM', val: '08:30' },
  { mt: '09:00 AM', ct: '10:00 AM', val: '09:00' },
  { mt: '09:30 AM', ct: '10:30 AM', val: '09:30' },
  { mt: '10:00 AM', ct: '11:00 AM', val: '10:00' },
  { mt: '10:30 AM', ct: '11:30 AM', val: '10:30' },
  { mt: '11:00 AM', ct: '12:00 PM', val: '11:00' },
  { mt: '11:30 AM', ct: '12:30 PM', val: '11:30' },
  { mt: '12:00 PM', ct: '01:00 PM', val: '12:00' },
  { mt: '12:30 PM', ct: '01:30 PM', val: '12:30' },
  { mt: '01:00 PM', ct: '02:00 PM', val: '13:00' },
  { mt: '01:30 PM', ct: '02:30 PM', val: '13:30' },
  { mt: '02:00 PM', ct: '03:00 PM', val: '14:00' },
  { mt: '02:30 PM', ct: '03:30 PM', val: '14:30' },
  { mt: '03:00 PM', ct: '04:00 PM', val: '15:00' },
  { mt: '03:30 PM', ct: '04:30 PM', val: '15:30' },
  { mt: '04:00 PM', ct: '05:00 PM', val: '16:00' },
  { mt: '04:30 PM', ct: '05:30 PM', val: '16:30' },
  { mt: '05:00 PM', ct: '06:00 PM', val: '17:00' },
];

export function AdminPanel() {
  // SETTING CIRCUS AS DEFAULT TAB
  const [activeTab, setActiveTab] = useState('circus'); 
  const [profiles, setProfiles] = useState([]);
  const [managers, setManagers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Capacity Circus States
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [planData, setPlanData] = useState({});
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);

  // Roster States
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffMessage, setStaffMessage] = useState(null);
  
  // PIN States
  const [currentAdminPin, setCurrentAdminPin] = useState('charlieadmin');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showNewAdminPin, setShowNewAdminPin] = useState(false);
  const [updatingAdmin, setUpdatingAdmin] = useState(false);
  
  const [currentManagerPin, setCurrentManagerPin] = useState('charliemanager');
  const [newManagerPin, setNewManagerPin] = useState('');
  const [showManagerPin, setShowManagerPin] = useState(false);
  const [showNewManagerPin, setShowNewManagerPin] = useState(false);
  const [updatingManager, setUpdatingManager] = useState(false);

  useEffect(() => {
    fetchProfiles();
    fetchPins();
  }, []);

  useEffect(() => {
    loadDailyPlan(selectedDate);
  }, [selectedDate]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('email');
    if (data) {
      setProfiles(data);
      setManagers(data.filter(p => p.role === 'MANAGER' || p.role === 'ADMIN'));
    }
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

  // --- CAPACITY CIRCUS LOGIC ---
  const loadDailyPlan = async (dateStr) => {
    const { data } = await supabase.from('daily_capacity_plans').select('plan_data').eq('plan_date', dateStr).maybeSingle();
    
    if (data && data.plan_data) {
      setPlanData(data.plan_data);
    } else {
      const initial = {};
      TIME_INTERVALS.forEach(int => {
        initial[int.val] = { attendees: '', suggested: 0, override: '', assignments: [] };
      });
      setPlanData(initial);
    }
  };

  const updateInterval = (timeVal, field, value) => {
    setPlanData(prev => {
      const updated = { ...prev };
      const row = { ...updated[timeVal] };
      row[field] = value;

      if (field === 'attendees') {
        const num = parseInt(value) || 0;
        row.suggested = num <= 12 ? 0 : Math.ceil(num * 0.3);
      }
      
      updated[timeVal] = row;
      return updated;
    });
  };

  const addManager = (timeVal) => {
    setPlanData(prev => {
      const updated = { ...prev };
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
      plan_data: planData
    }, { onConflict: 'plan_date' });

    const startOfDay = new Date(`${selectedDate}T00:00:00Z`).toISOString();
    const endOfDay = new Date(`${selectedDate}T23:59:59Z`).toISOString();
    await supabase.from('bps_slots').delete().gte('start_time', startOfDay).lte('start_time', endOfDay).eq('status', 'OPEN');

    const slotsToInsert = [];
    Object.entries(planData).forEach(([timeVal, row]) => {
      row.assignments.forEach(assign => {
        if (assign.email && assign.count > 0) {
          for (let i = 0; i < assign.count; i++) {
            const localDateStr = `${selectedDate}T${timeVal}:00`;
            const dateObj = new Date(localDateStr);
            slotsToInsert.push({
              patient_identifier: `OF-${timeVal}-${assign.email.split('@')[0]}-${i+1}`,
              start_time: dateObj.toISOString(),
              host_manager: assign.email,
              status: 'OPEN'
            });
          }
        }
      });
    });

    if (slotsToInsert.length > 0) {
      await supabase.from('bps_slots').insert(slotsToInsert);
    }

    setPublishMessage({ type: 'success', text: `Published ${slotsToInsert.length} slots to the live dispatch board!` });
    setPublishing(false);
    setTimeout(() => setPublishMessage(null), 4000);
  };

  // --- ROSTER LOGIC ---
  const handleStaffUpload = async (csvData) => {
    setLoadingStaff(true);
    setStaffMessage(null);

    const validatedData = csvData.map((row) => ({
      email: row.email?.trim().toLowerCase(),
      role: row.role?.trim().toUpperCase(),
      tier_rank: parseInt(row.tier_rank) || 3,
      current_status: 'AVAILABLE',
    }));

    const cleanData = validatedData.filter(d => d.email && ['ADMIN', 'MANAGER', 'IC'].includes(d.role));
    if (cleanData.length === 0) {
      setStaffMessage({ type: 'error', text: 'No valid staff data found.' });
      setLoadingStaff(false);
      return;
    }

    try {
      for (const row of cleanData) {
        await supabase.from('profiles').upsert(row, { onConflict: 'email' });
      }
      await fetchProfiles();
      setStaffMessage({ type: 'success', text: `Successfully updated ${cleanData.length} staff members` });
    } catch (error) { 
      setStaffMessage({ type: 'error', text: `Error: ${error.message}` }); 
    }
    setLoadingStaff(false);
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

  const filteredProfiles = profiles.filter(p => p.email.toLowerCase().includes(userSearchTerm.toLowerCase()));

  const getTabClass = (id) => `flex-1 py-4 text-center font-bold text-sm transition-all border-b-4 focus:outline-none ${activeTab === id ? 'border-[#0F172A] text-[#0F172A] bg-gray-50' : 'border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <TopNav />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        
        <div className="flex bg-white rounded-t-2xl border border-gray-200 overflow-hidden shadow-sm">
          <button onClick={() => setActiveTab('circus')} className={getTabClass('circus')}>
            <div className="flex items-center justify-center gap-2"><CalendarIcon className="w-4 h-4" /> Capacity Planning</div>
          </button>
          <button onClick={() => setActiveTab('roster')} className={getTabClass('roster')}>
            <div className="flex items-center justify-center gap-2"><Users className="w-4 h-4" /> Roster Management</div>
          </button>
          <button onClick={() => setActiveTab('security')} className={getTabClass('security')}>
            <div className="flex items-center justify-center gap-2"><ShieldCheck className="w-4 h-4" /> Passcode Management</div>
          </button>
        </div>

        <div className="bg-white border border-t-0 border-gray-200 rounded-b-2xl p-6 shadow-sm min-h-[500px]">
          
          {/* TAB 1: CAPACITY CIRCUS SPREADSHEET */}
          {activeTab === 'circus' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b pb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A]">Capacity Circus Planner</h2>
                  <p className="text-gray-500 text-sm mt-1">Plan overflows based on estimated attendance. Slots are capped at 2 per manager per interval.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Select Date</label>
                    <input 
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-[#0F172A] font-bold focus:ring-2 focus:ring-[#5E4791] outline-none"
                    />
                  </div>
                  <button 
                    onClick={handlePublishPlan}
                    disabled={publishing}
                    style={{backgroundColor: '#0F172A', color: 'white'}}
                    className="px-6 py-2 sm:mt-4 rounded-xl font-bold shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {publishing ? <Loader className="w-5 h-5 animate-spin" /> : 'Publish to Live Dispatch'}
                  </button>
                </div>
              </div>

              {publishMessage && (
                <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl flex items-center gap-2 font-bold">
                  <CheckCircle className="w-5 h-5" /> {publishMessage.text}
                </div>
              )}

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-4 text-xs font-bold text-[#0F172A] uppercase">Time (MT)</th>
                      <th className="p-4 text-xs font-bold text-[#0F172A] uppercase">Time (CT)</th>
                      <th className="p-4 text-xs font-bold text-[#0F172A] uppercase w-32">Est. Attendees</th>
                      <th className="p-4 text-xs font-bold text-[#5E4791] uppercase w-40">Overflow Needs</th>
                      <th className="p-4 text-xs font-bold text-[#0F172A] uppercase">Assign Managers (Max 2 slots/mgr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_INTERVALS.map((interval) => {
                      const row = planData[interval.val] || { attendees: '', suggested: 0, override: '', assignments: [] };
                      const targetOverflow = row.override !== '' ? parseInt(row.override) : row.suggested;
                      const filledSlots = row.assignments.reduce((sum, a) => sum + (parseInt(a.count)||0), 0);
                      const isShort = filledSlots < targetOverflow;

                      return (
                        <tr key={interval.val} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="p-4 font-semibold text-[#0F172A]">{interval.mt}</td>
                          <td className="p-4 font-semibold text-gray-500">{interval.ct}</td>
                          <td className="p-4">
                            <input 
                              type="number" min="0" placeholder="0"
                              value={row.attendees}
                              onChange={(e) => updateInterval(interval.val, 'attendees', e.target.value)}
                              className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-center font-semibold outline-none focus:border-[#5E4791]"
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm font-medium w-14">Calc: {row.suggested}</span>
                              <input 
                                type="number" min="0" placeholder="Set"
                                value={row.override !== '' ? row.override : row.suggested}
                                onChange={(e) => updateInterval(interval.val, 'override', e.target.value)}
                                className="w-16 px-2 py-1.5 border-2 border-[#E7DFF3] bg-[#F3EFF9] text-[#5E4791] rounded-lg text-center font-bold outline-none"
                              />
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="space-y-2">
                              {row.assignments.map((assign, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <select 
                                    value={assign.email}
                                    onChange={(e) => updateManager(interval.val, idx, 'email', e.target.value)}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium w-48 focus:ring-1 focus:ring-[#5E4791] outline-none"
                                  >
                                    <option value="">Select Manager...</option>
                                    {managers.map(m => <option key={m.email} value={m.email}>{m.email}</option>)}
                                  </select>
                                  <select
                                    value={assign.count}
                                    onChange={(e) => updateManager(interval.val, idx, 'count', e.target.value)}
                                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-bold w-16 outline-none"
                                  >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                  </select>
                                  <button onClick={() => removeManager(interval.val, idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              ))}
                              <div className="flex items-center justify-between mt-2">
                                <button onClick={() => addManager(interval.val)} className="text-xs font-bold text-[#5E4791] flex items-center gap-1 hover:bg-purple-50 px-2 py-1 rounded transition-colors">
                                  <Plus className="w-3 h-3" /> Add Manager
                                </button>
                                {targetOverflow > 0 && (
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${isShort ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
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

          {/* TAB 2: ROSTER MANAGEMENT */}
          {activeTab === 'roster' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-4">
                <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-[#0F172A] mb-4">Import Staff CSV</h3>
                  <CSVUploadZone onUpload={handleStaffUpload} title="Drop Staff Data" description="Requires: email, role, tier_rank" expectedColumns={['email', 'role', 'tier_rank']} />
                  {staffMessage && (
                    <div className={`mt-4 p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${staffMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {staffMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {staffMessage.text}
                    </div>
                  )}
                  {loadingStaff && <div className="mt-4 flex items-center justify-center gap-2 text-[#5E4791] font-medium p-4 bg-purple-50 rounded-xl"><Loader className="w-4 h-4 animate-spin" /> Processing...</div>}
                </div>
              </div>

              <div className="xl:col-span-8 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A]">Current Roster</h3>
                    <p className="text-sm text-gray-500">{profiles.length} Active Members</p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                      type="text" placeholder="Search by email..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5E4791] outline-none shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-200 mb-2">
                  <div className="flex-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Staff Member</div>
                  <div className="w-32 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Role</div>
                  <div className="w-28 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Tier</div>
                  <div className="w-20 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Action</div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[600px]">
                  {filteredProfiles.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 p-3 sm:p-4 bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-all group">
                      <div className="flex-1 min-w-0 font-bold text-sm sm:text-base text-[#0F172A] truncate" title={p.email}>{p.email}</div>
                      <div className="w-32 flex-shrink-0">
                        <select value={p.role} onChange={(e) => handleUpdateProfile(p.id, { role: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg outline-none px-2 py-1.5 text-sm font-semibold">
                          <option value="ADMIN">Admin</option>
                          <option value="MANAGER">Manager</option>
                          <option value="IC">IC (Staff)</option>
                        </select>
                      </div>
                      <div className="w-28 flex-shrink-0">
                        <select value={p.tier_rank || 3} onChange={(e) => handleUpdateProfile(p.id, { tier_rank: parseInt(e.target.value) })} className="w-full bg-gray-50 border border-gray-200 rounded-lg outline-none px-2 py-1.5 text-sm font-semibold">
                          <option value="1">Tier 1</option>
                          <option value="2">Tier 2</option>
                          <option value="3">Tier 3</option>
                        </select>
                      </div>
                      <div className="w-20 flex-shrink-0 flex justify-end">
                        {deleteConfirmId === p.id ? (
                          <div className="flex gap-1 items-center">
                            <button onClick={() => handleDeleteProfile(p.id)} className="bg-red-600 text-white px-2 py-1.5 rounded text-[10px] font-bold hover:bg-red-700">Yes</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="text-gray-400 hover:text-gray-600 px-1 py-1.5 rounded"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(p.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PASSCODE MANAGEMENT */}
          {activeTab === 'security' && (
            <div className="max-w-4xl mx-auto py-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck className="w-6 h-6 text-[#0F172A]" />
                    <h3 className="text-lg font-bold text-[#0F172A]">Admin PIN</h3>
                  </div>
                  <div className="space-y-4">
                    <input type="password" value={currentAdminPin} readOnly className="w-full px-4 py-3 bg-gray-100/80 border border-gray-200 rounded-xl outline-none font-mono" />
                    <div className="flex gap-2 mt-4">
                      <input type="text" value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} placeholder="New PIN" className="flex-1 px-4 py-3 border border-gray-300 rounded-xl outline-none" />
                      <button onClick={() => handleUpdatePin('ADMIN')} style={{backgroundColor:'#0F172A', color:'white'}} className="px-6 rounded-xl font-bold">Save</button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <Users className="w-6 h-6 text-[#5E4791]" />
                    <h3 className="text-lg font-bold text-[#0F172A]">Manager PIN</h3>
                  </div>
                  <div className="space-y-4">
                    <input type="password" value={currentManagerPin} readOnly className="w-full px-4 py-3 bg-gray-100/80 border border-gray-200 rounded-xl outline-none font-mono" />
                    <div className="flex gap-2 mt-4">
                      <input type="text" value={newManagerPin} onChange={(e) => setNewManagerPin(e.target.value)} placeholder="New PIN" className="flex-1 px-4 py-3 border border-gray-300 rounded-xl outline-none" />
                      <button onClick={() => handleUpdatePin('MANAGER')} style={{backgroundColor:'#5E4791', color:'white'}} className="px-6 rounded-xl font-bold">Save</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}