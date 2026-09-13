import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPICard from '../components/common/KPICard';

describe('KPICard', () => {
  it('renders the title', () => {
    render(<KPICard title="Total Vessels" value={42} />);
    expect(screen.getByText('Total Vessels')).toBeTruthy();
  });

  it('renders the value', () => {
    render(<KPICard title="Total Vessels" value={42} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<KPICard title="Utilization" value="78%" subtitle="Last 24h" />);
    expect(screen.getByText('Last 24h')).toBeTruthy();
  });

  it('does not render subtitle section when subtitle is omitted and trend is undefined', () => {
    render(<KPICard title="Alerts" value={5} />);
    // Footer section should not be present (no subtitle, no trend)
    expect(screen.queryByText('Last 24h')).toBeFalsy();
  });

  it('renders em-dash when value is null', () => {
    render(<KPICard title="Score" value={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders em-dash when value is undefined', () => {
    render(<KPICard title="Score" />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders positive trend as percentage with + prefix', () => {
    render(<KPICard title="Vessels" value={10} trend={5} />);
    expect(screen.getByText('+5%')).toBeTruthy();
  });

  it('renders negative trend as percentage with - prefix', () => {
    render(<KPICard title="Vessels" value={10} trend={-3} />);
    expect(screen.getByText('-3%')).toBeTruthy();
  });

  it('renders Stable for zero trend', () => {
    render(<KPICard title="Vessels" value={10} trend={0} />);
    expect(screen.getByText('Stable')).toBeTruthy();
  });

  it('renders string value correctly', () => {
    render(<KPICard title="Level" value="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeTruthy();
  });
});
