import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TIME_INTERVALS = [
  { bps_mt: '07:00 AM', of_mt: '07:15 AM', of_ct: '08:15 AM', val: '07:00', of_val: '07:15' },
  { bps_mt: '07:30 AM', of_mt: '07:45 AM', of_ct: '08:45 AM', val: '07:30', of_val: '07:45' },
  { bps_mt: '08:00 AM', of_mt: '08:15 AM', of_ct: '09:15 AM', val: '08:00', of_val: '08:15' },
  { bps_mt: '08:30 AM', of_mt: '08:45 AM', of_ct: '09:45 AM', val: '08:30', of_val: '08:45' },
  { bps_mt: '09:00 AM', of_mt: '09:15 AM', of_ct: '10:15 AM', val: '09:00', of_val: '09:15' },
  { bps_mt: '09:30 AM', of_mt: '09:45 AM', of_ct: '10:45 AM', val: '09:30', of_val: '09:45' },
  { bps_mt: '10:00 AM', of_mt: '10:15 AM', of_ct: '11:15 AM', val: '10:00', of_val: '10:15' },
  { bps_mt: '10:30 AM', of_mt: '10:45 AM', of_ct: '11:45 AM', val: '10:30', of_val: '10:45' },
  { bps_mt: '11:00 AM', of_mt: '11:15 AM', of_ct: '12:15 PM', val: '11:00', of_val: '11:15' },
  { bps_mt: '11:30 AM', of_mt: '11:45 AM', of_ct: '12:45 PM', val: '11:30', of_val: '11:45' },
  { bps_mt: '12:00 PM', of_mt: '12:15 PM', of_ct: '01:15 PM', val: '12:00', of_val: '12:15' },
  { bps_mt: '12:30 PM', of_mt: '12:45 PM', of_ct: '01:45 PM', val: '12:30', of_val: '12:45' },
  { bps_mt: '01:00 PM', of_mt: '01:15 PM', of_ct: '02:15 PM', val: '13:00', of_val: '13:15' },
  { bps_mt: '01:30 PM', of_mt: '01:45 PM', of_ct: '02:45 PM', val: '13:30', of_val: '13:45' },
  { bps_mt: '02:00 PM', of_mt: '02:15 PM', of_ct: '03:15 PM', val: '14:00', of_val: '14:15' },
  { bps_mt: '02:30 PM', of_mt: '02:45 PM', of_ct: '03:45 PM', val: '14:30', of_val: '14:45' },
  { bps_mt: '03:00 PM', of_mt: '03:15 PM', of_ct: '04:15 PM', val: '15:00', of_val: '15:15' },
  { bps_mt: '03:30 PM', of_mt: '03:45 PM', of_ct: '04:45 PM', val: '15:30', of_val: '15:45' },
  { bps_mt: '04:00 PM', of_mt: '04:15 PM', of_ct: '05:15 PM', val: '16:00', of_val: '16:15' },
  { bps_mt: '04:30 PM', of_mt: '04:45 PM', of_ct: '05:45 PM', val: '16:30', of_val: '16:45' },
  { bps_mt: '05:00 PM', of_mt: '05:15 PM', of_ct: '06:15 PM', val: '17:00', of_val: '17:15' },
];

/**
 * useCapacityPlanner Hook
 *
 * Manages the consolidated capacity planning spreadsheet for Admins.
 * Aggregates manager schedules and allows admin to override/publish final slot counts.
 *
 * Critical Features:
 * - Fetches manager_schedules for selected date and sums up BPS appointments per interval
 * - Loads/saves daily_capacity_plans with percentage calculation and manager assignments
 * - Publishes final plan as bps_slots with proper OF time offset (+15 minutes from BPS time)
 *
 * @param {string} selectedDate - The date to load/plan for (YYYY-MM-DD)
 * @returns {Object} Capacity planning data and actions
 */
