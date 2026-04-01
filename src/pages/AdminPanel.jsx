import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CSVUploadZone } from '../components/CSVUploadZone';
import { TopNav } from '../components/TopNav';
import { 
  Users, Calendar, CircleAlert as AlertCircle, CircleCheck as CheckCircle, 
  Loader, Info, Lock, Eye, EyeOff, Trash2, Search, ArrowRight, Settings, ShieldCheck
} from 'lucide-react';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('roster'); 
  
  // Data States
  const [profiles, setProfiles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Upload & Loading States
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [staffMessage, setStaffMessage] = useState(null);
  const [slotsMessage, setSlotsMessage] = useState(null);

  // Duplicate Handling States
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState([]);
  const [resolvedUploadData, setResolvedUploadData] = useState([]);

  // Security PIN States
  const [currentAdminPin, setCurrentAdminPin] = useState('charlieadmin');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showNewAdminPin, setShowNewAdminPin] = useState(false);
  const [updatingAdmin, setUpdatingAdmin] = useState(false);
  const [adminPinMessage, setAdminPinMessage] = useState(null);

  const [currentManagerPin, setCurrentManagerPin] = useState('charliemanager');
  const [newManagerPin, setNewManagerPin] = useState('');
  const [showManagerPin, setShowManagerPin] = useState(false);
  const [showNewManagerPin, setShowNewManagerPin] = useState(false);
  const [updatingManager, setUpdatingManager] = useState(false);
  const [managerPinMessage, setManagerPinMessage] = useState(null);

  useEffect(() => {
    fetchProfiles();
    fetchSlots();
    fetchPins();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').order('email');
      setProfiles(data || []);
    } catch (error) { console.error('Error fetching profiles:', error); }
  };

  const fetchSlots = async () => {
    try {
      const { data } = await supabase.from('bps_slots').select('*').order('start_time', { ascending: true });
      setSlots(data || []);
    } catch (error) { console.error('Error fetching slots:', error); }
  };

  const fetchPins = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('*');
      if (!error && data) {
        const adminData = data.find(d => d.setting_key === 'admin_pin');
        const managerData = data.find(d => d.setting_key === 'manager_pin');
        if (adminData) setCurrentAdminPin(adminData.setting_value);
        if (managerData) setCurrentManagerPin(managerData.setting_value);
      }
    } catch (error) { console.error('Settings table missing.'); }
  };

  // --- PIN MANAGEMENT ---
  const handleUpdatePin = async (role) => {
    const isAdmin = role === 'ADMIN';
    const key = isAdmin ? 'admin_pin' : 'manager_pin';
    const newPin = isAdmin ? newAdminPin : newManagerPin;
    const setUpdating = isAdmin ? setUpdatingAdmin : setUpdatingManager;
    const setMessage = isAdmin ? setAdminPinMessage : setManagerPinMessage;
    const setCurrentPin = isAdmin ? setCurrentAdminPin : setCurrentManagerPin;
    const setNewPin = isAdmin ? setNewAdminPin : setNewManagerPin;

    if (!newPin || newPin.length < 4) {
      setMessage({ type: 'error', text: 'PIN must be at least 4 characters' });
      return;
    }

    setUpdating(true);
    try {
      await supabase.from('app_settings').upsert({ setting_key: key, setting_value: newPin }, { onConflict: 'setting_key' });
      setCurrentPin(newPin);
      setNewPin('');
      setMessage({ type: 'success', text: `${role} PIN updated!` });
    } catch (error) { setMessage({ type: 'error', text: 'Database error.' }); }
    finally {
      setUpdating(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  // --- ROSTER UPLOAD & DUPLICATES ---
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

    const duplicates = [];
    const newEntries = [];

    for (const entry of cleanData) {
      const existing = profiles.find(p => p.email === entry.email);
      if (existing && (existing.role !== entry.role || existing.tier_rank !== entry.tier_rank)) {
        duplicates.push({ old: existing, new: entry });
      } else {
        newEntries.push(entry);
      }
    }

    if (duplicates.length > 0) {
      setPendingDuplicates(duplicates);
      setResolvedUploadData(newEntries);
      setShowDuplicateModal(true);
    } else {
      await commitStaffData(cleanData);
    }
    setLoadingStaff(false);
  };

  const commitStaffData = async (data) => {
    setLoadingStaff(true);
    try {
      for (const row of data) {
        await supabase.from('profiles').upsert(row, { onConflict: 'email' });
      }
      await fetchProfiles();
      setStaffMessage({ type: 'success', text: `Successfully updated ${data.length} staff members` });
      setTimeout(() => setStaffMessage(null), 4000);
    } catch (error) { setStaffMessage({ type: 'error', text: `Error: ${error.message}` }); }
    finally { setLoadingStaff(false); }
  };

  const resolveDuplicateRow = (index, choice) => {
    const resolvedRow = choice === 'new' ? pendingDuplicates[index].new : pendingDuplicates[index].old;
    const updatedResolved = [...resolvedUploadData, resolvedRow];
    const updatedPending = pendingDuplicates.filter((_, i) => i !== index);
    setResolvedUploadData(updatedResolved);
    setPendingDuplicates(updatedPending);
    if (updatedPending.length === 0) {
      setShowDuplicateModal(false);
      commitStaffData(updatedResolved);
    }
  };

  // --- APPOINTMENT UPLOAD ---
  const handleSlotsUpload = async (data) => {
    setLoadingSlots(true);
    setSlotsMessage(null);
    try {
      const validatedData = data.map((row) => ({
        patient_identifier: row.patient_identifier?.trim() || row.patient_id?.trim(),
        start_time: row.start_time?.trim(),
      }));
      const errors = validatedData.filter((d) => !d.patient_identifier || !d.start_time);
      if (errors.length > 0) {
        setSlotsMessage({ type: 'error', text: `Error: ${errors.length} rows invalid` });
        setLoadingSlots(false);
        return;
      }
      for (const row of validatedData) {
        await supabase.from('bps_slots').insert({ patient_identifier: row.patient_identifier, start_time: new Date(row.start_time).toISOString(), status: 'OPEN' });
      }
      await fetchSlots();
      setSlotsMessage({ type: 'success', text: `Successfully imported ${validatedData.length} slots` });
      setTimeout(() => setSlotsMessage(null), 4000);
    } catch (error) { setSlotsMessage({ type: 'error', text: `Error: ${error.message}` }); }
    finally { setLoadingSlots(false); }
  };

  // --- INLINE EDITING ---
  const handleUpdateProfile = async (id, updates) => {
    await supabase.from('profiles').update(updates).eq('id', id);
    fetchProfiles();
  };

  const handleDeleteProfile = async (id) => {
    await supabase.from('profiles').delete().eq('id', id);
    setDeleteConfirmId(null);
    fetchProfiles();
  };

  const filteredProfiles = profiles.filter(p => p.email.toLowerCase().includes(userSearchTerm.toLowerCase()));

  // Sub-navigation tab helper
  const getTabClass = (id) => `flex-1 py-4 text-center font-bold text-sm transition-all border-b-4 focus:outline-none ${activeTab === id ? 'border-[#0F172A] text-[#0F172A] bg-gray-50' : 'border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <TopNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Top Info Banner */}
        <div className="mb-8 bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
          <div className="p-2 bg-white rounded-full shadow-sm">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 mb-1">Admin Mode Dashboard</h3>
            <p className="text-sm text-blue-800/80 leading-relaxed">Use the tabs below to navigate between Roster Management, Appointment Imports, and System Security settings. Data is saved automatically when modified.</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white rounded-t-2xl border border-gray-200 overflow-hidden shadow-sm">
          <button onClick={() => setActiveTab('roster')} className={getTabClass('roster')}>
            <div className="flex items-center justify-center gap-2"><Users className="w-4 h-4" /> Roster Management</div>
          </button>
          <button onClick={() => setActiveTab('appointments')} className={getTabClass('appointments')}>
            <div className="flex items-center justify-center gap-2"><Calendar className="w-4 h-4" /> Appointment Slots</div>
          </button>
          <button onClick={() => setActiveTab('security')} className={getTabClass('security')}>
            <div className="flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> Passcode Management</div>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="bg-white border border-t-0 border-gray-200 rounded-b-2xl p-6 sm:p-8 shadow-sm min-h-[500px]">
          
          {/* --- TAB 1: ROSTER MANAGEMENT --- */}
          {activeTab === 'roster' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* Left Col: Upload */}
              <div className="xl:col-span-4">
                <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-[#0F172A] mb-4">Import Staff CSV</h3>
                  <CSVUploadZone onUpload={handleStaffUpload} title="Drop Staff Data" description="Requires: email, role, tier_rank" expectedColumns={['email', 'role', 'tier_rank']} />
                  {staffMessage && (
                    <div className={`mt-4 p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${staffMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                      {staffMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {staffMessage.text}
                    </div>
                  )}
                  {loadingStaff && <div className="mt-4 flex items-center justify-center gap-2 text-[#5E4791] font-medium p-4 bg-purple-50 rounded-xl"><Loader className="w-4 h-4 animate-spin" /> Processing Data...</div>}
                </div>
              </div>

              {/* Right Col: List & Edit */}
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
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5E4791] focus:border-transparent outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 mb-2">
                  <div className="col-span-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Staff Member</div>
                  <div className="col-span-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">System Role</div>
                  <div className="col-span-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Priority Tier</div>
                  <div className="col-span-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Action</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[600px]">
                  {filteredProfiles.length === 0 ? (
                    <div className="text-center py-16 px-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No team members found.</p>
                    </div>
                  ) : (
                    filteredProfiles.map((p) => (
                      <div key={p.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:items-center p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group">
                        
                        <div className="col-span-5 flex flex-col justify-center">
                          <div className="font-bold text-[#0F172A] truncate">{p.email}</div>
                          <div className="text-xs font-medium text-gray-400 mt-0.5 uppercase tracking-wider">Active User</div>
                        </div>

                        <div className="col-span-3">
                          <select 
                            value={p.role} onChange={(e) => handleUpdateProfile(p.id, { role: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg focus:ring-2 focus:ring-[#5E4791] focus:border-transparent outline-none px-3 py-2 cursor-pointer transition-colors hover:bg-gray-100"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="MANAGER">Manager</option>
                            <option value="IC">IC (Staff)</option>
                          </select>
                        </div>

                        <div className="col-span-3">
                          <select 
                            value={p.tier_rank || 3} onChange={(e) => handleUpdateProfile(p.id, { tier_rank: parseInt(e.target.value) })}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg focus:ring-2 focus:ring-[#5E4791] focus:border-transparent outline-none px-3 py-2 cursor-pointer transition-colors hover:bg-gray-100"
                          >
                            <option value="1">Tier 1 (High)</option>
                            <option value="2">Tier 2 (Med)</option>
                            <option value="3">Tier 3 (Low)</option>
                          </select>
                        </div>

                        <div className="col-span-1 flex justify-end items-center">
                          {deleteConfirmId === p.id ? (
                            <div className="flex flex-col gap-1 items-end animate-in fade-in zoom-in duration-200">
                              <button onClick={() => handleDeleteProfile(p.id)} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700 whitespace-nowrap shadow-sm transition-colors">Confirm</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-gray-400 text-xs font-bold hover:text-gray-700 transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(p.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 2: APPOINTMENT MANAGEMENT --- */}
          {activeTab === 'appointments' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-4">
                <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-[#0F172A] mb-4">Import BPS Slots</h3>
                  <CSVUploadZone onUpload={handleSlotsUpload} title="Drop Slots CSV" description="Requires: patient_identifier, start_time" expectedColumns={['patient_identifier', 'start_time']} />
                  {slotsMessage && (
                    <div className={`mt-4 p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${slotsMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                      {slotsMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {slotsMessage.text}
                    </div>
                  )}
                  {loadingSlots && <div className="mt-4 flex items-center justify-center gap-2 text-[#5E4791] font-medium p-4 bg-purple-50 rounded-xl"><Loader className="w-4 h-4 animate-spin" /> Processing Data...</div>}
                </div>
              </div>
              
              <div className="xl:col-span-8 flex flex-col">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#0F172A]">Uploaded Appointment Slots</h3>
                  <p className="text-sm text-gray-500">{slots.length} Total Slots Available</p>
                </div>
                
                <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
                  {slots.length === 0 ? (
                    <div className="text-center py-16 px-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No appointments currently loaded.</p>
                    </div>
                  ) : (
                    slots.map((slot) => (
                      <div key={slot.id} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
                        <div>
                          <p className="font-bold text-[#0F172A] text-lg">{slot.patient_identifier}</p>
                          <p className="text-sm font-medium text-gray-500 mt-0.5 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(slot.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className={`text-[11px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full ${slot.status === 'OPEN' ? 'bg-green-100 text-green-800' : slot.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                          {slot.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 3: PASSCODE MANAGEMENT --- */}
          {activeTab === 'security' && (
            <div className="max-w-4xl mx-auto py-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Admin PIN */}
                <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
                      <ShieldCheck className="w-6 h-6 text-[#0F172A]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#0F172A]">Admin PIN</h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">Controls access to this dashboard.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Current PIN</label>
                      <div className="relative">
                        <input type={showAdminPin ? "text" : "password"} value={currentAdminPin} readOnly className="w-full px-4 py-3 bg-gray-100/80 border border-gray-200 rounded-xl text-gray-600 outline-none pr-10 font-mono" />
                        <button onClick={() => setShowAdminPin(!showAdminPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {showAdminPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-4">Set New PIN</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <input type={showNewAdminPin ? "text" : "password"} value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} placeholder="Min 4 chars" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#5E4791] outline-none pr-10 transition-shadow font-mono" />
                          <button onClick={() => setShowNewAdminPin(!showNewAdminPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#5E4791] transition-colors">
                            {showNewAdminPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <button onClick={() => handleUpdatePin('ADMIN')} disabled={updatingAdmin || !newAdminPin} style={{backgroundColor:'#0F172A', color:'#fff'}} className="px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-opacity shadow-sm whitespace-nowrap">
                          {updatingAdmin ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Save PIN'}
                        </button>
                      </div>
                      {adminPinMessage && <p className={`text-sm mt-3 font-semibold ${adminPinMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{adminPinMessage.text}</p>}
                    </div>
                  </div>
                </div>

                {/* Manager PIN */}
                <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
                      <Users className="w-6 h-6 text-[#5E4791]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#0F172A]">Manager PIN</h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">Controls access to dispatch view.</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Current PIN</label>
                      <div className="relative">
                        <input type={showManagerPin ? "text" : "password"} value={currentManagerPin} readOnly className="w-full px-4 py-3 bg-gray-100/80 border border-gray-200 rounded-xl text-gray-600 outline-none pr-10 font-mono" />
                        <button onClick={() => setShowManagerPin(!showManagerPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {showManagerPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-4">Set New PIN</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <input type={showNewManagerPin ? "text" : "password"} value={newManagerPin} onChange={(e) => setNewManagerPin(e.target.value)} placeholder="Min 4 chars" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#5E4791] outline-none pr-10 transition-shadow font-mono" />
                          <button onClick={() => setShowNewManagerPin(!showNewManagerPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#5E4791] transition-colors">
                            {showNewManagerPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <button onClick={() => handleUpdatePin('MANAGER')} disabled={updatingManager || !newManagerPin} style={{backgroundColor:'#5E4791', color:'#fff'}} className="px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-opacity shadow-sm whitespace-nowrap">
                          {updatingManager ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Save PIN'}
                        </button>
                      </div>
                      {managerPinMessage && <p className={`text-sm mt-3 font-semibold ${managerPinMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{managerPinMessage.text}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* --- DUPLICATE RESOLVER MODAL --- */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div style={{backgroundColor:'#5E4791'}} className="p-6 text-white">
              <h2 className="text-xl font-bold">Resolve Data Conflicts</h2>
              <p className="text-sm opacity-90 mt-1">{pendingDuplicates.length} duplicates detected. Choose which data to keep.</p>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                    <th className="pb-4 px-4">User Email</th>
                    <th className="pb-4 px-4">Current Data (In Database)</th>
                    <th className="pb-4 text-center"><ArrowRight className="inline w-4 h-4" /></th>
                    <th className="pb-4 px-4">Incoming Data (From CSV)</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDuplicates.map((dup, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-6 px-4 font-bold text-[#0F172A]">{dup.old.email}</td>
                      <td className="py-6 px-4">
                        <button onClick={() => resolveDuplicateRow(idx, 'old')} className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-100 transition-all">
                          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">KEEP EXISTING</div>
                          <div className="font-semibold text-gray-800">{dup.old.role} <span className="text-gray-400 mx-1">•</span> Tier {dup.old.tier_rank}</div>
                        </button>
                      </td>
                      <td className="text-center text-gray-300 font-bold">VS</td>
                      <td className="py-6 px-4">
                        <button onClick={() => resolveDuplicateRow(idx, 'new')} className="w-full text-left p-4 rounded-xl border-2 border-[#E7DFF3] bg-[#F3EFF9] hover:border-[#5E4791] hover:bg-purple-50 transition-all">
                          <div className="text-[10px] uppercase tracking-widest text-[#5E4791] font-bold mb-1">OVERWRITE WITH NEW</div>
                          <div className="font-semibold text-[#0F172A]">{dup.new.role} <span className="text-gray-400 mx-1">•</span> Tier {dup.new.tier_rank}</div>
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
    </div>
  );
}