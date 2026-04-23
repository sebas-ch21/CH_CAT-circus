import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);

  const fetchData = useCallback(async () => {
    supabase.rpc('cleanup_stale_data').then(({ error: cleanupError }) => {
      if (cleanupError) console.error('[Supabase Error]:', cleanupError);
    });

    // 2. Fetch independent tables to avoid RLS relational query crashes
    const [
      { data: profiles, error: pError },
      { data: slots, error: sError },
      { data: qEntries, error: qError }
    ] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('bps_slots').select('*').order('start_time'),
      supabase.from('queue_entries').select('*').order('entered_at')
    ]);

    // 3. Surface all errors explicitly
    if (pError) { console.error('[Supabase Error]:', pError); toast.error(pError.message); }
    if (sError) { console.error('[Supabase Error]:', sError); toast.error(sError.message); }
    if (qError) { console.error('[Supabase Error]:', qError); toast.error(qError.message); }

    // 4. In-Memory Join using Javascript Maps
    const profileMap = {};
    if (profiles) {
      profiles.forEach(p => { profileMap[p.id] = p; });
    }

    if (slots) {
      const open = [];
      const sched = [];
      slots.forEach(slot => {
        if (slot.status === 'OPEN') {
          open.push(slot);
        } else if (slot.status === 'ASSIGNED' || slot.status === 'CONFIRMED') {
          // Null Safety mapping
          const mappedProfile = profileMap[slot.assigned_ic_id] || { email: 'Unknown', tier_rank: 3 };
          sched.push({
            ...slot,
            ic_email: mappedProfile.email || 'Unknown Staff',
            profiles: mappedProfile
          });
        }
      });
      setOpenSlots(open);
      setScheduledSlots(sched);
    }

    if (qEntries) {
      const queueWithProfiles = qEntries.map(q => {
        const mappedProfile = profileMap[q.ic_id] || { email: 'Unknown', tier_rank: 3 };
        return { ...q, profiles: mappedProfile };
      });
      
      const sortedQueue = queueWithProfiles.sort((a, b) => {
        const tierA = a.profiles?.tier_rank || 3;
        const tierB = b.profiles?.tier_rank || 3;
        if (tierA !== tierB) return tierA - tierB;
        return new Date(a.entered_at) - new Date(b.entered_at);
      });
      
      setQueue(sortedQueue);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount
    fetchData();

    // Set up Realtime subscriptions instead of polling
    const channel = supabase.channel('dispatch_data_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bps_slots' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchData();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}