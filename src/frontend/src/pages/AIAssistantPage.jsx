import React from 'react';
import { Bot } from 'lucide-react';

export default function AIAssistantPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
      <Bot size={40} color="var(--accent)" style={{ marginBottom: '16px' }} />
      <h2>AI Operations Copilot</h2>
      <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
        Ask natural-language questions about port operations. Powered by IBM watsonx.ai,
        grounded in live operational data.
        <br />
        Available after <strong style={{ color: 'var(--accent)' }}>Phase 7</strong>.
      </p>
    </div>
  );
}
