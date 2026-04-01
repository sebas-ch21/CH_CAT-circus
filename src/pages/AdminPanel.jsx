import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CSVUploadZone } from '../components/CSVUploadZone';
import { TopNav } from '../components/TopNav';
import { 
  Users, Calendar, CircleAlert as AlertCircle, CircleCheck as CheckCircle, 
  Loader, Info, Lock, Eye, EyeOff, Trash2, Edit, X, UserCog, Search, ArrowRight 
} from 'lucide-react';

export function AdminPanel() {
  const [profiles, setProfiles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffMessage, setStaffMessage] = useState('');
  
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

  // Duplicate Handling States
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState([]);
  const [resolvedUploadData, setResolvedUploadData] = useState([]);

  // User Management States
  const [showManageUsersModal, setShowManageUsersModal] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    fetchProfiles();
    fetchPins();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').order('email');
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
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
      setMessage({ type: 'success', text: `${role} PIN updated successfully!` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Database error.' });
    } finally {
      setUpdating(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  // --- REFACTORED STAFF UPLOAD WITH DUPLICATE HANDLING ---
  const handleStaffUpload = async (csvData) => {
    setLoadingStaff(true);
    setStaffMessage('');

    const validatedData = csvData.map((row) => ({
      email: row.email?.trim().toLowerCase(),
      role: row.role?.trim().toUpperCase(),
      tier_rank: parseInt(row.tier_rank) || 3,
      current_status: 'AVAILABLE',
    }));

    // Filter out invalid rows
    const cleanData = validatedData.filter(d => d.email && ['ADMIN', 'MANAGER', 'IC'].includes(d.role));
    
    if (cleanData.length === 0) {
      setStaffMessage('No valid staff data found in CSV.');
      setLoadingStaff(false);
      return;
    }

    // Check for duplicates against existing profiles
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
      setResolvedUploadData(newEntries); // Start with the clean new entries
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
      setStaffMessage(`Successfully updated ${data.length} staff members`);
      setTimeout(() => setStaffMessage(''), 4000);
    } catch (error) {
      setStaffMessage(`Error: ${error.message}`);
    } finally {
      setLoadingStaff(false);
    }
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

  // --- USER MANAGEMENT FUNCTIONS ---
  const handleUpdateProfile = async (id, updates) => {
    await supabase.from('profiles').update(updates).eq('id', id);
    fetchProfiles();
  };

  const handleDeleteProfile = async (id) => {
    await supabase.from('profiles').delete().eq('id', id);
    setDeleteConfirmId(null);
    fetchProfiles();
  };

  const filteredProfiles = profiles.filter(p => 
    p.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3 flex-1 mr-4">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Admin Mode Instructions</h3>
              <p className="text-sm text-blue-800">Upload CSVs to update roster (email, role, tier_rank). Use the button on the right to manually manage the current roster.</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowManageUsersModal(true)}
            style={{ backgroundColor: '#0F172A', color: '#ffffff' }}
            className="flex items-center gap-2 px-6 py-4 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all whitespace-nowrap"
          >
            <UserCog className="w-5 h-5" />
            Edit/Remove Users
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* STAFF UPLOAD CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#E0F5F6] rounded-lg">
                <Users className="w-6 h-6 text-[#007C8C]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Staff Roster Upload</h3>
            </div>
            <CSVUploadZone onUpload={handleStaffUpload} title="Drop Staff CSV" description="Headers: email, role, tier_rank" expectedColumns={['email', 'role', 'tier_rank']} />
            {staffMessage && (
              <div className={`mt-4 p-4 rounded-xl text-sm font-medium ${staffMessage.includes('Successfully') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {staffMessage}
              </div>
            )}
            {loadingStaff && <div className="mt-4 flex items-center gap-2 text-[#007C8C]"><Loader className="w-4 h-4 animate-spin" /> Processing...</div>}
          </div>

          {/* ADMIN & MANAGER PIN CARDS (Side-by-Side) */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Admin Mode PIN</h3>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">New PIN</label>
                  <input 
                    type={showNewAdminPin ? "text" : "password"} 
                    value={newAdminPin} 
                    onChange={(e) => setNewAdminPin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-1 focus:ring-[#5E4791]" 
                    placeholder="Min 4 chars"
                  />
                </div>
                <button onClick={() => handleUpdatePin('ADMIN')} style={{backgroundColor:'#5E4791', color:'#fff'}} className="px-4 py-2 rounded-lg font-bold text-sm">Update</button>
              </div>
              {adminPinMessage && <p className="text-xs mt-2 text-green-600 font-medium">{adminPinMessage.text}</p>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Manager Mode PIN</h3>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">New PIN</label>
                  <input 
                    type={showNewManagerPin ? "text" : "password"} 
                    value={newManagerPin} 
                    onChange={(e) => setNewManagerPin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-1 focus:ring-[#5E4791]" 
                    placeholder="Min 4 chars"
                  />
                </div>
                <button onClick={() => handleUpdatePin('MANAGER')} style={{backgroundColor:'#5E4791', color:'#fff'}} className="px-4 py-2 rounded-lg font-bold text-sm">Update</button>
              </div>
              {managerPinMessage && <p className="text-xs mt-2 text-green-600 font-medium">{managerPinMessage.text}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* --- DUPLICATE RESOLVER MODAL --- */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#5E4791] p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Resolve Data Conflicts</h2>
                <p className="text-sm opacity-80">{pendingDuplicates.length} duplicates detected. Choose which data to keep.</p>
              </div>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b">
                    <th className="pb-4 px-4">User Email</th>
                    <th className="pb-4 px-4">Current Data (In App)</th>
                    <th className="pb-4 text-center"><ArrowRight className="inline w-4 h-4" /></th>
                    <th className="pb-4 px-4">Incoming Data (From CSV)</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDuplicates.map((dup, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-6 px-4 font-bold text-gray-900">{dup.old.email}</td>
                      <td className="py-6 px-4">
                        <button 
                          onClick={() => resolveDuplicateRow(idx, 'old')}
                          className="w-full text-left p-3 rounded-xl border-2 border-gray-100 hover:border-[#007C8C] transition-all group"
                        >
                          <div className="text-xs text-gray-400 font-bold group-hover:text-[#007C8C]">KEEP EXISTING</div>
                          <div className="font-semibold text-gray-700">{dup.old.role} — Tier {dup.old.tier_rank}</div>
                        </button>
                      </td>
                      <td className="text-center text-gray-300 font-bold">VS</td>
                      <td className="py-6 px-4">
                        <button 
                          onClick={() => resolveDuplicateRow(idx, 'new')}
                          className="w-full text-left p-3 rounded-xl border-2 border-gray-100 hover:border-[#5E4791] transition-all group"
                        >
                          <div className="text-xs text-gray-400 font-bold group-hover:text-[#5E4791]">OVERWRITE WITH NEW</div>
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

      {/* --- USER MANAGEMENT MODAL --- */}
      {showManageUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A]">Staff Roster Management</h2>
                <p className="text-gray-500">Modify roles, ranks, or remove users from the system.</p>
              </div>
              <button onClick={() => setShowManageUsersModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-8 h-8 text-gray-400" />
              </button>
            </div>

            <div className="p-8 bg-white border-b">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Search by email..." 
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-[#5E4791] outline-none text-lg"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-20 text-gray-400 italic">No users found matching "{userSearchTerm}"</div>
              ) : (
                filteredProfiles.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-md transition-all">
                    <div className="flex-1">
                      <div className="text-lg font-bold text-[#0F172A]">{p.email}</div>
                      <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">System User</div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Role</label>
                        <select 
                          value={p.role} 
                          onChange={(e) => handleUpdateProfile(p.id, { role: e.target.value })}
                          className="bg-white border rounded-lg px-3 py-2 font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-[#5E4791]"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="IC">IC</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Tier</label>
                        <select 
                          value={p.tier_rank || 3} 
                          onChange={(e) => handleUpdateProfile(p.id, { tier_rank: parseInt(e.target.value) })}
                          className="bg-white border rounded-lg px-3 py-2 font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-[#5E4791]"
                        >
                          <option value="1">Tier 1</option>
                          <option value="2">Tier 2</option>
                          <option value="3">Tier 3</option>
                        </select>
                      </div>

                      {deleteConfirmId === p.id ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                          <button 
                            onClick={() => handleDeleteProfile(p.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-700"
                          >
                            Confirm Delete
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-gray-400 hover:text-gray-600 font-bold text-sm px-2">Cancel</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-6 h-6" />
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
    </div>
  );
}