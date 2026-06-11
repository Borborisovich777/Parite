import { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;

  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#121418] text-slate-100 flex items-center justify-center px-5">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-[#1a1d23] p-5 text-center">
            <h1 className="text-lg font-bold font-display text-white">
              Something went wrong
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Parité hit a screen error. Reload the app and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full min-h-11 rounded-2xl bg-indigo-600 text-slate-950 text-sm font-bold cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
