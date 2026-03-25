import React from 'react';
import { base44 } from '@/api/base44Client';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  async componentDidCatch(error, info) {
    // Log to ErrorLog entity
    try {
      const existing = await base44.entities.ErrorLog.filter({ error_message: error.message?.slice(0, 200) });
      if (existing.length > 0) {
        await base44.entities.ErrorLog.update(existing[0].id, {
          occurrence_count: (existing[0].occurrence_count || 1) + 1,
          severity: (existing[0].occurrence_count || 1) >= 3 ? 'critical' : 'medium',
        });
        // Alert on critical
        if ((existing[0].occurrence_count || 1) >= 2) {
          base44.integrations.Core.SendEmail({
            to: 'me@fleettollpro.com',
            subject: '🚨 Critical bug detected in FleetToll Pro',
            body: `Error: ${error.message}\n\nPage: ${window.location.pathname}\n\nOccurrences: ${(existing[0].occurrence_count || 1) + 1}`,
          }).catch(() => {});
        }
      } else {
        await base44.entities.ErrorLog.create({
          error_message: error.message?.slice(0, 500),
          error_stack: error.stack?.slice(0, 1000),
          page: window.location.pathname,
          occurrence_count: 1,
          severity: 'medium',
        });
      }
    } catch (e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center bg-background">
          <div>
            <span className="text-5xl">🔧</span>
            <h2 className="text-xl font-black mt-3 mb-1">We detected an issue</h2>
            <p className="text-sm text-muted-foreground mb-4">Our team has been notified and is working on a fix.</p>
            <button onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl font-bold text-sm">
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}