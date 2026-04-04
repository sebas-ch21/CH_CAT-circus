import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ICDashboard } from '../pages/ICDashboard';
import { AuthProvider } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock database state
const mockState = {
  queueData: [],
  slotData: [],
  profileData: [{ id: '123', tier_rank: 3 }]
};

// Mock the Supabase client so we don't hit the real database during tests
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
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      })),
    }
  };
});

// Mock a logged-in IC User
const mockUser = { id: '123', email: 'ic1@clinic.com', role: 'IC' };

describe('IC Dashboard Automated Tests', () => {
  
  // Wrap the component in the required Providers
  const renderDashboard = () => render(
    <BrowserRouter>
      <AuthProvider value={{ user: mockUser }}>
        <ICDashboard />
      </AuthProvider>
    </BrowserRouter>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.queueData = [];
    mockState.slotData = [];
  });

  it('renders the initial available state', async () => {
    renderDashboard();
    // Wait for the UI to load
    await waitFor(() => {
      expect(screen.getByText(/Enter Reassignment Queue/i)).toBeInTheDocument();
    });
  });

  it('enter queue button is clickable', async () => {
    renderDashboard();

    // Find the enter queue button
    const enterButton = await screen.findByText(/Enter Reassignment Queue/i);
    expect(enterButton).toBeInTheDocument();

    // Verify button is not disabled
    expect(enterButton).not.toBeDisabled();

    // Click should not throw error
    fireEvent.click(enterButton);
  });

  it('renders available when not in queue', async () => {
    mockState.queueData = [];
    renderDashboard();

    // Should show the enter queue button
    await waitFor(() => {
      expect(screen.getByText(/Enter Reassignment Queue/i)).toBeInTheDocument();
    });
  });
});