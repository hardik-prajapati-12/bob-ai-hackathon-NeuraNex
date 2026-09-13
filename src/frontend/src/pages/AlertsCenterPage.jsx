import React from 'react';
import { Bell } from 'lucide-react';

export default function AlertsCenterPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
      <Bell size={40} color="var(--accent)" style={{ marginBottom: '16px' }} />
      <h2>Alerts Center</h2>
      <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
        Operational risk alerts with severity indicators and acknowledgement.
        <br />
        Available after <strong style={{ color: 'var(--accent)' }}>Phase 9</strong>.
      </p>
    </div>
  );
}
