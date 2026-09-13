import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  AlertTriangle,
  CheckCircle,
  Loader,
  ChevronRight,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import { sendChatMessage, getAiStatus } from '../api/ai';
import { useNavigate } from 'react-router-dom';
import styles from './AIAssistantPage.module.css';

// ─── Suggested questions ───────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What is the current congestion level across all terminals?',
  'Which vessels are at highest risk of delay right now?',
  'What berth reallocation actions would reduce waiting times?',
  'Are there any critical crane shortfalls I should address?',
  'Summarise the top 3 operational risks in the port today.',
  'What conflicts are currently detected in the scheduling system?',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AiStatusBadge({ status }) {
  if (!status) return null;
  const configured = status.configured;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        background: configured ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
        color: configured ? 'var(--risk-low)' : 'var(--risk-medium)',
        border: `1px solid ${configured ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
      }}
    >
      {configured ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
      {configured
        ? `watsonx connected · ${status.modelId || 'Granite'}`
        : 'Fallback mode — configure watsonx.ai'}
    </span>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div className={styles.messageBubbleUser}>
        <div className={styles.bubbleContent}>{msg.content}</div>
      </div>
    );
  }

  // AI message
  const { facts, actions, reasoning, answer, isFallback, dataLabel } = msg;
  const hasSections = facts || actions || reasoning;

  return (
    <div className={styles.messageBubbleAi}>
      <div className={styles.aiBubbleHeader}>
        <Bot size={15} color="var(--accent)" />
        <span>PortMind Copilot</span>
        {isFallback && (
          <span className={styles.fallbackBadge}>FALLBACK</span>
        )}
      </div>

      {hasSections ? (
        <div className={styles.aiBubbleSections}>
          {facts && (
            <div className={styles.aiSection}>
              <div className={styles.aiSectionLabel}>FACTS</div>
              <div className={styles.aiSectionBody}>{facts}</div>
            </div>
          )}
          {actions && (
            <div className={styles.aiSection}>
              <div className={styles.aiSectionLabel} style={{ color: 'var(--risk-low)' }}>ACTIONS</div>
              <div className={styles.aiSectionBody}>{actions}</div>
            </div>
          )}
          {reasoning && (
            <div className={styles.aiSection}>
              <div className={styles.aiSectionLabel} style={{ color: 'var(--text-muted)' }}>REASONING</div>
              <div className={styles.aiSectionBody}>{reasoning}</div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.aiBubbleBody}>{answer || msg.content}</div>
      )}

      {dataLabel && (
        <div className={styles.dataLabel}>{dataLabel}</div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className={styles.messageBubbleAi}>
      <div className={styles.aiBubbleHeader}>
        <Bot size={15} color="var(--accent)" />
        <span>PortMind Copilot</span>
      </div>
      <div className={styles.thinkingDots}>
        <span>Thinking</span>
        <span className={styles.dot}>.</span>
        <span className={styles.dot}>.</span>
        <span className={styles.dot}>.</span>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Load AI status on mount
  useEffect(() => {
    getAiStatus()
      .then((res) => setAiStatus(res.data))
      .catch(() => setAiStatus({ configured: false }));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: userText, id: Date.now() }]);
    setLoading(true);

    try {
      const res = await sendChatMessage(userText);
      const data = res.data;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          id: Date.now() + 1,
          content: data.answer || '',
          facts: data.facts || '',
          actions: data.actions || '',
          reasoning: data.reasoning || '',
          isFallback: data.isFallback,
          dataLabel: data.dataLabel || '',
        },
      ]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to get response from AI. Please try again.';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          id: Date.now() + 1,
          content: msg,
          isFallback: true,
          dataLabel: 'ERROR RESPONSE',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Bot size={22} color="var(--accent)" />
          <div>
            <h1 className={styles.title}>AI Operations Copilot</h1>
            <p className={styles.subtitle}>
              Ask natural-language questions about port operations. Grounded in live data.
            </p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <AiStatusBadge status={aiStatus} />
          <button
            className={styles.planButton}
            onClick={() => navigate('/operations-plan')}
          >
            <ClipboardList size={15} />
            Generate 72H Plan
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className={styles.chatArea}>
        {!hasMessages && (
          <div className={styles.emptyState}>
            <Bot size={48} color="var(--accent)" style={{ opacity: 0.4 }} />
            <h2 className={styles.emptyTitle}>How can I help with port operations?</h2>
            <p className={styles.emptySubtitle}>
              Ask about congestion, vessel allocation, crane deployment, or schedule conflicts.
              All responses are grounded in live operational data.
            </p>
            <div className={styles.suggestionsGrid}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className={styles.suggestionBtn}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                >
                  <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasMessages && (
          <div className={styles.messageList}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && <ThinkingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className={styles.inputBar}>
        {hasMessages && !loading && (
          <div className={styles.quickSuggestions}>
            {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
              <button
                key={i}
                className={styles.quickBtn}
                onClick={() => sendMessage(q)}
                disabled={loading}
              >
                {q.length > 40 ? q.slice(0, 40) + '…' : q}
              </button>
            ))}
          </div>
        )}
        <div className={styles.inputRow}>
          <textarea
            ref={inputRef}
            className={styles.textarea}
            placeholder="Ask about port operations…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
            maxLength={1000}
          />
          <button
            className={styles.sendButton}
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            title="Send message"
          >
            {loading ? <Loader size={17} className={styles.spin} /> : <Send size={17} />}
          </button>
        </div>
        <div className={styles.inputFooter}>
          AI responses are grounded in demo operational data · IBM watsonx.ai
        </div>
      </div>
    </div>
  );
}
