import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ICDashboard } from '../pages/ICDashboard';
import { AuthContext } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

const mockState = {
  queueData: [],
  slotData: [],
  profileData: [{ id: '123', tier_rank: 3 }]
};

vi.mock('../lib/supabase', () => {
  const mockFrom = vi.fn((table) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      insert: vi.fn(async () => {
        mockState.queueData = [{ id: 'queue-1', ic_id: '123', entered_at: new Date().toISOString() }];
        return { error: null };
      }),
      delete: vi.fn(async () => {
        mockState.queueData = [];
        return { error: null };
      }),
      update: vi.fn(() => chain),
      then: vi.fn(async (resolve) => {
        if (table === 'queue_entries') {
          return resolve({ data: mockState.queueData, error: null });
        } else if (table === 'bps_slots') {
          return resolve({ data: mockState.slotData, error: null });
        } else if (table === 'profiles') {
          return resolve({ data: mockState.profileData, error: null });
        }
        return resolve({ data: [], error: null });
      })
    };
    return chain;
  });

  return {
    supabase: {
      from: mockFrom,
      channel: vi.fn(() => {
        const ch = {
          on: vi.fn(() => ch),
          subscribe: vi.fn(() => ch),
          unsubscribe: vi.fn(),
        };
        return ch;
      }),
    }
  };
});

const mockUser = { id: '123', email: 'ic1@clinic.com', role: 'IC' };

describe('IC Dashboard Automated Tests', () => {

  const renderDashboard = () => render(
    <BrowserRouter>
      <AuthContext.Provider value={{ user: mockUser, logout: vi.fn() }}>
        <ICDashboard />
      </AuthContext.Provider>
    </BrowserRouter>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.queueData = [];
    mockState.slotData = [];
  });

  it('renders the initial available state', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Enter Reassignment Queue/i)).toBeInTheDocument();
    });
  });

  it('enter queue button is clickable', async () => {
    renderDashboard();
    const enterButton = await screen.findByText(/Enter Reassignment Queue/i);
    expect(enterButton).toBeInTheDocument();
    expect(enterButton).not.toBeDisabled();
    fireEvent.click(enterButton);
  });

  it('renders available when not in queue', async () => {
    mockState.queueData = [];
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Enter Reassignment Queue/i)).toBeInTheDocument();
    });
  });
});
