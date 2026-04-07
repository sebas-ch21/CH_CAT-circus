import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      // 1. TRIGGER SERVER-SIDE CLEANUP
      // This instantly drops 5-min expired assignments and deletes 12-hour old midnight slots safely.
      await supabase.rpc('cleanup_stale_data').catch(err => console.error("Cleanup RPC Error:", err));

      // 2. FETCH ALL PROFILES (Bulletproof in-memory mapping to prevent Supabase JOIN errors)
      const { data: allProfiles } = await supabase.from('profiles').select('*');
      const profileMap = {};
      if (allProfiles) {
        allProfiles.forEach(p => { profileMap[p.id] = p; });
      }

      // 3. FETCH AND ENRICH QUEUE
      const { data: qData } = await supabase.from('queue_entries').select('*').order('entered_at');
      if (qData) {
        const enrichedQueue = qData.map(q => ({
          ...q,
          profiles: profileMap[q.ic_id] || {}
        }));
        
        // Strict State: Only show users who are legitimately waiting in the queue
        const activeQueue = enrichedQueue.filter(q => q.profiles.current_status === 'IN_QUEUE');
        setQueue(activeQueue.sort((a, b) => (a.profiles.tier_rank || 3) - (b.profiles.tier_rank || 3) || new Date(a.entered_at) - new Date(b.entered_at)));
      }

      // 4. FETCH OPEN SLOTS
      const { data: oSlots } = await supabase.from('bps_slots').select('*').eq('status', 'OPEN').order('start_time');
      if (oSlots) setOpenSlots(oSlots);

      // 5. FETCH SCHEDULED SLOTS
      const { data: sSlots } = await supabase.from('bps_slots').select('*').in('status', ['ASSIGNED', 'CONFIRMED']).order('start_time');
      if (sSlots) {
        const mappedSlots = sSlots.map(slot => ({
          ...slot,
          ic_email: profileMap[slot.assigned_ic_id]?.email || 'Unknown Staff',
          profiles: profileMap[slot.assigned_ic_id] || {} 
        }));
        setScheduledSlots(mappedSlots);
      }
    } catch (err) {
      console.error('Data Fetch Error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Smooth, read-only polling every 3 seconds. 
    // No destructive React logic runs here anymore.
    const interval = setInterval(() => { fetchData(); }, 3000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}