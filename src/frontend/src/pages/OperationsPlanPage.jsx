import React from 'react';
import { ClipboardList } from 'lucide-react';

export default function OperationsPlanPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
      <ClipboardList size={40} color="var(--accent)" style={{ marginBottom: '16px' }} />
      <h2>72-Hour Operations Plan</h2>
      <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
        AI-generated structured operations plan across four time windows (0-12H, 12-24H, 24-48H, 48-72H).
        <br />
        Available after <strong style={{ color: 'var(--accent)' }}>Phase 7</strong>.
      </p>
    </div>
  );
}
