import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CSVUploadZone } from '../components/CSVUploadZone';
import { TopNav } from '../components/TopNav';
import { Users, Calendar, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Loader, Info, Lock, Eye, EyeOff } from 'lucide-react';

export function AdminPanel() {
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

  useEffect(() => {
    fetchProfiles();
    fetchSlots();
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

  const fetchSlots = async () => {
    try {
      const { data } = await supabase.from('bps_slots').select('*').order('start_time');
      setSlots(data || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
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
    } catch (error) {
      console.error('Settings table might not exist yet. Using fallbacks.');
    }
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
      const { error } = await supabase
        .from('app_settings')
        .upsert({ setting_key: key, setting_value: newPin }, { onConflict: 'setting_key' });
      
      if (error) throw error;

      setCurrentPin(newPin);
      setNewPin('');
      setMessage({ type: 'success', text: `${role} PIN updated successfully!` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Database error. Make sure app_settings table exists in Supabase.' });
    } finally {
      setUpdating(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  // Keep existing CSV Upload Handlers...
  const handleStaffUpload = async (data) => {
    setLoadingStaff(true);
    setStaffMessage('');
    try {
      const validatedData = data.map((row) => ({
        email: row.email?.trim(),
        role: row.role?.trim().toUpperCase(),
        tier_rank: parseInt(row.tier_rank) || null,
        current_status: 'AVAILABLE',
      }));
      const errors = validatedData.filter((d) => !d.email || !d.role || !['ADMIN', 'MANAGER', 'IC'].includes(d.role));
      if (errors.length > 0) {
        setStaffMessage(`Error: ${errors.length} rows have invalid data`);
        setLoadingStaff(false);
        return;
      }
      for (const row of validatedData) {
        await supabase.from('profiles').upsert({ email: row.email, role: row.role, tier_rank: row.tier_rank, current_status: row.current_status }, { onConflict: 'email' });
      }
      await fetchProfiles();
      setStaffMessage(`Successfully imported ${validatedData.length} staff members`);
      setTimeout(() => setStaffMessage(''), 4000);
    } catch (error) {
      setStaffMessage(`Error: ${error.message}`);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSlotsUpload = async (data) => {
    setLoadingSlots(true);
    setSlotsMessage('');
    try {
      const validatedData = data.map((row) => ({
        patient_identifier: row.patient_id?.trim() || row.patient_identifier?.trim(),
        start_time: row.start_time?.trim(),
      }));
      const errors = validatedData.filter((d) => !d.patient_identifier || !d.start_time);
      if (errors.length > 0) {
        setSlotsMessage(`Error: ${errors.length} rows have invalid data`);
        setLoadingSlots(false);
        return;
      }
      for (const row of validatedData) {
        await supabase.from('bps_slots').insert({ patient_identifier: row.patient_identifier, start_time: new Date(row.start_time).toISOString(), status: 'OPEN' });
      }
      await fetchSlots();
      setSlotsMessage(`Successfully imported ${validatedData.length} BPS slots`);
      setTimeout(() => setSlotsMessage(''), 4000);
    } catch (error) {
      setSlotsMessage(`Error: ${error.message}`);
    } finally {
      setLoadingSlots(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Admin Mode Instructions</h3>
            <p className="text-sm text-blue-800">Upload CSVs to update roster or add appointments. Staff roster requires: email, role, tier_rank. Slots require: patient_identifier, start_time.</p>
          </div>
        </div>

        {/* --- DATA OPERATIONS SECTION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* STAFF UPLOAD CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#E0F5F6] rounded-lg">
                <Users className="w-6 h-6 text-[#007C8C]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Staff Roster</h3>
                <p className="text-sm text-gray-600">Upload staff CSV file</p>
              </div>
            </div>
            <CSVUploadZone onUpload={handleStaffUpload} title="Upload Staff Roster" description="CSV format: email, role, tier_rank" expectedColumns={['email', 'role', 'tier_rank']} />
            {staffMessage && (
              <div className={`mt-4 flex gap-3 p-4 rounded-xl ${staffMessage.includes('Successfully') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {staffMessage.includes('Successfully') ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <p className="text-sm font-medium">{staffMessage}</p>
              </div>
            )}
            {loadingStaff && <div className="mt-4 flex items-center gap-3 text-[#007C8C]"><Loader className="w-5 h-5 animate-spin" /><span className="text-sm font-medium">Processing...</span></div>}
            
            <div className="mt-6 border-t border-gray-100 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900">Current Staff</h4>
                <span className="text-sm text-gray-600">{profiles.length} members</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                {profiles.map((profile) => (
                  <div key={profile.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{profile.email}</p>
                      <p className="text-xs text-gray-600">{profile.role}</p>
                    </div>
                    {profile.tier_rank && <span className="px-2.5 py-1 bg-[#E0F5F6] text-[#007C8C] text-xs font-semibold rounded-full">Tier {profile.tier_rank}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SLOTS UPLOAD CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#E0F5F6] rounded-lg">
                <Calendar className="w-6 h-6 text-[#007C8C]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">BPS Appointment Slots</h3>
                <p className="text-sm text-gray-600">Upload slots CSV file</p>
              </div>
            </div>
            <CSVUploadZone onUpload={handleSlotsUpload} title="Upload BPS Slots" description="CSV format: patient_identifier, start_time" expectedColumns={['patient_identifier', 'start_time']} />
            {slotsMessage && (
              <div className={`mt-4 flex gap-3 p-4 rounded-xl ${slotsMessage.includes('Successfully') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {slotsMessage.includes('Successfully') ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <p className="text-sm font-medium">{slotsMessage}</p>
              </div>
            )}
            {loadingSlots && <div className="mt-4 flex items-center gap-3 text-[#007C8C]"><Loader className="w-5 h-5 animate-spin" /><span className="text-sm font-medium">Processing...</span></div>}
            
            <div className="mt-6 border-t border-gray-100 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900">Uploaded Slots</h4>
                <span className="text-sm text-gray-600">{slots.length} slots</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                {slots.map((slot) => (
                  <div key={slot.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{slot.patient_identifier}</p>
                      <p className="text-xs text-gray-600">{new Date(slot.start_time).toLocaleString()}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold ${slot.status === 'OPEN' ? 'bg-green-100 text-green-800' : slot.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}`}>
                      {slot.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- SECURITY SETTINGS SECTION --- */}
        <h2 className="text-2xl font-bold text-[#0F172A] mb-6 flex items-center gap-3">
          <Lock className="w-6 h-6 text-[#5E4791]" />
          Security Settings
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ADMIN PIN CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-1">Admin Mode PIN</h3>
            <p className="text-sm text-gray-500 mb-6">Manage the access PIN required to enter Admin Mode.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Current Admin PIN</label>
                <div className="relative">
                  <input
                    type={showAdminPin ? "text" : "password"}
                    value={currentAdminPin}
                    readOnly
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 outline-none pr-10"
                  />
                  <button onClick={() => setShowAdminPin(!showAdminPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">New Admin PIN</label>
                <div className="relative">
                  <input
                    type={showNewAdminPin ? "text" : "password"}
                    value={newAdminPin}
                    onChange={(e) => setNewAdminPin(e.target.value)}
                    placeholder="Enter new 4+ digit PIN"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5E4791] outline-none pr-10 transition-shadow"
                  />
                  <button onClick={() => setShowNewAdminPin(!showNewAdminPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {adminPinMessage && (
                <div className={`p-3 rounded-lg text-sm font-medium ${adminPinMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {adminPinMessage.text}
                </div>
              )}

              <button
                onClick={() => handleUpdatePin('ADMIN')}
                disabled={updatingAdmin || !newAdminPin}
                style={{ backgroundColor: '#5E4791', color: '#ffffff' }}
                className="w-full mt-2 font-bold py-3 rounded-lg transition-all shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updatingAdmin ? <Loader className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Update Admin PIN
              </button>
            </div>
          </div>

          {/* MANAGER PIN CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-1">Manager Mode PIN</h3>
            <p className="text-sm text-gray-500 mb-6">Manage the access PIN required to enter Manager Mode.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Current Manager PIN</label>
                <div className="relative">
                  <input
                    type={showManagerPin ? "text" : "password"}
                    value={currentManagerPin}
                    readOnly
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 outline-none pr-10"
                  />
                  <button onClick={() => setShowManagerPin(!showManagerPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showManagerPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">New Manager PIN</label>
                <div className="relative">
                  <input
                    type={showNewManagerPin ? "text" : "password"}
                    value={newManagerPin}
                    onChange={(e) => setNewManagerPin(e.target.value)}
                    placeholder="Enter new 4+ digit PIN"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5E4791] outline-none pr-10 transition-shadow"
                  />
                  <button onClick={() => setShowNewManagerPin(!showNewManagerPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewManagerPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {managerPinMessage && (
                <div className={`p-3 rounded-lg text-sm font-medium ${managerPinMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {managerPinMessage.text}
                </div>
              )}

              <button
                onClick={() => handleUpdatePin('MANAGER')}
                disabled={updatingManager || !newManagerPin}
                style={{ backgroundColor: '#5E4791', color: '#ffffff' }}
                className="w-full mt-2 font-bold py-3 rounded-lg transition-all shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updatingManager ? <Loader className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Update Manager PIN
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}