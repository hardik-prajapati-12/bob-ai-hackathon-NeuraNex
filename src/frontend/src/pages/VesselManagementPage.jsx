import React from 'react';
import { Ship } from 'lucide-react';

export default function VesselManagementPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
      <Ship size={40} color="var(--accent)" style={{ marginBottom: '16px' }} />
      <h2>Vessel Management</h2>
      <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
        Full vessel management — browse, search, filter, and inspect all vessels.
        <br />
        Available after <strong style={{ color: 'var(--accent)' }}>Phase 4</strong>.
      </p>
    </div>
  );
}
