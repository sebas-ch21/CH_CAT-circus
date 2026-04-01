import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { CircleCheck as CheckCircle2, User, Loader, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ICDashboard() {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [inQueue, setInQueue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`bps_slots_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bps_slots', filter: `assigned_ic_id=eq.${user.id}` },
        () => checkStatus()
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [user]);

  const checkStatus = async () => {
    if (!user?.id) return;
    try {
      const { data: queueData } = await supabase.from('queue_entries').select('*').eq('ic_id', user.id).maybeSingle();
      setInQueue(!!queueData);

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      if (profileData?.current_status === 'BUSY' && !queueData) {
        const { data: slotData } = await supabase.from('bps_slots').select('*').eq('assigned_ic_id', user.id).eq('status', 'ASSIGNED').maybeSingle();
        if (slotData) setAssignment(slotData);
      } else {
        setAssignment(null);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const handleNoShow = async () => {
    setLoading(true);
    try {
      await supabase.from('queue_entries').insert({ ic_id: user.id, entered_at: new Date().toISOString() });
      await supabase.from('profiles').update({ current_status: 'IN_QUEUE' }).eq('id', user.id);
      setInQueue(true);
    } catch (error) {
      console.error('Error entering queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReceipt = async () => {
    setConfirming(true);
    try {
      await supabase.from('queue_entries').delete().eq('ic_id', user.id);
      await supabase.from('profiles').update({ current_status: 'BUSY' }).eq('id', user.id);
      setInQueue(false);
    } catch (error) {
      console.error('Error confirming receipt:', error);
    } finally {
      setConfirming(false);
    }
  };

  if (inQueue) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-8 text-center">
            
            <div className="flex justify-center mb-6">
              <CheckCircle2 className="w-24 h-24 text-green-500" />
            </div>
            
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Successfully Entered Queue</h1>
            <p className="text-gray-600 mb-8">Waiting for manager dispatch. Do not close this page.</p>

            {assignment && (
              <div className="space-y-4 text-left">
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
                  <p className="font-semibold text-green-900 mb-4">New Assignment Ready!</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-green-700 font-medium mb-1">Patient ID</p>
                      <p className="text-lg font-semibold text-green-900">{assignment.patient_identifier}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-700 font-medium mb-1">Appointment Time</p>
                      <p className="text-lg font-semibold text-green-900">
                        {new Date(assignment.start_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleConfirmReceipt}
                  disabled={confirming}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-5 px-6 rounded-2xl text-lg transition-all flex items-center justify-center gap-3"
                >
                  {confirming ? <><Loader className="w-6 h-6 animate-spin" />Confirming...</> : 'Confirm Receipt'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (assignment) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-2">
              <User className="w-8 h-8 text-gray-700" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Current Assignment</h1>

            <div className="space-y-4 text-left">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-sm text-gray-600 font-medium mb-2">Patient ID</p>
                <p className="text-3xl font-bold text-gray-900">{assignment.patient_identifier}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-sm text-gray-600 font-medium mb-2">Appointment Time</p>
                <p className="text-xl font-semibold text-gray-900">
                  {new Date(assignment.start_time).toLocaleString()}
                </p>
              </div>
            </div>

            <button
              onClick={handleNoShow}
              disabled={loading}
              className="mt-8 w-full bg-[#A890D3] hover:bg-[#8B6FC4] text-white font-bold py-6 px-6 rounded-2xl text-lg transition-all shadow-lg"
            >
              {loading ? 'Entering Queue...' : 'Press Button to Enter Queue for No-Show Reassignment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopNav />
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">IC Mode Instructions</h3>
              <p className="text-sm text-blue-800">Click the button below to enter the reassignment queue when your patient doesn't show up.</p>
            </div>
          </div>

          <button
            onClick={handleNoShow}
            disabled={loading}
            className="w-full bg-[#A890D3] hover:bg-[#8B6FC4] text-white font-bold py-10 px-6 rounded-2xl text-xl transition-all shadow-lg min-h-[160px]"
          >
            {loading ? (
              <><Loader className="w-8 h-8 animate-spin mx-auto mb-2" /> Entering Queue...</>
            ) : (
              'Press Button to Enter Queue for No-Show Reassignment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}