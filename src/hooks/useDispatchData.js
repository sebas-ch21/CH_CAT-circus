import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    // 1. Trigger cleanup quietly
    supabase.rpc('cleanup_stale_data').catch(() => {});

    // 2. Fetch OPEN slots
    try {
      const { data: oSlots, error: oError } = await supabase
        .from('bps_slots')
        .select('*')
        .eq('status', 'OPEN')
        .order('start_time');
        
      if (oError) console.error("Error fetching open slots:", oError);
      else if (oSlots) setOpenSlots(oSlots);
    } catch (err) {
      console.error("Caught error fetching open slots:", err);
    }

    // 3. Fetch Scheduled slots with relational profile data directly from DB
    try {
      const { data: sSlots, error: sError } = await supabase
        .from('bps_slots')
        .select('*, profiles(*)')
        .in('status', ['ASSIGNED', 'CONFIRMED'])
        .order('start_time');
        
      if (sError) console.error("Error fetching scheduled slots:", sError);
      else if (sSlots) {
        setScheduledSlots(sSlots.map(slot => ({
          ...slot,
          // Extract nested profile data or provide fallback
          ic_email: slot.profiles?.email || 'Unknown Staff',
          profiles: slot.profiles || { email: 'Unknown', tier_rank: 3 }
        })));
      }
    } catch (err) {
      console.error("Caught error fetching scheduled slots:", err);
    }

    // 4. Fetch Queue entries with relational profile data directly from DB
    try {
      const { data: qData, error: qError } = await supabase
        .from('queue_entries')
        .select('*, profiles(*)')
        .order('entered_at');
        
      if (qError) console.error("Error fetching queue:", qError);
      else if (qData) {
        // Enforce the sort locally (Tier Rank then Time)
        const sortedQueue = qData.sort((a, b) => {
          const tierA = a.profiles?.tier_rank || 3;
          const tierB = b.profiles?.tier_rank || 3;
          
          if (tierA !== tierB) {
            return tierA - tierB;
          }
          return new Date(a.entered_at) - new Date(b.entered_at);
        });
        
        setQueue(sortedQueue);
      }
    } catch (err) {
      console.error("Caught error fetching queue:", err);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount
    fetchData();
    
    // Poll every 3 seconds
    intervalRef.current = setInterval(fetchData, 3000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}