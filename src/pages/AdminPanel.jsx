import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CSVUploadZone } from '../components/CSVUploadZone';
import { TopNav } from '../components/TopNav';
import { 
  Users, Calendar, CircleAlert as AlertCircle, CircleCheck as CheckCircle, 
  Loader, Info, Lock, Eye, EyeOff, Trash2, Search, ArrowRight, Settings
} from 'lucide-react';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('roster'); // roster, appointments, security
  const [profiles, setProfiles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [staffMessage, setStaffMessage] = useState('');
  const [slotsMessage, setSlotsMessage] = useState('');
  
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

  // Search/Filter State
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

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
      const { data } = await supabase.from('bps_slots').select('*').order('start_time', { ascending: false });
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
    } catch (error) { setMessage({ type: 'error', text: 'Database error.' }); }
    finally {
      setUpdating(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  // --- STAFF UPLOAD LOGIC ---
  const handleStaffUpload = async (csvData) => {
    setLoadingStaff(true);
    setStaffMessage('');

    const validatedData = csvData.map((row) => ({
      email: row.email?.trim().toLowerCase(),
      role: row.role?.trim().toUpperCase(),
      tier_rank: parseInt(row.tier_rank) || 3,
      current_status: 'AVAILABLE',
    }));

    const cleanData = validatedData.filter(d => d.email && ['ADMIN', 'MANAGER', 'IC'].includes(d.role));
    
    if (cleanData.length === 0) {
      setStaffMessage('No valid staff data found.');
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
      setStaffMessage(`Successfully updated ${data.length} staff members`);
      setTimeout(() => setStaffMessage(''), 4000);
    } catch (error) { setStaffMessage(`Error: ${error.message}`); }
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

  // --- APPOINTMENT UPLOAD LOGIC ---
  const handleSlotsUpload = async (data) => {
    setLoadingSlots(true);
    setSlotsMessage('');
    try {
      const validatedData = data.map((row) => ({
        patient_identifier: row.patient_identifier?.trim() || row.patient_id?.trim(),
        start_time: row.start_time?.trim(),
      }));
      const errors = validatedData.filter((d) => !d.patient_identifier || !d.start_time);
      if (errors.length > 0) {
        setSlotsMessage(`Error: ${errors.length} rows invalid`);
        setLoadingSlots(false);
        return;
      }
      for (const row of validatedData) {
        await supabase.from('bps_slots').insert({ patient_identifier: row.patient_identifier, start_time: new Date(row.start_time).toISOString(), status: 'OPEN' });
      }
      await fetchSlots();
      setSlotsMessage(`Successfully imported ${validatedData.length} BPS slots`);
      setTimeout(() => setSlotsMessage(''), 4000);
    } catch (error) { setSlotsMessage(`Error: ${error.message}`); }
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

  // Tab Header Helper
  const getTabClass = (id) => `flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === id ? 'border-[#5E4791] text-[#5E4791] bg-purple-50' : 'border-transparent text-gray-400 hover:text-gray-600'}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <TopNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* TAB NAVIGATION */}
        <div className="flex border-b border-gray-200 mb-8 bg-white rounded-t-xl overflow-hidden shadow-sm">
          <button onClick={() => setActiveTab('roster')} className={getTabClass('roster')}><Users className="w-4 h-4" /> Roster Management</button>
          <button onClick={() => setActiveTab('appointments')} className={getTabClass('appointments')}><Calendar className="w-4 h-4" /> Appointment Management</button>
          <button onClick={() => setActiveTab('security')} className={getTabClass('security')}><Settings className="w-4 h-4" /> Passcode Management</button>
        </div>

        {/* --- ROSTER MANAGEMENT