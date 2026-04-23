import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { CircleCheck as CheckCircle2, Loader, Info, Circle as XCircle, Video, Clock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useDispatchActions } from '../hooks/useDispatchActions';

export function ICDashboard() {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [inQueue, setInQueue] = useState(false);
  const { isQueueing, enterQueue, exitQueue, isAccepting, acceptMatch, isRejecting, rejectMatch } = useDispatchActions();
  const [timeLeft, setTimeLeft] = useState(300);
  const [profileTier, setProfileTier] = useState(3);
  const pollRef = useRef(null);

  const checkStatus = useCallback(async () => {
    if (!user?.id || isAccepting || isRejecting || isQueueing) return;
    try {
      const { data: profile, error: pError } = await supabase
        .from('profiles').select('tier_rank').eq('id', user.id).maybeSingle();
        
      if (pError) { console.error('[Supabase Error]:', pError); toast.error(pError.message); }
      if (profile) setProfileTier(profile.tier_rank);

      const { data: slotData, error: sError } = await supabase
        .from('bps_slots')
        .select('*')
        .eq('assigned_ic_id', user.id)
        .in('status', ['ASSIGNED', 'CONFIRMED'])
        .limit(1);

      if (sError) { console.error('[Supabase Error]:', sError); toast.error(sError.message); }

      const activeSlot = slotData?.[0] || null;
      setAssignment(activeSlot);

      const { data: queueData, error: qError } = await supabase
        .from('queue_entries').select('id').eq('ic_id', user.id).limit(1);

      if (qError) { console.error('[Supabase Error]:', qError); toast.error(qError.message); }

      if (activeSlot) {
        setInQueue(false);
      } else {
        setInQueue(queueData && queueData.length > 0);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  }, [user?.id, isAccepting, isRejecting, isQueueing]);

  useEffect(() => {
    checkStatus();

    const channel = supabase.channel('ic_dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bps_slots', filter: `assigned_ic_id=eq.${user?.id}` }, () => {
        checkStatus();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `ic_id=eq.${user?.id}` }, () => {
        checkStatus();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel);
    };
  }, [checkStatus]);

  useEffect(() => {
    if (assignment?.status === 'ASSIGNED' && assignment.assigned_at) {
      const assignedTime = new Date(assignment.assigned_at).getTime();
      const timer = setInterval(() => {
        const diff = Math.floor((300000 - (Date.now() - assignedTime)) / 1000);
        setTimeLeft(diff > 0 ? diff : 0);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [assignment]);

  const handleEnterQueue = async () => {
    const { success } = await enterQueue(user.id);
    if (success) await checkStatus();
  };

  const handleExitQueue = async () => {
    const { success } = await exitQueue(user.id);
    if (success) await checkStatus();
  };

  const handleConfirmReceipt = async () => {
    if (isAccepting || !assignment) return;
    const { success } = await acceptMatch({
      slotId: assignment.id,
      icId: user.id,
      icEmail: user.email,
      managerEmail: assignment.host_manager || 'Unknown',
      patientIdentifier: assignment.patient_identifier,
      startTime: assignment.start_time,
      tierRank: profileTier
    });
    if (success) await checkStatus();
  };

  const handleRejectAssignment = async () => {
    if (isRejecting || !assignment) return;
    const { success } = await rejectMatch(assignment.id, user.id);
    if (success) await checkStatus();
  };

  const formatMinutes = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (assignment && assignment.status === 'ASSIGNED') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-4 text-left">
            <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1 rounded-bl-xl font-bold flex items-center gap-2">
                <Clock className="w-4 h-4" /> {formatMinutes(timeLeft)}
              </div>
              <p className="font-bold text-green-900 text-xl mt-4 mb-6">New Assignment Ready!</p>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-green-700 font-bold uppercase tracking-widest mb-1">Room ID</p>
                  <p className="text-2xl font-black text-green-900">{assignment.patient_identifier}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700 font-bold uppercase tracking-widest mb-1">Meeting Time</p>
                  <p className="text-lg font-bold text-green-900">{new Date(assignment.start_time).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleConfirmReceipt}
                disabled={isAccepting || isRejecting || timeLeft <= 0}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-5 px-6 rounded-2xl text-xl transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
              >
                {isAccepting ? <><Loader className="w-6 h-6 animate-spin" />Confirming...</> : 'Accept & View Zoom Link'}
              </button>
              <button
                onClick={handleRejectAssignment}
                disabled={isAccepting || isRejecting}
                className="w-full bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 font-bold py-4 px-6 rounded-2xl text-lg transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <X className="w-5 h-5" /> Reject & Return to Queue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (assignment && assignment.status === 'CONFIRMED') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-2">
              <Video className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Confirmed Match</h1>
            <div className="space-y-4 text-left">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Room ID</p>
                <p className="text-3xl font-black text-[#0F172A]">{assignment.patient_identifier}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Zoom Link</p>
                {assignment.zoom_link
                  ? <a href={assignment.zoom_link} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline break-all">{assignment.zoom_link}</a>
                  : <p className="text-gray-500 italic font-medium">Manager did not provide a link.</p>
                }
              </div>
            </div>
            <button
              onClick={handleEnterQueue}
              disabled={isQueueing}
              className="mt-8 w-full bg-[#0F172A] hover:bg-gray-800 text-white font-bold py-6 px-6 rounded-2xl text-lg transition-all shadow-lg disabled:opacity-50"
            >
              {isQueueing ? 'Entering Queue...' : 'Patient No-Show: Re-enter Queue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (inQueue) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-8 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-24 h-24 text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Successfully Entered Queue</h1>
            <p className="text-gray-600 mb-8">Waiting for manager dispatch. Do not close this page.</p>
            <button
              onClick={handleExitQueue}
              disabled={isQueueing}
              className="w-full bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 font-bold py-6 px-6 rounded-2xl text-lg transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
            >
              {isQueueing ? <Loader className="w-6 h-6 animate-spin" /> : <><XCircle className="w-6 h-6" /> Exit Queue</>}
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
              <h3 className="font-bold text-blue-900 mb-1">IC Mode Instructions</h3>
              <p className="text-sm text-blue-800 font-medium">Click below to enter the reassignment queue when your patient doesn't show up.</p>
            </div>
          </div>
          <button
            onClick={handleEnterQueue}
            disabled={isQueueing}
            className="w-full bg-[#0F172A] hover:bg-gray-800 text-white font-bold py-10 px-6 rounded-3xl text-xl transition-all shadow-2xl min-h-[160px] disabled:opacity-50"
          >
            {isQueueing ? <><Loader className="w-8 h-8 animate-spin mx-auto mb-2" /> Entering...</> : 'Enter Reassignment Queue'}
          </button>
        </div>
      </div>
    </div>
  );
}
