import { Component } from 'react';
import { CircleAlert as AlertCircle } from 'lucide-react';

/**
 * ErrorBoundary Component
 *
 * Catches React errors in child components to prevent total app crashes.
 * Displays a user-friendly fallback UI when an error occurs.
 *
 * @class ErrorBoundary
 * @extends {Component}
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ch-paper min-h-[100dvh] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-[#EDE7DE] p-8 max-w-md w-full text-center ch-rise" style={{ boxShadow: '0 2px 8px rgba(18, 20, 42, 0.04)' }}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FDEBEC] text-[#9F2F2D] mx-auto mb-5">
              <AlertCircle className="w-7 h-7" strokeWidth={1.8} />
            </div>
            <h1 className="font-display text-3xl text-[#12142A] mb-2 tracking-tight">Something went wrong</h1>
            <p className="text-[#58534C] font-medium mb-6 leading-relaxed">
              An unexpected error occurred. Refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#12142A] text-[#FAF8F5] font-semibold py-3.5 rounded-xl hover:bg-[#011537] transition-colors ch-focus-ring"
            >
              Reload application
            </button>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-[10px] font-semibold text-[#A29A8E] uppercase tracking-micro cursor-pointer hover:text-[#58534C]">
                  Error details
                </summary>
                <pre className="mt-3 p-3 bg-[#FAF8F5] rounded-lg text-xs text-[#9F2F2D] overflow-auto border border-[#EDE7DE] font-mono">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
