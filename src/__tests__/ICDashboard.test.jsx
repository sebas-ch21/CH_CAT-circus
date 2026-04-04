import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ICDashboard } from '../pages/ICDashboard';
import { AuthProvider } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock the Supabase client so we don't hit the real database during tests
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  }
}));

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
  });

  it('renders the initial available state', async () => {
    renderDashboard();
    // Wait for the UI to load
    await waitFor(() => {
      expect(screen.getByText(/Press Button to Enter Queue/i)).toBeInTheDocument();
    });
  });

  it('allows an IC to enter the queue optimistically', async () => {
    renderDashboard();
    
    // Find and click the enter queue button
    const enterButton = await screen.findByText(/Press Button to Enter Queue/i);
    fireEvent.click(enterButton);

    // Verify UI immediately updates to "Successfully Entered Queue"
    await waitFor(() => {
      expect(screen.getByText(/Successfully Entered Queue/i)).toBeInTheDocument();
    });
  });

  it('allows an IC to exit the queue', async () => {
    renderDashboard();
    
    // Force enter queue
    const enterButton = await screen.findByText(/Press Button to Enter Queue/i);
    fireEvent.click(enterButton);

    // Find and click exit queue
    const exitButton = await screen.findByText(/Exit Queue/i);
    fireEvent.click(exitButton);

    // Verify it goes back to the home screen
    await waitFor(() => {
      expect(screen.getByText(/Press Button to Enter Queue/i)).toBeInTheDocument();
    });
  });
});