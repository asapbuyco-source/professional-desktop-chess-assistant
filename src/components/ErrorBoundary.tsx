import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState(prevState => ({
      ...prevState,
      errorInfo,
    }));
    // You can also log the error to an error reporting service here
    console.error('Caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#07070d] flex items-center justify-center p-4">
          <div className="glass-panel rounded-xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-white mb-2">Oops! Something went wrong</h1>
              <p className="text-white/60 text-sm mb-4">
                The application encountered an unexpected error. Please try refreshing the page.
              </p>
              {this.state.error && (
                <details className="mt-6 p-3 bg-[#0a0c14] rounded text-left text-xs text-white/50 font-mono overflow-auto max-h-40">
                  <summary className="cursor-pointer font-semibold text-white/70 mb-2">Error Details</summary>
                  <p className="mb-2">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="text-[10px] overflow-x-auto">{this.state.errorInfo.componentStack}</pre>
                  )}
                </details>
              )}
              <button
                onClick={() => window.location.reload()}
                className="mt-6 px-4 py-2 bg-[#00ff88] text-black rounded-lg font-semibold hover:bg-[#00ff88]/90 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
