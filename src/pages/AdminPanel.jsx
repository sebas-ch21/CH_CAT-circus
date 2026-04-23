import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { CSVUploadZone } from '../components/CSVUploadZone';
import {
  Users,
  Calendar as CalendarIcon,
  ShieldCheck,
  Search,
  Trash2,
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle,
  Loader,
  Eye,
  EyeOff,
  Lock,
  Plus,
  X,
  ArrowRight,
  TableProperties,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';

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

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [planData, setPlanData] = useState({});
  const [managerSchedules, setManagerSchedules] = useState([]);
  const [consolidatedTotals, setConsolidatedTotals] = useState({});
  const [calcPercentage, setCalcPercentage] = useState(30);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);

  const [, setLoadingStaff] = useState(false);
  const [staffMessage, setStaffMessage] = useState(null);

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState([]);

  const [isAddHeadcountModalOpen, setIsAddHeadcountModalOpen] = useState(false);
  const [newHeadcountEmail, setNewHeadcountEmail] = useState('');
  const [newHeadcountRole, setNewHeadcountRole] = useState('IC');
  const [newHeadcountTier, setNewHeadcountTier] = useState(3);
  const [isAddingHeadcount, setIsAddingHeadcount] = useState(false);
  const [addHeadcountError, setAddHeadcountError] = useState(null);

  const [newAdminPin, setNewAdminPin] = useState('');
  const [showNewAdminPin, setShowNewAdminPin] = useState(false);
  const [newManagerPin, setNewManagerPin] = useState('');
  const [showNewManagerPin, setShowNewManagerPin] = useState(false);

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

  const loadDailyData = async (dateStr) => {
    const { data: schedules } = await supabase.from('manager_schedules').select('*').eq('schedule_date', dateStr);
    const schedArray = schedules || [];
    setManagerSchedules(schedArray);

    const totals = {};
    TIME_INTERVALS.forEach(int => {
      let sum = 0;
      schedArray.forEach(sched => {
        sum += parseInt(sched.schedule_data?.[int.val]) || 0;
      });
      totals[int.val] = sum;
    });
    setConsolidatedTotals(totals);

    const { data: plan } = await supabase.from('daily_capacity_plans').select('plan_data').eq('plan_date', dateStr).maybeSingle();
    let loadedIntervals = {};
    let loadedCalc = 30;

    if (plan && plan.plan_data) {
      if (Object.prototype.hasOwnProperty.call(plan.plan_data, 'calcPercentage')) {
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

  useEffect(() => {
    fetchProfiles();
    fetchSlots();
  }, []);

  useEffect(() => {
    loadDailyData(selectedDate);
  }, [selectedDate]);


  const updateInterval = (timeVal, field, value) => {
    setPlanData(prev => ({
      ...prev,
      [timeVal]: { ...prev[timeVal], [field]: value }
    }));
  };

  const addManager = (timeVal) => {
    setPlanData(prev => {
      const row = prev[timeVal] || { override: '', assignments: [] };
      const totalBps = consolidatedTotals[timeVal] || 0;
      const calcSuggested = totalBps <= 12 ? 0 : Math.ceil(totalBps * (calcPercentage / 100));
      const targetOverflow = row.override !== '' ? parseInt(row.override) : calcSuggested;

      const currentFilled = row.assignments.reduce((sum, a) => sum + (parseInt(a.count)||0), 0);

      if (currentFilled + 1 > targetOverflow) {
        toast.error('Cannot allocate slots beyond total overflow slots needed.');
        return prev;
      }

      const updated = { ...prev };
      updated[timeVal] = { ...row, assignments: [...row.assignments, { email: '', count: 1 }] };
      return updated;
    });
  };

  const updateManager = (timeVal, idx, field, value) => {
    setPlanData(prev => {
      const row = prev[timeVal] || { override: '', assignments: [] };
      const totalBps = consolidatedTotals[timeVal] || 0;
      const calcSuggested = totalBps <= 12 ? 0 : Math.ceil(totalBps * (calcPercentage / 100));
      const targetOverflow = row.override !== '' ? parseInt(row.override) : calcSuggested;

      const currentFilled = row.assignments.reduce((sum, a) => sum + (parseInt(a.count)||0), 0);
      const oldCount = parseInt(row.assignments[idx].count) || 0;

      if (field === 'count') {
        const newCount = parseInt(value);
        if (currentFilled - oldCount + newCount > targetOverflow) {
          toast.error('Cannot allocate slots beyond total overflow slots needed.');
          return prev;
        }
      }

      const updated = { ...prev };
      const newAssignments = [...row.assignments];
      newAssignments[idx] = { ...newAssignments[idx], [field]: field === 'count' ? parseInt(value) : value };
      updated[timeVal] = { ...row, assignments: newAssignments };
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
            const slug = crypto.randomUUID().slice(0, 6).toUpperCase();
            slotsToInsert.push({
              patient_identifier: `OF-${interval.of_val}-${assign.email.split('@')[0].toUpperCase()}-${slug}`,
              start_time: exactSlotTime.toISOString(),
              host_manager: assign.email,
              status: 'OPEN'
            });
          }
        }
      });
    });

    if (slotsToInsert.length === 0) {
      setPublishMessage({ type: 'error', text: 'No slots to publish. Select managers and set slot counts first.' });
      setPublishing(false);
      return;
    }

    const { error: insertError } = await supabase.from('bps_slots').insert(slotsToInsert);
    if (insertError) {
      setPublishMessage({ type: 'error', text: `Failed to insert slots: ${insertError.message}` });
    } else {
      await fetchSlots();
      setPublishMessage({ type: 'success', text: `Added ${slotsToInsert.length} slots to live dispatch.` });

      const emptyPlan = {};
      TIME_INTERVALS.forEach(int => {
        emptyPlan[int.val] = { override: '0', assignments: [] };
      });
      setPlanData(emptyPlan);

      await supabase.from('daily_capacity_plans').upsert({
        plan_date: selectedDate,
        plan_data: { calcPercentage, intervals: emptyPlan }
      }, { onConflict: 'plan_date' });
    }
    setPublishing(false);
    setTimeout(() => setPublishMessage(null), 5000);
  };

  const filteredProfiles = profiles.filter(p =>
    p.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const resolveDuplicateRow = async (idx, choice) => {
    const dup = pendingDuplicates[idx];
    if (choice === 'new') {
      await supabase.from('profiles').update({ role: dup.new.role, tier_rank: dup.new.tier_rank }).eq('id', dup.old.id);
    }
    const remaining = pendingDuplicates.filter((_, i) => i !== idx);
    setPendingDuplicates(remaining);
    if (remaining.length === 0) {
      setShowDuplicateModal(false);
      fetchProfiles();
    }
  };

  const handleStaffUpload = async (csvData) => {
    setLoadingStaff(true);
    setStaffMessage(null);
    const duplicates = [];
    const newRows = [];
    for (const row of csvData) {
      if (!row.email) continue;
      const existing = profiles.find(p => p.email?.toLowerCase() === row.email.toLowerCase());
      if (existing) {
        duplicates.push({ old: existing, new: row });
      } else {
        newRows.push({ email: row.email.toLowerCase(), role: row.role || 'IC', tier_rank: parseInt(row.tier_rank) || 3 });
      }
    }
    if (newRows.length > 0) {
      const { error } = await supabase.from('profiles').insert(newRows);
      if (error) {
        setStaffMessage({ type: 'error', text: `Insert error: ${error.message}` });
      } else {
        setStaffMessage({ type: 'success', text: `Added ${newRows.length} new staff members.` });
      }
    }
    if (duplicates.length > 0) {
      setPendingDuplicates(duplicates);
      setShowDuplicateModal(true);
    }
    await fetchProfiles();
    setLoadingStaff(false);
  };

  const handleAddHeadcountSubmit = async (e) => {
    e.preventDefault();
    setAddHeadcountError(null);

    if (!newHeadcountEmail || newHeadcountEmail.trim() === '') {
      setAddHeadcountError('Email is required');
      return;
    }

    setIsAddingHeadcount(true);

    const emailFormatted = newHeadcountEmail.trim().toLowerCase();

    const existing = profiles.find(p => p.email?.toLowerCase() === emailFormatted);
    if (existing) {
      setAddHeadcountError('A user with this email already exists in the roster.');
      setIsAddingHeadcount(false);
      return;
    }

    const { error } = await supabase.from('profiles').insert([{
      email: emailFormatted,
      role: newHeadcountRole,
      tier_rank: parseInt(newHeadcountTier)
    }]);

    if (error) {
      setAddHeadcountError(`Failed to add user: ${error.message}`);
      setIsAddingHeadcount(false);
    } else {
      toast.success('User added successfully');
      setNewHeadcountEmail('');
      setNewHeadcountRole('IC');
      setNewHeadcountTier(3);
      setIsAddHeadcountModalOpen(false);
      await fetchProfiles();
      setIsAddingHeadcount(false);
    }
  };

  const handleDeleteSlot = async (id) => {
    const { error } = await supabase.from('bps_slots').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete slot: ${error.message}`);
      return;
    }
    await fetchSlots();
  };

  const handleUpdateProfile = async (id, updates) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) {
      toast.error(`Failed to update profile: ${error.message}`);
      return;
    }
    await fetchProfiles();
  };

  const handleDeleteProfile = async (id) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete profile: ${error.message}`);
      return;
    }
    setDeleteConfirmId(null);
    await fetchProfiles();
  };

  const handleUpdatePin = async (role) => {
    const key = role === 'ADMIN' ? 'admin_pin' : 'manager_pin';
    const val = role === 'ADMIN' ? newAdminPin : newManagerPin;
    if (val.length < 4) {
      toast.error('PIN must be at least 4 characters');
      return;
    }
    const { error } = await supabase.rpc('fn_admin_update_pin', { p_key: key, p_value: val });
    if (error) {
      toast.error(`Failed to update PIN: ${error.message}`);
      return;
    }
    if (role === 'ADMIN') setNewAdminPin('');
    else setNewManagerPin('');
    toast.success('PIN updated');
  };

  const getTabClass = (id) =>
    `flex-1 py-4 text-center font-semibold text-sm transition-colors border-b-2 focus:outline-none ${
      activeTab === id
        ? 'border-[#005682] text-[#12142A] bg-white'
        : 'border-transparent text-[#58534C] hover:bg-[#F1ECE7] hover:text-[#12142A]'
    }`;

  const getSuggestedCount = (timeVal, pct) => {
    const num = consolidatedTotals[timeVal] || 0;
    return num <= 12 ? 0 : Math.ceil(num * (pct / 100));
  };

  return (
    <div className="min-h-[100dvh] ch-paper pb-20">
      <TopNav />
      <div className="mx-auto px-4 sm:px-6 py-10" style={{ maxWidth: '98%' }}>
        <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-micro text-[#58534C] font-semibold mb-2">
              Admin
            </p>
            <h1 className="font-display text-[44px] sm:text-[52px] text-[#12142A] tracking-tight leading-none">
              Capacity planning &amp; roster
            </h1>
            <p className="text-[#58534C] mt-3 font-medium max-w-xl">
              Consolidate schedules, publish overflow slots, and keep the roster clean.
            </p>
          </div>
        </div>

        <div className="flex bg-white rounded-t-2xl border border-[#EDE7DE] border-b-0 overflow-hidden">
          <button onClick={() => setActiveTab('circus')} className={getTabClass('circus')}>
            <div className="flex items-center justify-center gap-2"><TableProperties className="w-4 h-4" strokeWidth={1.8} /> Consolidated planner</div>
          </button>
          <button onClick={() => setActiveTab('roster')} className={getTabClass('roster')}>
            <div className="flex items-center justify-center gap-2"><Users className="w-4 h-4" strokeWidth={1.8} /> Roster</div>
          </button>
          <button onClick={() => setActiveTab('appointments')} className={getTabClass('appointments')}>
            <div className="flex items-center justify-center gap-2"><CalendarIcon className="w-4 h-4" strokeWidth={1.8} /> Active slots</div>
          </button>
          <button onClick={() => setActiveTab('security')} className={getTabClass('security')}>
            <div className="flex items-center justify-center gap-2"><ShieldCheck className="w-4 h-4" strokeWidth={1.8} /> Passcodes</div>
          </button>
        </div>

        <div className="bg-white border border-[#EDE7DE] rounded-b-2xl p-6 sm:p-8 min-h-[500px]">
          {/* TAB 1 — CONSOLIDATED PLANNER */}
          {activeTab === 'circus' && (
            <div className="space-y-6">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end border-b border-[#EDE7DE] pb-6 gap-4">
                <div>
                  <h2 className="font-display text-3xl text-[#12142A] tracking-tight">Consolidated planner</h2>
                  <p className="text-[#58534C] font-medium text-sm mt-2 max-w-xl">
                    Attendees sum from individual Manager team schedules. Publishing adds slots to live dispatch.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#58534C] uppercase tracking-micro mb-1">Calc %</label>
                    <div className="relative">
                      <input
                        type="number" min="0" max="100" value={calcPercentage}
                        onChange={(e) => setCalcPercentage(parseFloat(e.target.value)||0)}
                        className="w-20 px-3 py-2 border border-[#D7D1C8] rounded-lg text-[#12142A] font-semibold focus:border-[#005682] outline-none bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A29A8E] font-semibold">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#58534C] uppercase tracking-micro mb-1">Target date</label>
                    <input
                      type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-4 py-2 border border-[#D7D1C8] rounded-lg text-[#12142A] font-semibold focus:border-[#005682] outline-none h-[42px] bg-white"
                    />
                  </div>
                  <button
                    onClick={handlePublishPlan}
                    disabled={publishing}
                    className="px-6 h-[42px] rounded-lg font-semibold bg-[#12142A] text-[#FAF8F5] hover:bg-[#011537] disabled:opacity-50 transition-colors flex items-center gap-2 ch-focus-ring"
                  >
                    {publishing ? <Loader className="w-5 h-5 animate-spin" /> : 'Publish overflows'}
                  </button>
                </div>
              </div>

              {publishMessage && (
                <div className={`p-4 rounded-xl flex items-center gap-2 font-semibold ${
                  publishMessage.type === 'success'
                    ? 'bg-[#E8F0EE] text-[#335649] border border-[#A8C8C2]'
                    : 'bg-[#FDEBEC] text-[#9F2F2D] border border-[#F2C9CC]'
                }`}>
                  {publishMessage.type === 'success' ? <CheckCircle className="w-5 h-5" strokeWidth={1.8} /> : <AlertCircle className="w-5 h-5" strokeWidth={1.8} />}
                  {publishMessage.text}
                </div>
              )}

              <div className="overflow-x-auto border border-[#EDE7DE] rounded-2xl pb-2">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[#EDE7DE]">
                      <th className="p-3 text-[10px] font-semibold text-[#12142A] uppercase tracking-micro sticky left-0 bg-[#FAF8F5] z-10 shadow-[2px_0_5px_-2px_rgba(18,20,42,0.08)]">BPS Time (MT)</th>
                      <th className="p-3 text-[10px] font-semibold text-[#005682] uppercase tracking-micro border-r border-[#EDE7DE]">OF Time (MT)</th>

                      {managers.map(m => (
                        <th key={m.id} className="p-3 text-[10px] font-semibold text-[#58534C] uppercase tracking-micro text-center border-r border-[#EDE7DE] max-w-[80px] truncate" title={m.email}>
                          {m.email.split('@')[0]}
                        </th>
                      ))}

                      <th className="p-3 text-[10px] font-semibold text-[#12142A] bg-[#F1ECE7] uppercase tracking-micro text-center border-r border-[#D7D1C8]">Total BPS</th>
                      <th className="p-3 text-[10px] font-semibold text-[#005682] uppercase tracking-micro text-center w-24">Overflows needed</th>
                      <th className="p-3 text-[10px] font-semibold text-[#12142A] uppercase tracking-micro">Assign managers (max 2 slots)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_INTERVALS.map((interval) => {
                      const row = planData[interval.val] || { override: '', assignments: [] };
                      const totalBps = consolidatedTotals[interval.val] || 0;
                      const calcSuggested = getSuggestedCount(interval.val, calcPercentage);
                      const targetOverflow = row.override !== '' ? parseInt(row.override) : calcSuggested;
                      const filledSlots = row.assignments.reduce((sum, a) => sum + (parseInt(a.count)||0), 0);
                      const isShort = targetOverflow > 0 && filledSlots < targetOverflow;

                      return (
                        <tr key={interval.val} className="border-b border-[#EDE7DE] hover:bg-[#FAF8F5] transition-colors">
                          <td className="p-3 font-semibold text-[#12142A] sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(18,20,42,0.05)] z-10 whitespace-nowrap">{interval.bps_mt}</td>
                          <td className="p-3 font-semibold text-[#005682] border-r border-[#EDE7DE] whitespace-nowrap">{interval.of_mt}</td>

                          {managers.map(m => {
                            const schedData = managerSchedules.find(s => s.manager_email === m.email)?.schedule_data || {};
                            const val = schedData[interval.val] || 0;
                            return (
                              <td key={m.id} className="p-3 text-center border-r border-[#EDE7DE] text-[#495654] font-medium">{val > 0 ? val : '-'}</td>
                            );
                          })}

                          <td className="p-3 text-center font-semibold text-xl text-[#12142A] bg-[#F1ECE7] border-r border-[#D7D1C8]">{totalBps}</td>

                          <td className="p-3 text-center bg-[#CFE4EB]/35 border-r border-[#A8C8C2]/50">
                            <div className="flex flex-col items-center">
                              <span className="text-[#58534C] text-[10px] font-semibold uppercase tracking-micro mb-1">Calc: {calcSuggested}</span>
                              <input
                                type="number" min="0" placeholder="Set"
                                value={row.override !== '' ? row.override : calcSuggested}
                                onChange={(e) => updateInterval(interval.val, 'override', e.target.value)}
                                className="w-16 px-2 py-1.5 border border-[#A8C8C2] bg-white text-[#005682] rounded-lg text-center font-semibold outline-none focus:border-[#005682]"
                              />
                            </div>
                          </td>

                          <td className="p-3 min-w-[300px]">
                            <div className="space-y-2">
                              {row.assignments.map((assign, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <select
                                    value={assign.email}
                                    onChange={(e) => updateManager(interval.val, idx, 'email', e.target.value)}
                                    className="px-3 py-1.5 border border-[#D7D1C8] rounded-lg text-sm font-semibold w-48 focus:border-[#005682] outline-none bg-white text-[#12142A]"
                                  >
                                    <option value="">Select host...</option>
                                    {managers.map(m => <option key={m.email} value={m.email}>{m.email.split('@')[0]}</option>)}
                                  </select>
                                  <select
                                    value={assign.count}
                                    onChange={(e) => updateManager(interval.val, idx, 'count', e.target.value)}
                                    className="px-2 py-1.5 border border-[#D7D1C8] rounded-lg text-sm font-semibold w-16 outline-none focus:border-[#005682] bg-white text-[#12142A]"
                                  >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                  </select>
                                  <button
                                    onClick={() => removeManager(interval.val, idx)}
                                    className="text-[#9F2F2D] hover:text-[#7F2524] p-1.5 bg-[#FDEBEC] rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4" strokeWidth={1.8} />
                                  </button>
                                </div>
                              ))}
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  onClick={() => addManager(interval.val)}
                                  className="text-[10px] font-semibold uppercase tracking-micro text-[#005682] flex items-center gap-1 hover:bg-[#CFE4EB] px-2 py-1.5 rounded-md transition-colors"
                                >
                                  <Plus className="w-3 h-3" strokeWidth={2} /> Add host
                                </button>
                                {targetOverflow > 0 && (
                                  <span className={`text-[10px] font-semibold uppercase tracking-micro px-2.5 py-1 rounded-full ${
                                    isShort ? 'bg-[#FDEBEC] text-[#9F2F2D]' : 'bg-[#E8F0EE] text-[#335649]'
                                  }`}>
                                    {filledSlots} / {targetOverflow} filled
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

          {/* TAB 2 — ROSTER */}
          {activeTab === 'roster' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-4 bg-[#FAF8F5] rounded-2xl border border-[#EDE7DE] p-6 space-y-6">
                <div>
                  <h3 className="font-display text-2xl text-[#12142A] mb-3 tracking-tight">Import roster</h3>
                  <CSVUploadZone
                    onUpload={handleStaffUpload}
                    title="Drop CSV data"
                    description="Requires columns: email, role, tier_rank"
                    expectedColumns={['email', 'role', 'tier_rank']}
                  />
                  {staffMessage && (
                    <div className={`mt-4 p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                      staffMessage.type === 'success'
                        ? 'bg-[#E8F0EE] text-[#335649] border border-[#A8C8C2]'
                        : 'bg-[#FDEBEC] text-[#9F2F2D] border border-[#F2C9CC]'
                    }`}>
                      {staffMessage.text}
                    </div>
                  )}
                </div>
                <div className="border-t border-[#EDE7DE] pt-6">
                  <h3 className="font-display text-2xl text-[#12142A] mb-3 tracking-tight">Manual headcount</h3>
                  <button
                    onClick={() => setIsAddHeadcountModalOpen(true)}
                    className="w-full py-3 bg-white border border-dashed border-[#005682] text-[#005682] rounded-xl font-semibold hover:bg-[#CFE4EB]/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" strokeWidth={1.8} /> Add headcount manually
                  </button>
                </div>
              </div>
              <div className="xl:col-span-8 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display text-2xl text-[#12142A] tracking-tight">Active team roster</h3>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A29A8E] w-4 h-4" strokeWidth={1.8} />
                    <input
                      type="text" placeholder="Search..." value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D7D1C8] rounded-xl text-sm outline-none focus:border-[#005682] text-[#12142A]"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[600px]">
                  {filteredProfiles.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-[#EDE7DE]">
                      <div className="flex-1 font-semibold text-[#12142A] truncate">{p.email}</div>
                      <select
                        value={p.role}
                        onChange={(e) => handleUpdateProfile(p.id, { role: e.target.value })}
                        className="bg-[#FAF8F5] border border-[#D7D1C8] rounded-lg px-2 py-1.5 text-sm font-medium w-32 text-[#12142A]"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="IC">IC (Staff)</option>
                      </select>
                      <select
                        value={p.tier_rank || 3}
                        onChange={(e) => handleUpdateProfile(p.id, { tier_rank: parseInt(e.target.value) })}
                        className="bg-[#FAF8F5] border border-[#D7D1C8] rounded-lg px-2 py-1.5 text-sm font-medium w-28 text-[#12142A]"
                      >
                        <option value="1">Tier 1</option>
                        <option value="2">Tier 2</option>
                        <option value="3">Tier 3</option>
                      </select>
                      <div className="w-20 flex justify-end">
                        {deleteConfirmId === p.id ? (
                          <div className="flex gap-1 items-center bg-[#FDEBEC] p-1 rounded-lg">
                            <button
                              onClick={() => handleDeleteProfile(p.id)}
                              className="bg-[#9F2F2D] text-[#FAF8F5] px-2 py-1 rounded text-[10px] font-semibold"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-[#58534C] hover:text-[#12142A] p-1"
                            >
                              <X className="w-4 h-4" strokeWidth={1.8} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(p.id)}
                            className="p-2 text-[#A29A8E] hover:text-[#9F2F2D] rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.8} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3 — ACTIVE SLOTS */}
          {activeTab === 'appointments' && (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h3 className="font-display text-3xl text-[#12142A] tracking-tight">All active slots</h3>
                  <p className="text-sm text-[#58534C] font-medium">Manage or delete slots manually. ({slots.length} total)</p>
                </div>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {slots.map((slot) => (
                  <div key={slot.id} className="flex justify-between items-center p-4 bg-white rounded-xl border border-[#EDE7DE]">
                    <div>
                      <p className="font-semibold text-[#12142A] text-base tracking-tight">{slot.patient_identifier}</p>
                      <p className="text-sm font-medium text-[#58534C]">
                        {new Date(slot.start_time).toLocaleString()}
                        {slot.host_manager && <span className="text-[#005682] ml-2">Host: {slot.host_manager}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-semibold uppercase tracking-micro px-3 py-1 rounded-full bg-[#F1ECE7] text-[#495654]">
                        {slot.status}
                      </span>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="p-2 bg-[#FDEBEC] text-[#9F2F2D] rounded-lg hover:bg-[#F9D4D6] transition-colors"
                      >
                        <Trash2 className="w-5 h-5" strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4 — PASSCODES */}
          {activeTab === 'security' && (
            <div className="max-w-4xl mx-auto py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#FAF8F5] rounded-2xl border border-[#EDE7DE] p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck className="w-6 h-6 text-[#12142A]" strokeWidth={1.8} />
                    <h3 className="font-display text-2xl text-[#12142A] tracking-tight">Admin PIN</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-[#EDE7DE] rounded-xl text-[#58534C] font-medium text-sm">
                      <Lock className="w-4 h-4 text-[#A29A8E]" strokeWidth={1.8} />
                      Current PIN is hashed server-side and cannot be displayed.
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showNewAdminPin ? 'text' : 'password'}
                          value={newAdminPin}
                          onChange={(e) => setNewAdminPin(e.target.value)}
                          placeholder="New PIN (min 4 chars)"
                          className="w-full px-4 py-3 bg-white border border-[#D7D1C8] rounded-xl outline-none focus:border-[#12142A] font-medium pr-12 text-[#12142A]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewAdminPin(!showNewAdminPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A29A8E] hover:text-[#12142A]"
                        >
                          {showNewAdminPin ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleUpdatePin('ADMIN')}
                        className="px-6 rounded-xl font-semibold text-[#FAF8F5] bg-[#12142A] hover:bg-[#011537] transition-colors ch-focus-ring"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#E8F0EE] rounded-2xl border border-[#A8C8C2] p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Users className="w-6 h-6 text-[#335649]" strokeWidth={1.8} />
                    <h3 className="font-display text-2xl text-[#12142A] tracking-tight">Manager PIN</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-[#A8C8C2] rounded-xl text-[#58534C] font-medium text-sm">
                      <Lock className="w-4 h-4 text-[#A29A8E]" strokeWidth={1.8} />
                      Current PIN is hashed server-side and cannot be displayed.
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showNewManagerPin ? 'text' : 'password'}
                          value={newManagerPin}
                          onChange={(e) => setNewManagerPin(e.target.value)}
                          placeholder="New PIN (min 4 chars)"
                          className="w-full px-4 py-3 bg-white border border-[#A8C8C2] rounded-xl outline-none focus:border-[#335649] font-medium pr-12 text-[#12142A]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewManagerPin(!showNewManagerPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A29A8E] hover:text-[#12142A]"
                        >
                          {showNewManagerPin ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleUpdatePin('MANAGER')}
                        className="px-6 rounded-xl font-semibold text-[#FAF8F5] bg-[#335649] hover:bg-[#0A3327] transition-colors ch-focus-ring"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DUPLICATE RESOLUTION MODAL */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12142A]/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden border border-[#EDE7DE] ch-rise">
            <div className="bg-[#12142A] p-8 text-[#FAF8F5] flex justify-between items-center">
              <div>
                <h2 className="font-display text-3xl tracking-tight flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-[#FBF3DB]" strokeWidth={1.8} /> Resolve data conflicts
                </h2>
                <p className="text-sm font-medium text-[#A8C8C2] mt-2">{pendingDuplicates.length} duplicates detected.</p>
              </div>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto bg-[#FAF8F5]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[10px] font-semibold text-[#58534C] uppercase tracking-micro border-b border-[#EDE7DE]">
                    <th className="pb-4 px-4">Email</th>
                    <th className="pb-4 px-4">Current data</th>
                    <th className="pb-4 text-center"><ArrowRight className="inline w-4 h-4 text-[#A29A8E]" strokeWidth={1.8} /></th>
                    <th className="pb-4 px-4">Incoming data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE7DE]">
                  {pendingDuplicates.map((dup, idx) => (
                    <tr key={idx} className="hover:bg-white transition-colors">
                      <td className="py-6 px-4 font-semibold text-[#12142A] text-base">{dup.old.email}</td>
                      <td className="py-6 px-4">
                        <button
                          onClick={() => resolveDuplicateRow(idx, 'old')}
                          className="w-full text-left p-4 rounded-xl border border-[#D7D1C8] hover:border-[#495654] hover:bg-[#F1ECE7] transition-colors"
                        >
                          <div className="text-[10px] uppercase tracking-micro text-[#58534C] font-semibold mb-2">Keep existing</div>
                          <div className="font-semibold text-[#12142A] text-base">{dup.old.role} &middot; Tier {dup.old.tier_rank}</div>
                        </button>
                      </td>
                      <td className="text-center text-[#A29A8E] font-semibold text-xs">VS</td>
                      <td className="py-6 px-4">
                        <button
                          onClick={() => resolveDuplicateRow(idx, 'new')}
                          className="w-full text-left p-4 rounded-xl border border-[#A8C8C2] bg-[#E8F0EE] hover:border-[#335649] transition-colors"
                        >
                          <div className="text-[10px] uppercase tracking-micro text-[#335649] font-semibold mb-2">Overwrite with new</div>
                          <div className="font-semibold text-[#12142A] text-base">{dup.new.role} &middot; Tier {dup.new.tier_rank}</div>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD HEADCOUNT MODAL */}
      {isAddHeadcountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12142A]/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden p-8 border border-[#EDE7DE] ch-rise">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display text-2xl text-[#12142A] flex items-center gap-2 tracking-tight">
                <UserPlus className="w-5 h-5 text-[#005682]" strokeWidth={1.8} /> Add staff member
              </h2>
              <button
                onClick={() => setIsAddHeadcountModalOpen(false)}
                disabled={isAddingHeadcount}
                className="text-[#58534C] hover:text-[#12142A] transition-colors"
              >
                <X className="w-6 h-6" strokeWidth={1.8} />
              </button>
            </div>

            <form onSubmit={handleAddHeadcountSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#58534C] uppercase tracking-micro mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@clinic.com"
                  value={newHeadcountEmail}
                  onChange={(e) => setNewHeadcountEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#D7D1C8] rounded-xl font-medium focus:border-[#005682] focus:bg-white focus:ring-0 outline-none text-[#12142A]"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[#58534C] uppercase tracking-micro mb-1">Role</label>
                  <select
                    value={newHeadcountRole}
                    onChange={(e) => setNewHeadcountRole(e.target.value)}
                    className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#D7D1C8] rounded-xl font-semibold focus:border-[#005682] focus:bg-white focus:ring-0 outline-none text-[#12142A]"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="IC">IC (Staff)</option>
                  </select>
                </div>
                <div className="w-1/3">
                  <label className="block text-[10px] font-semibold text-[#58534C] uppercase tracking-micro mb-1">Tier</label>
                  <select
                    value={newHeadcountTier}
                    onChange={(e) => setNewHeadcountTier(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#D7D1C8] rounded-xl font-semibold focus:border-[#005682] focus:bg-white focus:ring-0 outline-none text-[#12142A]"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
              </div>

              {addHeadcountError && (
                <div className="p-3 bg-[#FDEBEC] text-[#9F2F2D] text-sm font-semibold rounded-xl text-center border border-[#F2C9CC]">
                  {addHeadcountError}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddHeadcountModalOpen(false)}
                  disabled={isAddingHeadcount}
                  className="flex-1 py-3 rounded-xl font-semibold text-[#495654] bg-white border border-[#D7D1C8] hover:bg-[#F1ECE7] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingHeadcount}
                  className="flex-1 py-3 rounded-xl font-semibold bg-[#12142A] text-[#FAF8F5] hover:bg-[#011537] transition-colors flex justify-center items-center gap-2 ch-focus-ring"
                >
                  {isAddingHeadcount ? <Loader className="w-5 h-5 animate-spin" /> : 'Add user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
