import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiskBadge from '../components/common/RiskBadge';

describe('RiskBadge', () => {
  it('renders LOW level', () => {
    render(<RiskBadge level="LOW" />);
    expect(screen.getByText('LOW')).toBeTruthy();
  });

  it('renders HIGH level', () => {
    render(<RiskBadge level="HIGH" />);
    expect(screen.getByText('HIGH')).toBeTruthy();
  });

  it('renders CRITICAL level', () => {
    render(<RiskBadge level="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeTruthy();
  });

  it('renders UNKNOWN for invalid level', () => {
    render(<RiskBadge level="INVALID" />);
    expect(screen.getByText('UNKNOWN')).toBeTruthy();
  });
});
