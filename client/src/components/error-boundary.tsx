import { Component, ErrorInfo, ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section role="alert" aria-live="polite" className="rounded-lg border border-border bg-black/20 p-4">
          <h2 className="text-base font-semibold">Something went wrong.</h2>
          <p className="mt-1 text-sm text-slate-300">Try refreshing, or open Favorites to continue offline.</p>
        </section>
      );
    }

    return this.props.children;
  }
}

