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
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-red-200 shadow-xl p-8 max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-[#0F172A] mb-2">Something Went Wrong</h1>
            <p className="text-gray-600 font-medium mb-6">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#0F172A] text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              Reload Application
            </button>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600">
                  Error Details
                </summary>
                <pre className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-red-600 overflow-auto border border-gray-200">
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
