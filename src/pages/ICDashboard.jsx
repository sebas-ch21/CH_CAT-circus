import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { CircleCheck as CheckCircle2, Loader, Info, XCircle, Video, Clock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export function ICDashboard() {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [inQueue, setInQueue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); 
  const [profileTier, setProfileTier] = useState(3);

  // 100% READ-ONLY DATA FETCHING
  const checkStatus = useCallback(async () => {
    if (!user?.id || loading || actionLoading) return; 
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) setProfileTier(profile.tier_rank);

      const { data: slotData } = await supabase.from('bps_slots')
        .select('*')
        .eq('assigned_ic_id', user.id)
        .in('status', ['ASSIGNED', 'CONFIRMED'])
        .limit(1);
      const activeSlot = slotData?.[0] || null;
      setAssignment(activeSlot);

      const { data: queueData } = await supabase.from('queue_entries').select('id').eq('ic_id', user.id);
      const hasQueueRow = queueData && queueData.length > 0;

      // State Machine Prioritization
      if (activeSlot) {
        setInQueue(false);
      } else {
        setInQueue(profile?.current_status === 'IN_QUEUE');
      }

      // --- LAZY SELF-HEALING (Background Cleanup) ---
      // If Manager assigned a slot but RLS blocked them from deleting the queue row, IC deletes it here.
      if (activeSlot && hasQueueRow) {
        await supabase.from('queue_entries').delete().eq('ic_id', user.id);
        if (profile?.current_status !== 'BUSY') await supabase.from('profiles').update({ current_status: 'BUSY' }).eq('id', user.id);
      }
      
      // If IC is supposed to be in queue, but DB dropped the row, IC re-adds it here.
      if (!activeSlot && profile?.current_status === 'IN_QUEUE' && !hasQueueRow) {
        await supabase.from('queue_entries').insert([{ ic_id: user.id, entered_at: new Date().toISOString() }]);
      }
    } catch (error) {
      console.error('Status Check Error:', error);
    }
  }, [user?.id, loading, actionLoading]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000); 
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Visual 5-Minute Timer
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

  // EXPLICIT MUTATIONS
  const handleEnterQueue = async () => {
    setLoading(true); setInQueue(true); setAssignment(null);
    try {
      await supabase.from('queue_entries').delete().eq('ic_id', user.id);
      await supabase.from('queue_entries').insert([{ ic_id: user.id, entered_at: new Date().toISOString() }]);
      await supabase.from('profiles').update({ current_status: 'IN_QUEUE' }).eq('id', user.id);
    } catch (error) { setInQueue(false); toast.error('Failed to enter queue'); } finally { setLoading(false); }
  };

  const handleExitQueue = async () => {
    setLoading(true); setInQueue(false); 
    try {
      await supabase.from('queue_entries').delete().eq('ic_id', user.id);
      await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).eq('id', user.id);
    } catch (error) { setInQueue(true); } finally { setLoading(false); }
  };

  const handleConfirmReceipt = async () => {
    if (actionLoading || !assignment) return;
    setActionLoading(true);
    try {
      await supabase.from('dispatch_logs').insert([{
        ic_id: user.id, ic_email: user.email, tier_rank: profileTier,
        manager_email: assignment.host_manager || 'Unknown',
        patient_identifier: assignment.patient_identifier, start_time: assignment.start_time
      }]);
      await supabase.from('bps_slots').update({ status: 'CONFIRMED' }).eq('id', assignment.id);
      await supabase.from('profiles').update({ current_status: 'BUSY' }).eq('id', user.id);
      toast.success('Match Confirmed!');
      await checkStatus();
    } catch (error) { toast.error('Failed to confirm match.'); } finally { setActionLoading(false); }
  };

  const handleRejectAssignment = async () => {
    if (actionLoading || !assignment) return;
    setActionLoading(true);
    try {
      await supabase.from('bps_slots').update({ status: 'OPEN', assigned_ic_id: null, assigned_at: null }).eq('id', assignment.id);
      await supabase.from('profiles').update({ current_status: 'IN_QUEUE' }).eq('id', user.id);
      await supabase.from('queue_entries').insert([{ ic_id: user.id, entered_at: new Date().toISOString() }]);
      toast.success('Assignment rejected. Re-entered queue.');
      await checkStatus();
    } catch (error) { toast.error('Failed to reject assignment.'); } finally { setActionLoading(false); }
  };

  const formatMinutes = (seconds) => {
    const m = Math.floor(seconds / 60); const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- UI RENDER STATE MACHINE ---
  if (assignment && assignment.status === 'ASSIGNED') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-4 text-left animate-in zoom-in duration-300">
            <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1 rounded-bl-xl font-bold flex items-center gap-2">
                <Clock className="w-4 h-4" /> {formatMinutes(timeLeft)}
              </div>
              <p className="font-bold text-green-900 text-xl mt-4 mb-6">New Assignment Ready!</p>
              <div className="space-y-4">
                <div><p className="text-xs text-green-700 font-bold uppercase tracking-widest mb-1">Room ID</p><p className="text-2xl font-black text-green-900">{assignment.patient_identifier}</p></div>
                <div><p className="text-xs text-green-700 font-bold uppercase tracking-widest mb-1">Meeting Time</p><p className="text-lg font-bold text-green-900">{new Date(assignment.start_time).toLocaleString()}</p></div>
              </div>
            </div>
            <div className="space-y-3">
              <button onClick={handleConfirmReceipt} disabled={actionLoading || timeLeft <= 0} className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-5 px-6 rounded-2xl text-xl transition-all flex items-center justify-center gap-3 shadow-lg">
                {actionLoading ? <><Loader className="w-6 h-6 animate-spin" />Confirming...</> : 'Accept & View Zoom Link'}
              </button>
              <button onClick={handleRejectAssignment} disabled={actionLoading} className="w-full bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 font-bold py-4 px-6 rounded-2xl text-lg transition-all flex items-center justify-center gap-2 shadow-sm">
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
          <div className="w-full max-w-sm space-y-6 text-center animate-in fade-in duration-300">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-2"><Video className="w-8 h-8 text-blue-600" /></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Confirmed Match</h1>
            <div className="space-y-4 text-left">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Room ID</p>
                <p className="text-3xl font-black text-[#0F172A]">{assignment.patient_identifier}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Zoom Link</p>
                {assignment.zoom_link ? <a href={assignment.zoom_link} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline break-all">{assignment.zoom_link}</a> : <p className="text-gray-500 italic font-medium">Manager did not provide a link.</p>}
              </div>
            </div>
            <button onClick={handleEnterQueue} disabled={loading} className="mt-8 w-full bg-[#A890D3] hover:bg-[#8B6FC4] text-white font-bold py-6 px-6 rounded-2xl text-lg transition-all shadow-lg">
              {loading ? 'Entering Queue...' : 'Patient No-Show: Re-enter Queue'}
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
            <div className="flex justify-center mb-4"><CheckCircle2 className="w-24 h-24 text-green-500" /></div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Successfully Entered Queue</h1>
            <p className="text-gray-600 mb-8">Waiting for manager dispatch. Do not close this page.</p>
            <button onClick={handleExitQueue} disabled={loading} className="w-full bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 font-bold py-6 px-6 rounded-2xl text-lg transition-all flex items-center justify-center gap-3 shadow-sm">
              {loading ? <Loader className="w-6 h-6 animate-spin" /> : <><XCircle className="w-6 h-6" /> Exit Queue</>}
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
        <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div><h3 className="font-bold text-blue-900 mb-1">IC Mode Instructions</h3><p className="text-sm text-blue-800 font-medium">Click below to enter the reassignment queue when your patient doesn't show up.</p></div>
          </div>
          <button onClick={handleEnterQueue} disabled={loading} className="w-full bg-[#0F172A] hover:bg-gray-800 text-white font-bold py-10 px-6 rounded-3xl text-xl transition-all shadow-2xl min-h-[160px]">
            {loading ? <><Loader className="w-8 h-8 animate-spin mx-auto mb-2" /> Entering...</> : 'Enter Reassignment Queue'}
          </button>
        </div>
      </div>
    </div>
  );
}