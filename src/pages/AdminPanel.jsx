import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CSVUploadZone } from '../components/CSVUploadZone';
import { ShieldCheck, Users, Calendar, LogOut, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [staffMessage, setStaffMessage] = useState('');
  const [slotsMessage, setSlotsMessage] = useState('');

  useEffect(() => {
    fetchProfiles();
    fetchSlots();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('email');
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchSlots = async () => {
    try {
      const { data, error } = await supabase
        .from('bps_slots')
        .select('*')
        .order('start_time');
      if (error) throw error;
      setSlots(data || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  };

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

      const errors = validatedData.filter(
        (d) =>
          !d.email ||
          !d.role ||
          !['ADMIN', 'MANAGER', 'IC'].includes(d.role) ||
          (d.role === 'IC' && (!d.tier_rank || d.tier_rank < 1 || d.tier_rank > 3))
      );

      if (errors.length > 0) {
        setStaffMessage(`Error: ${errors.length} rows have invalid data`);
        setLoadingStaff(false);
        return;
      }

      for (const row of validatedData) {
        await supabase
          .from('profiles')
          .upsert(
            {
              email: row.email,
              role: row.role,
              tier_rank: row.tier_rank,
              current_status: row.current_status,
            },
            { onConflict: 'email' }
          );
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
        await supabase.from('bps_slots').insert({
          patient_identifier: row.patient_identifier,
          start_time: new Date(row.start_time).toISOString(),
          status: 'OPEN',
        });
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-charlie-teal" strokeWidth={2} />
              <h1 className="text-xl font-semibold text-gray-900">Charlie Admissions</h1>
              <span className="ml-2 px-3 py-1 bg-charlie-mint-light text-charlie-teal text-xs font-medium rounded-full">
                Admin
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Operations Dashboard</h2>
          <p className="text-gray-600">Manage staff roster and appointment slots</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-charlie-mint-light rounded-lg">
                <Users className="w-6 h-6 text-charlie-teal" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Staff Roster</h3>
                <p className="text-sm text-gray-600">Upload staff CSV file</p>
              </div>
            </div>

            <CSVUploadZone
              onUpload={handleStaffUpload}
              title="Upload Staff Roster"
              description="CSV format: email, role, tier_rank"
              expectedColumns={['email', 'role', 'tier_rank']}
            />

            {staffMessage && (
              <div
                className={`mt-4 flex gap-3 p-4 rounded-xl ${
                  staffMessage.includes('Successfully')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {staffMessage.includes('Successfully') ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{staffMessage}</p>
              </div>
            )}

            {loadingStaff && (
              <div className="mt-4 flex items-center gap-3 text-charlie-teal">
                <Loader className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Processing staff data...</span>
              </div>
            )}

            <div className="mt-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900">Current Staff</h4>
                <span className="text-sm text-gray-600">{profiles.length} members</span>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {profiles.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No staff members yet</p>
                ) : (
                  profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">{profile.email}</p>
                        <p className="text-xs text-gray-600">{profile.role}</p>
                      </div>
                      {profile.tier_rank && (
                        <span className="px-2.5 py-1 bg-charlie-mint-light text-charlie-teal text-xs font-semibold rounded-full">
                          Tier {profile.tier_rank}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-charlie-mint-light rounded-lg">
                <Calendar className="w-6 h-6 text-charlie-teal" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">BPS Appointment Slots</h3>
                <p className="text-sm text-gray-600">Upload slots CSV file</p>
              </div>
            </div>

            <CSVUploadZone
              onUpload={handleSlotsUpload}
              title="Upload BPS Slots"
              description="CSV format: patient_identifier, start_time"
              expectedColumns={['patient_id', 'start_time']}
            />

            {slotsMessage && (
              <div
                className={`mt-4 flex gap-3 p-4 rounded-xl ${
                  slotsMessage.includes('Successfully')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {slotsMessage.includes('Successfully') ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{slotsMessage}</p>
              </div>
            )}

            {loadingSlots && (
              <div className="mt-4 flex items-center gap-3 text-charlie-teal">
                <Loader className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Processing BPS slots...</span>
              </div>
            )}

            <div className="mt-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900">Uploaded Slots</h4>
                <span className="text-sm text-gray-600">{slots.length} slots</span>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {slots.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No slots yet</p>
                ) : (
                  slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex justify-between items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">{slot.patient_identifier}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(slot.start_time).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          slot.status === 'OPEN'
                            ? 'bg-green-100 text-green-700'
                            : slot.status === 'ASSIGNED'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {slot.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
