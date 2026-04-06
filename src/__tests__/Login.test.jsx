import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Login } from '../pages/Login';
import { AuthContext } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

const mockLoginWithMagicLink = vi.fn().mockResolvedValue();
const mockLoginWithPin = vi.fn().mockResolvedValue();

const renderLogin = () => render(
  <BrowserRouter>
    <AuthContext.Provider value={{ 
      loginWithMagicLink: mockLoginWithMagicLink, 
      loginWithPin: mockLoginWithPin, 
      loading: false 
    }}>
      <Login />
    </AuthContext.Provider>
  </BrowserRouter>
);

describe('Login Page Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders Magic Link form by default', () => {
    renderLogin();
    expect(screen.getByText(/Send Magic Link/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Enter PIN/i)).not.toBeInTheDocument();
  });

  it('2. Toggles to PIN login mode when clicked', async () => {
    renderLogin();
    const toggleButton = screen.getByText(/Test User\? Login with PIN/i);
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter PIN/i)).toBeInTheDocument();
      expect(screen.getByText(/Login with PIN/i)).toBeInTheDocument();
    });
  });

  it('3. Submits Magic Link flow correctly', async () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText(/name@clinic.com/i);
    const submitButton = screen.getByText(/Send Magic Link/i);

    fireEvent.change(emailInput, { target: { value: 'test@clinic.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLoginWithMagicLink).toHaveBeenCalledWith('test@clinic.com');
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument();
    });
  });
});