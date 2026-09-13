import React from 'react';
import { Anchor } from 'lucide-react';

export default function PortOverviewPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
      <Anchor size={40} color="var(--accent)" style={{ marginBottom: '16px' }} />
      <h2>Port Overview</h2>
      <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
        Terminal utilization, berth status, crane availability, and operational visualization.
        <br />
        Available after <strong style={{ color: 'var(--accent)' }}>Phase 4</strong>.
      </p>
    </div>
  );
}
