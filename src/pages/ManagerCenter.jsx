import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { Users, Calendar, ArrowRight, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Loader, Info } from 'lucide-react';

export function ManagerCenter() {
  const [queue, setQueue] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedIC, setSelectedIC] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const queueSubscription = supabase
      .channel('queue-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_entries' },
        () => fetchQueue()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchQueue()
      )
      .subscribe();

    const slotSubscription = supabase
      .channel('slots-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bps_slots' },
        () => fetchSlots()
      )
      .subscribe();

    fetchQueue();
    fetchSlots();

    return () => {
      queueSubscription.unsubscribe();
      slotSubscription.unsubscribe();
    };
  }, []);

  const fetchQueue = async () => {
    try {
      const { data: queueData, error } = await supabase
        .from('queue_entries')
        .select(`
          id,
          ic_id,
          entered_at,
          profiles:ic_id (
            id,
            email,
            tier_rank,
            current_status
          )
        `)
        .order('entered_at', { ascending: true });

      if (error) throw error;

      const enrichedQueue = queueData.map(entry => ({
        id: entry.id,
        ic_id: entry.ic_id,
        entered_at: entry.entered_at,
        email: entry.profiles?.email || 'Unknown',
        tier_rank: entry.profiles?.tier_rank || 3,
      }));

      enrichedQueue.sort((a, b) => {
        if (a.tier_rank !== b.tier_rank) {
          return a.tier_rank - b.tier_rank;
        }
        return new Date(a.entered_at) - new Date(b.entered_at);
      });

      setQueue(enrichedQueue);
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  };

  const fetchSlots = async () => {
    try {
      const { data, error } = await supabase
        .from('bps_slots')
        .select('*')
        .eq('status', 'OPEN')
        .order('start_time');

      if (error) throw error;
      setSlots(data || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedIC || !selectedSlot) return;

    setAssigning(true);
    setMessage('');

    try {
      await supabase
        .from('bps_slots')
        .update({
          status: 'ASSIGNED',
          assigned_ic_id: selectedIC.ic_id,
        })
        .eq('id', selectedSlot.id);

      await supabase
        .from('queue_entries')
        .delete()
        .eq('id', selectedIC.id);

      await supabase
        .from('profiles')
        .update({ current_status: 'BUSY' })
        .eq('id', selectedIC.ic_id);

      setMessage(
        `Assigned ${selectedIC.email} to patient ${selectedSlot.patient_identifier}`
      );

      setSelectedIC(null);
      setSelectedSlot(null);

      await fetchQueue();
      await fetchSlots();

      setTimeout(() => setMessage(''), 4000);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setAssigning(false);
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 1:
        return 'bg-green-100 text-green-700 border-green-300';
      case 2:
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 3:
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getWaitTime = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Manager Mode Instructions</h3>
            <p className="text-sm text-blue-800">Select IC from the queue and an open slot, then click "Confirm Dispatch" to assign. Queue is sorted by tier rank (1 is best) and then by wait time.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 text-charlie-teal mb-2">
              <Users className="w-5 h-5" />
              <span className="font-semibold text-sm">ICs in Queue</span>
            </div>
            <p className="text-4xl font-bold text-gray-900">{queue.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 text-charlie-teal mb-2">
              <Calendar className="w-5 h-5" />
              <span className="font-semibold text-sm">Open Slots</span>
            </div>
            <p className="text-4xl font-bold text-gray-900">{slots.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 text-green-600 mb-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold text-sm">Ready to Assign</span>
            </div>
            <p className="text-4xl font-bold text-gray-900">
              {selectedIC && selectedSlot ? '1' : '0'}
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 flex gap-3 p-4 rounded-xl ${
              message.includes('Error')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            {message.includes('Error') ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="bg-charlie-teal text-white p-5 flex items-center gap-3">
              <Users className="w-5 h-5" />
              <h3 className="font-semibold">Waiting Queue</h3>
            </div>

            <div className="p-5 max-h-[600px] overflow-y-auto">
              {queue.length === 0 ? (
                <p className="text-gray-500 text-center py-12">No ICs in queue</p>
              ) : (
                <div className="space-y-3">
                  {queue.map((ic) => (
                    <button
                      key={ic.id}
                      onClick={() => setSelectedIC(ic)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedIC?.id === ic.id
                          ? 'border-charlie-teal bg-charlie-mint-light shadow-md'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:shadow'
                      }`}
                    >
                      <p className="font-semibold text-gray-900 text-sm mb-2">
                        {ic.email}
                      </p>
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getTierColor(
                            ic.tier_rank
                          )}`}
                        >
                          Tier {ic.tier_rank}
                        </span>
                        <span className="text-xs text-gray-600 font-medium">
                          {getWaitTime(ic.entered_at)} wait
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="bg-charlie-teal text-white p-5 flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              <h3 className="font-semibold">Open BPS Slots</h3>
            </div>

            <div className="p-5 max-h-[600px] overflow-y-auto">
              {slots.length === 0 ? (
                <p className="text-gray-500 text-center py-12">
                  No open slots available
                </p>
              ) : (
                <div className="space-y-3">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedSlot?.id === slot.id
                          ? 'border-charlie-teal bg-charlie-mint-light shadow-md'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:shadow'
                      }`}
                    >
                      <p className="font-semibold text-gray-900 text-sm mb-1">
                        {slot.patient_identifier}
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(slot.start_time).toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between h-fit">
            <div>
              <h3 className="font-semibold text-gray-900 mb-6 text-lg">Assignment Preview</h3>

              <div className="space-y-4 mb-8">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-2 font-medium">Selected IC</p>
                  {selectedIC ? (
                    <>
                      <p className="font-semibold text-gray-900 mb-1">
                        {selectedIC.email}
                      </p>
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${getTierColor(
                          selectedIC.tier_rank
                        )}`}
                      >
                        Tier {selectedIC.tier_rank}
                      </span>
                    </>
                  ) : (
                    <p className="text-gray-500 italic">No IC selected</p>
                  )}
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-2 font-medium">Selected Slot</p>
                  {selectedSlot ? (
                    <>
                      <p className="font-semibold text-gray-900 mb-1">
                        {selectedSlot.patient_identifier}
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(selectedSlot.start_time).toLocaleString()}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500 italic">No slot selected</p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleAssign}
              disabled={!selectedIC || !selectedSlot || assigning}
              className="w-full bg-charlie-teal hover:bg-charlie-teal-dark disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg"
            >
              {assigning ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirm Dispatch
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
