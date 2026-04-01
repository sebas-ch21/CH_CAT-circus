import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CSVUploadZone } from '../components/CSVUploadZone';
import { TopNav } from '../components/TopNav';
import { 
  Users, Calendar, CircleAlert as AlertCircle, CircleCheck as CheckCircle, 
  Loader, Info, Lock, Eye, EyeOff, Trash2, Search, ArrowRight, ShieldCheck
} from 'lucide-react';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('roster'); // roster, appointments, security
  
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
      setSlotsMessage({ type: 'success', text: `Successfully imported ${validatedData.length} BPS slots` });
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
  const getTabClass = (id) => `flex-1 py-4 text-center font-bold text-sm transition-all border-b-4 ${activeTab === id ? 'border-[#0F172A] text-[#0F172A] bg-gray-50' : 'border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <TopNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Top Info Banner */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Admin Mode Dashboard</h3>
            <p className="text-sm text-blue-800">Use the tabs below to navigate between Roster Management, Appointment Imports, and System Security.</p>
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
        <div className="bg-white border border-t-0 border-gray-200 rounded-b-2xl p-8 shadow-sm min-h-[500px]">
          
          {/* TAB 1: ROSTER MANAGEMENT */}
          {activeTab === 'roster' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Col: Upload */}
              <div className="lg:col-span-1">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Import Staff CSV</h3>
                  <CSVUploadZone onUpload={handleStaffUpload} title="Drop Staff Data" description="Requires: email, role, tier_rank" expectedColumns={['email', 'role', 'tier_rank']} />
                  {staffMessage && (
                    <div className={`mt-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${staffMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {staffMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {staffMessage.text}
                    </div>
                  )}
                  {loadingStaff && <div className="mt-4 flex items-center gap-2 text-[#007C8C]"><Loader className="w-4 h-4 animate-spin" /> Processing...</div>}
                </div>
              </div>

              {/* Right Col: List & Edit */}
              <div className="lg:col-span-2 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-[#0F172A]">Current Roster ({profiles.length})</h3>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                      type="text" placeholder="Search email..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#5E4791] outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[600px]">
                  {filteredProfiles.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                      <div className="font-semibold text-[#0F172A]">{p.email}</div>
                      <div className="flex items-center gap-4">
                        <select 
                          value={p.role} onChange={(e) => handleUpdateProfile(p.id, { role: e.target.value })}
                          className="bg-white border border-gray-200 rounded-md px-2 py-1 text-sm font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-[#5E4791]"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="IC">IC</option>
                        </select>
                        <select 
                          value={p.tier_rank || 3} onChange={(e) => handleUpdateProfile(p.id, { tier_rank: parseInt(e.target.value) })}
                          className="bg-white border border-gray-200 rounded-md px-2 py-1 text-sm font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-[#5E4791]"
                        >
                          <option value="1">Tier 1</option>
                          <option value="2">Tier 2</option>
                          <option value="3">Tier 3</option>
                        </select>
                        {deleteConfirmId === p.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleDeleteProfile(p.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-red-700">Confirm</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="text-gray-500 text-xs font-bold hover:text-gray-700">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(p.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPOINTMENT MANAGEMENT */}
          {activeTab === 'appointments' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Import BPS Slots</h3>
                  <CSVUploadZone onUpload={handleSlotsUpload} title="Drop Slots CSV" description="Requires: patient_identifier, start_time" expectedColumns={['patient_identifier', 'start_time']} />
                  {slotsMessage && (
                    <div className={`mt-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${slotsMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {slotsMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {slotsMessage.text}
                    </div>
                  )}
                  {loadingSlots && <div className="mt-4 flex items-center gap-2 text-[#007C8C]"><Loader className="w-4 h-4 animate-spin" /> Processing...</div>}
                </div>
              </div>
              
              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Uploaded Appointment Slots ({slots.length})</h3>
                <div className="max-h-[600px] overflow-y-auto space-y-2 pr-2">
                  {slots.length === 0 ? (
                    <p className="text-gray-500 italic py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">No appointments loaded</p>
                  ) : (
                    slots.map((slot) => (
                      <div key={slot.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div>
                          <p className="font-bold text-[#0F172A]">{slot.patient_identifier}</p>
                          <p className="text-sm text-gray-500">{new Date(slot.start_time).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${slot.status === 'OPEN' ? 'bg-green-100 text-green-800' : slot.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}`}>
                          {slot.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PASSCODE MANAGEMENT */}
          {activeTab === 'security' && (
            <div className="max-w-4xl mx-auto py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Admin PIN */}
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="w-6 h-6 text-[#5E4791]" />
                    <h3 className="text-lg font-semibold text-[#0F172A]">Admin PIN</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Current PIN</label>
                      <div className="relative">
                        <input type={showAdminPin ? "text" : "password"} value={currentAdminPin} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 outline-none pr-10" />
                        <button onClick={() => setShowAdminPin(!showAdminPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Set New PIN</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input type={showNewAdminPin ? "text" : "password"} value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} placeholder="Min 4 chars" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#5E4791] outline-none pr-10" />
                          <button onClick={() => setShowNewAdminPin(!showNewAdminPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showNewAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button onClick={() => handleUpdatePin('ADMIN')} disabled={updatingAdmin || !newAdminPin} style={{backgroundColor:'#5E4791', color:'#fff'}} className="px-4 rounded-lg font-bold text-sm disabled:opacity-50">
                          {updatingAdmin ? <Loader className="w-4 h-4 animate-spin" /> : 'Update'}
                        </button>
                      </div>
                      {adminPinMessage && <p className={`text-xs mt-2 font-medium ${adminPinMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{adminPinMessage.text}</p>}
                    </div>
                  </div>
                </div>

                {/* Manager PIN */}
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-[#5E4791]" />
                    <h3 className="text-lg font-semibold text-[#0F172A]">Manager PIN</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Current PIN</label>
                      <div className="relative">
                        <input type={showManagerPin ? "text" : "password"} value={currentManagerPin} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 outline-none pr-10" />
                        <button onClick={() => setShowManagerPin(!showManagerPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showManagerPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Set New PIN</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input type={showNewManagerPin ? "text" : "password"} value={newManagerPin} onChange={(e) => setNewManagerPin(e.target.value)} placeholder="Min 4 chars" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#5E4791] outline-none pr-10" />
                          <button onClick={() => setShowNewManagerPin(!showNewManagerPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showNewManagerPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button onClick={() => handleUpdatePin('MANAGER')} disabled={updatingManager || !newManagerPin} style={{backgroundColor:'#5E4791', color:'#fff'}} className="px-4 rounded-lg font-bold text-sm disabled:opacity-50">
                          {updatingManager ? <Loader className="w-4 h-4 animate-spin" /> : 'Update'}
                        </button>
                      </div>
                      {managerPinMessage && <p className={`text-xs mt-2 font-medium ${managerPinMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{managerPinMessage.text}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* DUPLICATE RESOLVER MODAL */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div style={{backgroundColor:'#5E4791'}} className="p-6 text-white">
              <h2 className="text-xl font-bold">Resolve Data Conflicts</h2>
              <p className="text-sm opacity-80">{pendingDuplicates.length} duplicates detected. Choose which data to keep.</p>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b">
                    <th className="pb-4 px-4">User Email</th>
                    <th className="pb-4 px-4">Current Data</th>
                    <th className="pb-4 text-center"><ArrowRight className="inline w-4 h-4" /></th>
                    <th className="pb-4 px-4">Incoming Data</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDuplicates.map((dup, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-6 px-4 font-bold text-gray-900">{dup.old.email}</td>
                      <td className="py-6 px-4">
                        <button onClick={() => resolveDuplicateRow(idx, 'old')} className="w-full text-left p-3 rounded-xl border-2 border-gray-200 hover:border-[#007C8C]">
                          <div className="text-xs text-gray-400 font-bold">KEEP EXISTING</div>
                          <div className="font-semibold text-gray-700">{dup.old.role} — Tier {dup.old.tier_rank}</div>
                        </button>
                      </td>
                      <td className="text-center text-gray-300 font-bold">VS</td>
                      <td className="py-6 px-4">
                        <button onClick={() => resolveDuplicateRow(idx, 'new')} className="w-full text-left p-3 rounded-xl border-2 border-gray-200 hover:border-[#5E4791]">
                          <div className="text-xs text-gray-400 font-bold">OVERWRITE NEW</div>
                          <div className="font-semibold text-gray-700">{dup.new.role} — Tier {dup.new.tier_rank}</div>
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