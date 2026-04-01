import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle2, User, Loader, Info, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ICDashboard() {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [inQueue, setInQueue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [exiting, setExiting] = useState(false);

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
        {
          event: '*',
          schema: 'public',
          table: 'bps_slots',
          filter: `assigned_ic_id=eq.${user.id}`,
        },
        () => {
          checkStatus();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const checkStatus = async () => {
    if (!user?.id) return;

    try {
      const { data: queueData } = await supabase
        .from('queue_entries')
        .select('*')
        .eq('ic_id', user.id)
        .maybeSingle();

      setInQueue(!!queueData);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData?.current_status === 'BUSY' && !queueData) {
        const { data: slotData } = await supabase
          .from('bps_slots')
          .select('*')
          .eq('assigned_ic_id', user.id)
          .eq('status', 'ASSIGNED')
          .maybeSingle();

        if (slotData) {
          setAssignment(slotData);
        }
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
      await supabase.from('queue_entries').insert({
        ic_id: user.id,
        entered_at: new Date().toISOString(),
      });

      await supabase
        .from('profiles')
        .update({ current_status: 'IN_QUEUE' })
        .eq('id', user.id);

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
      await supabase
        .from('queue_entries')
        .delete()
        .eq('ic_id', user.id);

      await supabase
        .from('profiles')
        .update({ current_status: 'BUSY' })
        .eq('id', user.id);

      setInQueue(false);
    } catch (error) {
      console.error('Error confirming receipt:', error);
    } finally {
      setConfirming(false);
    }
  };

  const handleExitQueue = async () => {
    setExiting(true);
    try {
      await supabase
        .from('queue_entries')
        .delete()
        .eq('ic_id', user.id);

      await supabase
        .from('profiles')
        .update({ current_status: 'AVAILABLE' })
        .eq('id', user.id);

      setInQueue(false);
    } catch (error) {
      console.error('Error exiting queue:', error);
    } finally {
      setExiting(false);
    }
  };

  if (inQueue) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav />

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-8">
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">IC Mode - In Queue</h3>
                <p className="text-sm text-blue-800">You are waiting for a manager to assign you to an available BPS slot. Stay on this page for updates.</p>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <Clock className="w-10 h-10 text-gray-600 animate-pulse" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-3">
                In reassignment queue
              </h1>
              <p className="text-gray-600 mb-6">
                Waiting for manager dispatch...
              </p>

              <button
                onClick={handleExitQueue}
                disabled={exiting}
                className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-900 font-medium py-3 px-6 rounded-xl transition-all"
              >
                {exiting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin inline mr-2" />
                    Exiting Queue...
                  </>
                ) : (
                  'Exit Queue'
                )}
              </button>
            </div>

            {assignment && (
              <div className="space-y-4">
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <p className="font-semibold text-green-900">New Assignment Ready!</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-green-700 font-medium mb-1">Patient ID</p>
                      <p className="text-lg font-semibold text-green-900">
                        {assignment.patient_identifier}
                      </p>
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
                  className="w-full bg-[#059669] hover:bg-[#047857] disabled:bg-gray-400 text-white font-bold py-5 px-6 rounded-2xl text-lg transition-all flex items-center justify-center gap-3"
                >
                  {confirming ? (
                    <>
                      <Loader className="w-6 h-6 animate-spin text-white" />
                      <span className="text-white">Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-white" />
                      <span className="text-white">Confirm Receipt</span>
                    </>
                  )}
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
          <div className="w-full max-w-sm space-y-6">
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">IC Mode - Current Assignment</h3>
                <p className="text-sm text-blue-800">You have an active patient assignment. Click the button below if the patient doesn't show up.</p>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <User className="w-8 h-8 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Current Assignment
              </h1>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-sm text-gray-600 font-medium mb-2">Patient ID</p>
                <p className="text-3xl font-bold text-gray-900">
                  {assignment.patient_identifier}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-sm text-gray-600 font-medium mb-2">
                  Appointment Time
                </p>
                <p className="text-xl font-semibold text-gray-900">
                  {new Date(assignment.start_time).toLocaleString()}
                </p>
              </div>
            </div>

            <button
              onClick={handleNoShow}
              disabled={loading}
              className="w-full bg-[#A890D3] hover:bg-[#8B6FC4] disabled:bg-gray-400 text-gray-900 font-extrabold py-6 px-6 rounded-2xl text-lg transition-all flex items-center justify-center gap-3 shadow-lg"
            >
              {loading ? (
                <>
                  <Loader className="w-6 h-6 animate-spin text-gray-900" />
                  <span className="text-gray-900">Entering Queue...</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-7 h-7 text-gray-900" />
                  <span className="text-gray-900 leading-tight">Patient No-Show:<br/>Enter Reassignment Queue</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopNav />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">IC Mode Instructions</h3>
              <p className="text-sm text-blue-800">Click the button below to enter the reassignment queue when your patient doesn't show up for their appointment.</p>
            </div>
          </div>

          <div className="text-center bg-[#8B6FC4] rounded-2xl p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              You're Available
            </h2>
            <p className="text-white">
              Ready to accept new appointments
            </p>
          </div>

          <button
            onClick={handleNoShow}
            disabled={loading}
            className="w-full bg-[#A890D3] hover:bg-[#8B6FC4] disabled:bg-gray-400 text-gray-900 font-extrabold py-8 px-6 rounded-2xl text-lg transition-all flex flex-col items-center justify-center gap-4 shadow-lg min-h-[160px]"
          >
            {loading ? (
              <>
                <Loader className="w-8 h-8 animate-spin text-gray-900" />
                <span className="text-gray-900">Entering Queue...</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 text-gray-900" />
                <span className="text-gray-900 leading-tight">Patient No-Show:<br/>Enter Reassignment Queue</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
