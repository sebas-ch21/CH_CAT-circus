import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    supabase.rpc('cleanup_stale_data').catch(() => {});

    const profileMap = {};
    try {
      const { data: allProfiles } = await supabase.from('profiles').select('*');
      if (allProfiles) {
        allProfiles.forEach(p => { profileMap[p.id] = p; });
      }
    } catch (_) {}

    try {
      const { data: oSlots } = await supabase
        .from('bps_slots')
        .select('*')
        .eq('status', 'OPEN')
        .order('start_time');
      if (oSlots) setOpenSlots(oSlots);
    } catch (_) {}

    try {
      const { data: sSlots } = await supabase
        .from('bps_slots')
        .select('*')
        .in('status', ['ASSIGNED', 'CONFIRMED'])
        .order('start_time');
      if (sSlots) {
        setScheduledSlots(sSlots.map(slot => ({
          ...slot,
          ic_email: profileMap[slot.assigned_ic_id]?.email || 'Unknown Staff',
          profiles: profileMap[slot.assigned_ic_id] || { email: 'Unknown', tier_rank: 3 }
        })));
      }
    } catch (_) {}

    try {
      const { data: qData } = await supabase
        .from('queue_entries')
        .select('*')
        .order('entered_at');
      if (qData) {
        const enrichedQueue = qData.map(q => ({
          ...q,
          profiles: profileMap[q.ic_id] || { email: 'Unknown', tier_rank: 3, current_status: 'IN_QUEUE' }
        }));
        setQueue(
          enrichedQueue.sort(
            (a, b) => (a.profiles.tier_rank || 3) - (b.profiles.tier_rank || 3)
              || new Date(a.entered_at) - new Date(b.entered_at)
          )
        );
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}
