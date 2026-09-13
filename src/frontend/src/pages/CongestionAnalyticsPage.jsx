import React from 'react';
import { TrendingUp } from 'lucide-react';

export default function CongestionAnalyticsPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
      <TrendingUp size={40} color="var(--accent)" style={{ marginBottom: '16px' }} />
      <h2>Congestion Analytics</h2>
      <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
        Congestion predictions, contributing factors, root-cause AI explanations, and historical trends.
        <br />
        Available after <strong style={{ color: 'var(--accent)' }}>Phase 5</strong>.
      </p>
    </div>
  );
}
