import { useState, useEffect } from 'react';
import { Users, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TIME_INTERVALS = [
  { val: '07:00', label: '07:00 AM MT' },
  { val: '07:30', label: '07:30 AM MT' },
  { val: '08:00', label: '08:00 AM MT' },
  { val: '08:30', label: '08:30 AM MT' },
  { val: '09:00', label: '09:00 AM MT' },
  { val: '09:30', label: '09:30 AM MT' },
  { val: '10:00', label: '10:00 AM MT' },
  { val: '10:30', label: '10:30 AM MT' },
  { val: '11:00', label: '11:00 AM MT' },
  { val: '11:30', label: '11:30 AM MT' },
  { val: '12:00', label: '12:00 PM MT' },
  { val: '12:30', label: '12:30 PM MT' },
  { val: '13:00', label: '01:00 PM MT' },
  { val: '13:30', label: '01:30 PM MT' },
  { val: '14:00', label: '02:00 PM MT' },
  { val: '14:30', label: '02:30 PM MT' },
  { val: '15:00', label: '03:00 PM MT' },
  { val: '15:30', label: '03:30 PM MT' },
  { val: '16:00', label: '04:00 PM MT' },
  { val: '16:30', label: '04:30 PM MT' },
  { val: '17:00', label: '05:00 PM MT' }
];

/**
 * TeamScheduleInput Component
 *
 * Allows managers to input their team's BPS appointment counts per time interval.
 * Saves to manager_schedules table for admin aggregation.
 *
 * Critical UX: Number inputs allow empty strings so users can delete without snapping to 0.
 *
 * @param {Object} props
 * @param {string} props.userEmail - Manager's email for saving
 */
export function TeamScheduleInput({ userEmail }) {
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamSchedule, setTeamSchedule] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    loadMySchedule();
  }, [scheduleDate, userEmail]);

  /**
   * Loads the manager's schedule for the selected date
   */
  const loadMySchedule = async () => {
    if (!userEmail) return;

    const { data } = await supabase
      .from('manager_schedules')
      .select('schedule_data')
      .eq('manager_email', userEmail)
      .eq('schedule_date', scheduleDate)
      .maybeSingle();

    setTeamSchedule(data?.schedule_data || {});
  };

  /**
   * Handles schedule input changes
   *
   * Critical: Allows empty strings to enable user deletion without snapping back to 0
   */
  const handleScheduleChange = (timeVal, attendeesStr) => {
    setTeamSchedule(prev => ({
      ...prev,
      [timeVal]: parseInt(attendeesStr) || 0
    }));
  };

  /**
   * Saves the manager's schedule to the database
   */
  const saveMySchedule = async () => {
    setSavingSchedule(true);

    await supabase.from('manager_schedules').upsert(
      {
        manager_email: userEmail,
        schedule_date: scheduleDate,
        schedule_data: teamSchedule,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'manager_email, schedule_date' }
    );

    setSavingSchedule(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-3xl mx-auto w-full">
      <div className="flex justify-between items-end mb-8 border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-2xl font-black text-[#0F172A] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#5E4791]" /> My Team Schedule
          </h2>
          <p className="text-gray-500 font-medium mt-1">
            Input the total BPS appointments your team has per interval.
          </p>
        </div>
        <div className="text-right">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Target Date
          </label>
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="px-4 py-2 border-2 border-gray-200 rounded-xl font-black text-[#0F172A] focus:ring-2 focus:ring-[#5E4791] outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex font-black text-[10px] text-gray-400 uppercase tracking-widest px-4 pb-2 border-b border-gray-200">
          <div className="flex-1">Time Interval (MT)</div>
          <div className="w-32 text-center">Team BPS Count</div>
        </div>

        {TIME_INTERVALS.map(int => (
          <div
            key={int.val}
            className="flex items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-200"
          >
            <div className="flex-1 font-bold text-gray-700 text-lg">{int.label}</div>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={teamSchedule[int.val] || ''}
              onChange={(e) => handleScheduleChange(int.val, e.target.value)}
              className="w-24 px-3 py-2 border-2 border-gray-200 rounded-xl text-center font-black text-xl text-[#5E4791] focus:border-[#5E4791] outline-none transition-colors"
            />
          </div>
        ))}
      </div>

      <button
        onClick={saveMySchedule}
        disabled={savingSchedule}
        className="w-full mt-8 bg-[#0F172A] text-white font-black py-4 rounded-xl shadow-lg hover:bg-gray-800 transition-all flex justify-center items-center gap-2 text-lg"
      >
        {savingSchedule ? <Loader className="w-6 h-6 animate-spin" /> : 'Save Team Schedule'}
      </button>
    </div>
  );
}
