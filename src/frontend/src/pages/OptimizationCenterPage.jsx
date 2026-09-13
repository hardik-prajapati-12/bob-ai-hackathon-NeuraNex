import React from 'react';
import { Settings2 } from 'lucide-react';

export default function OptimizationCenterPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
      <Settings2 size={40} color="var(--accent)" style={{ marginBottom: '16px' }} />
      <h2>Optimization Center</h2>
      <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
        Current vs AI-recommended berth and crane assignments with conflict detection.
        <br />
        Available after <strong style={{ color: 'var(--accent)' }}>Phase 6</strong>.
      </p>
    </div>
  );
}