export function useCapacityPlanner(selectedDate) {
  const [managerSchedules, setManagerSchedules] = useState([]);
  const [consolidatedTotals, setConsolidatedTotals] = useState({});
  const [planData, setPlanData] = useState({});
  const [calcPercentage, setCalcPercentage] = useState(30);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);

  /**
   * Loads daily capacity data for the selected date
   *
   * Steps:
   * 1. Fetch all manager schedules for this date
   * 2. Sum up BPS appointments per time interval
   * 3. Load existing admin plan if available, or initialize empty structure
   */
  const loadDailyData = async (dateStr) => {
    // Fetch manager schedules for this date
    const { data: schedules } = await supabase
      .from('manager_schedules')
      .select('*')
      .eq('schedule_date', dateStr);

    const schedArray = schedules || [];
    setManagerSchedules(schedArray);

    // Sum up totals across all managers
    const totals = {};
    TIME_INTERVALS.forEach(int => {
      let sum = 0;
      schedArray.forEach(sched => {
        sum += parseInt(sched.schedule_data?.[int.val]) || 0;
      });
      totals[int.val] = sum;
    });
    setConsolidatedTotals(totals);

    // Fetch existing admin plan
    const { data: plan } = await supabase
      .from('daily_capacity_plans')
      .select('plan_data')
      .eq('plan_date', dateStr)
      .maybeSingle();

    let loadedIntervals = {};
    let loadedCalc = 30;

    if (plan && plan.plan_data) {
      if (plan.plan_data.hasOwnProperty('calcPercentage')) {
        loadedCalc = plan.plan_data.calcPercentage;
        loadedIntervals = plan.plan_data.intervals;
      } else {
        loadedIntervals = plan.plan_data;
      }
    } else {
      // Initialize empty structure
      TIME_INTERVALS.forEach(int => {
        loadedIntervals[int.val] = { override: '', assignments: [] };
      });
    }

    setCalcPercentage(loadedCalc);
    setPlanData(loadedIntervals);
  };

  useEffect(() => {
    if (selectedDate) {
      loadDailyData(selectedDate);
    }
  }, [selectedDate]);

  /**
   * Calculates suggested overflow slot count based on percentage
   *
   * Formula: If BPS count > 12, return ceil(count * percentage / 100), else 0
   */
  const getSuggestedCount = (timeVal, pct) => {
    const num = consolidatedTotals[timeVal] || 0;
    return num <= 12 ? 0 : Math.ceil(num * (pct / 100));
  };

  /**
   * Updates a field in the plan data for a specific time interval
   */
  const updateInterval = (timeVal, field, value) => {
    setPlanData(prev => ({
      ...prev,
      [timeVal]: { ...prev[timeVal], [field]: value }
    }));
  };

  /**
   * Adds a new manager assignment row to a time interval
   */
  const addManager = (timeVal) => {
    setPlanData(prev => {
      const updated = { ...prev };
      updated[timeVal] = updated[timeVal] || { override: '', assignments: [] };
      updated[timeVal].assignments.push({ email: '', count: 1 });
      return updated;
    });
  };

  /**
   * Updates a manager assignment field (email or count)
   */
  const updateManager = (timeVal, idx, field, value) => {
    setPlanData(prev => {
      const updated = { ...prev };
      updated[timeVal].assignments[idx][field] = field === 'count' ? parseInt(value) : value;
      return updated;
    });
  };

  /**
   * Removes a manager assignment row from a time interval
   */
  const removeManager = (timeVal, idx) => {
    setPlanData(prev => {
      const updated = { ...prev };
      updated[timeVal].assignments.splice(idx, 1);
      return updated;
    });
  };

  /**
   * Publishes the capacity plan to bps_slots table
   *
   * Critical: Uses OF time (+15 minutes from BPS time) for slot start_time
   * Generates unique patient_identifier for each slot
   */
  const handlePublishPlan = async () => {
    setPublishing(true);
    setPublishMessage(null);

    // Save the plan
    await supabase.from('daily_capacity_plans').upsert(
      {
        plan_date: selectedDate,
        plan_data: { calcPercentage, intervals: planData }
      },
      { onConflict: 'plan_date' }
    );

    // Generate slots
    const slotsToInsert = [];
    Object.entries(planData).forEach(([timeVal, row]) => {
      const interval = TIME_INTERVALS.find(t => t.val === timeVal);
      if (!interval) return;

      row.assignments.forEach(assign => {
        if (assign.email && assign.count > 0) {
          for (let i = 0; i < assign.count; i++) {
            const exactSlotTime = new Date(`${selectedDate}T${interval.of_val}:00`);
            slotsToInsert.push({
              patient_identifier: `OF-${interval.of_val}-${assign.email.split('@')[0].toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
              start_time: exactSlotTime.toISOString(),
              host_manager: assign.email,
              status: 'OPEN'
            });
          }
        }
      });
    });

    if (slotsToInsert.length === 0) {
      setPublishMessage({ type: 'error', text: 'No slots to publish! Select managers and set slot counts first.' });
      setPublishing(false);
      return;
    }

    const { error: insertError } = await supabase.from('bps_slots').insert(slotsToInsert);
    if (insertError) {
      setPublishMessage({ type: 'error', text: `Failed to insert slots: ${insertError.message}` });
    } else {
      setPublishMessage({ type: 'success', text: `Success! Added ${slotsToInsert.length} slots to live dispatch.` });
    }

    setPublishing(false);
    setTimeout(() => setPublishMessage(null), 5000);
  };

  return {
    TIME_INTERVALS,
    managerSchedules,
    consolidatedTotals,
    planData,
    calcPercentage,
    setCalcPercentage,
    publishing,
    publishMessage,
    getSuggestedCount,
    updateInterval,
    addManager,
    updateManager,
    removeManager,
    handlePublishPlan,
    loadDailyData
  };
}
