import { useState, useEffect, useCallback } from 'react';
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
    if (assignment?.status !== 'ASSIGNED' || !assignment.assigned_at) {
      setTimeLeft(0);
      return;
    }
    const assignedTime = new Date(assignment.assigned_at).getTime();
    if (Number.isNaN(assignedTime)) {
      setTimeLeft(0);
      return;
    }
    const tick = () => {
      const diff = Math.floor((300000 - (Date.now() - assignedTime)) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [assignment?.id, assignment?.assigned_at, assignment?.status]);

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
      <div className="min-h-[100dvh] ch-paper flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-4 text-left ch-rise">
            <div className="relative overflow-hidden rounded-2xl p-6 bg-[#E8F0EE] border border-[#A8C8C2]">
              <div className="absolute top-0 right-0 bg-[#335649] text-[#FAF8F5] px-4 py-1.5 rounded-bl-2xl text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" strokeWidth={1.8} /> {formatMinutes(timeLeft)}
              </div>
              <p className="text-[11px] uppercase tracking-micro font-semibold text-[#335649] mt-6 mb-1">New assignment</p>
              <p className="font-display text-3xl text-[#12142A] mb-6">Ready to accept</p>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] text-[#58534C] font-semibold uppercase tracking-micro mb-1">Room ID</p>
                  <p className="text-2xl font-semibold text-[#12142A] tracking-tight">{assignment.patient_identifier}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#58534C] font-semibold uppercase tracking-micro mb-1">Meeting time</p>
                  <p className="text-lg font-medium text-[#12142A]">{new Date(assignment.start_time).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleConfirmReceipt}
                disabled={isAccepting || isRejecting || timeLeft <= 0}
                className="w-full bg-[#335649] hover:bg-[#0A3327] text-[#FAF8F5] font-semibold py-5 px-6 rounded-2xl text-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-50 ch-focus-ring"
              >
                {isAccepting ? <><Loader className="w-5 h-5 animate-spin" />Confirming</> : 'Accept & view Zoom link'}
              </button>
              <button
                onClick={handleRejectAssignment}
                disabled={isAccepting || isRejecting}
                className="w-full bg-white hover:bg-[#FDEBEC] text-[#9F2F2D] border border-[#F2C9CC] font-semibold py-4 px-6 rounded-2xl text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="w-5 h-5" strokeWidth={1.8} /> Reject & return to queue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (assignment && assignment.status === 'CONFIRMED') {
    return (
      <div className="min-h-[100dvh] ch-paper flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6 text-center ch-rise">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#CFE4EB] rounded-2xl mb-1">
              <Video className="w-7 h-7 text-[#005682]" strokeWidth={1.8} />
            </div>
            <h1 className="font-display text-4xl text-[#12142A] tracking-tight">Match confirmed</h1>
            <div className="space-y-4 text-left">
              <div className="ch-card p-6">
                <p className="text-[11px] text-[#58534C] font-semibold uppercase tracking-micro mb-1">Room ID</p>
                <p className="text-2xl font-semibold text-[#12142A] tracking-tight">{assignment.patient_identifier}</p>
              </div>
              <div className="ch-card p-6">
                <p className="text-[11px] text-[#58534C] font-semibold uppercase tracking-micro mb-2">Zoom link</p>
                {assignment.zoom_link
                  ? <a href={assignment.zoom_link} target="_blank" rel="noreferrer" className="text-[#005682] font-semibold hover:underline break-all">{assignment.zoom_link}</a>
                  : <p className="text-[#A29A8E] italic font-medium">Manager did not provide a link.</p>
                }
              </div>
            </div>
            <button
              onClick={handleEnterQueue}
              disabled={isQueueing}
              className="mt-6 w-full bg-[#12142A] hover:bg-[#011537] text-[#FAF8F5] font-semibold py-5 px-6 rounded-2xl text-base transition-colors disabled:opacity-50 ch-focus-ring"
            >
              {isQueueing ? 'Entering queue...' : 'Patient no-show: re-enter queue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (inQueue) {
    return (
      <div className="min-h-[100dvh] ch-paper flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6 text-center ch-rise">
            <div className="flex justify-center mb-2">
              <div className="w-20 h-20 rounded-full bg-[#E8F0EE] flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-[#335649]" strokeWidth={1.8} />
              </div>
            </div>
            <h1 className="font-display text-4xl text-[#12142A] tracking-tight">You&rsquo;re in the queue</h1>
            <p className="text-[#58534C] font-medium">Waiting for manager dispatch. Keep this page open.</p>
            <button
              onClick={handleExitQueue}
              disabled={isQueueing}
              className="w-full bg-white hover:bg-[#FDEBEC] text-[#9F2F2D] border border-[#F2C9CC] font-semibold py-5 px-6 rounded-2xl text-base transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isQueueing ? <Loader className="w-5 h-5 animate-spin" /> : <><XCircle className="w-5 h-5" strokeWidth={1.8} /> Exit queue</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] ch-paper flex flex-col">
      <TopNav />
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 ch-rise">
          <div className="bg-[#CFE4EB]/60 border border-[#A8C8C2] rounded-2xl p-5 flex gap-3">
            <Info className="w-5 h-5 text-[#005682] flex-shrink-0 mt-0.5" strokeWidth={1.8} />
            <div>
              <h3 className="font-semibold text-[#12142A] mb-1">IC mode</h3>
              <p className="text-sm text-[#495654] font-medium leading-relaxed">Enter the reassignment queue when your patient doesn&rsquo;t show up.</p>
            </div>
          </div>
          <button
            onClick={handleEnterQueue}
            disabled={isQueueing}
            className="w-full bg-[#12142A] hover:bg-[#011537] text-[#FAF8F5] font-semibold py-10 px-6 rounded-2xl text-xl transition-colors min-h-[160px] disabled:opacity-50 ch-focus-ring"
          >
            {isQueueing ? <><Loader className="w-7 h-7 animate-spin mx-auto mb-2" /> Entering</> : 'Enter reassignment queue'}
          </button>
        </div>
      </div>
    </div>
  );
}
