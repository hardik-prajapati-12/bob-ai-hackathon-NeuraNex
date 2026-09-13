import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/common/StatusBadge';

describe('StatusBadge', () => {
  it('renders AT_BERTH label correctly', () => {
    render(<StatusBadge status="AT_BERTH" />);
    expect(screen.getByText('At Berth')).toBeTruthy();
  });

  it('renders INBOUND label correctly', () => {
    render(<StatusBadge status="INBOUND" />);
    expect(screen.getByText('Inbound')).toBeTruthy();
  });

  it('renders WAITING label correctly', () => {
    render(<StatusBadge status="WAITING" />);
    expect(screen.getByText('Waiting')).toBeTruthy();
  });

  it('renders DELAYED label correctly', () => {
    render(<StatusBadge status="DELAYED" />);
    expect(screen.getByText('Delayed')).toBeTruthy();
  });

  it('renders DEPARTED label correctly', () => {
    render(<StatusBadge status="DEPARTED" />);
    expect(screen.getByText('Departed')).toBeTruthy();
  });

  it('renders DIVERTED label correctly', () => {
    render(<StatusBadge status="DIVERTED" />);
    expect(screen.getByText('Diverted')).toBeTruthy();
  });

  it('renders AVAILABLE label correctly', () => {
    render(<StatusBadge status="AVAILABLE" />);
    expect(screen.getByText('Available')).toBeTruthy();
  });

  it('renders OCCUPIED label correctly', () => {
    render(<StatusBadge status="OCCUPIED" />);
    expect(screen.getByText('Occupied')).toBeTruthy();
  });

  it('renders MAINTENANCE label correctly', () => {
    render(<StatusBadge status="MAINTENANCE" />);
    expect(screen.getByText('Maintenance')).toBeTruthy();
  });

  it('renders ACTIVE label correctly', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders IDLE label correctly', () => {
    render(<StatusBadge status="IDLE" />);
    expect(screen.getByText('Idle')).toBeTruthy();
  });

  it('renders BREAKDOWN label correctly', () => {
    render(<StatusBadge status="BREAKDOWN" />);
    expect(screen.getByText('Breakdown')).toBeTruthy();
  });

  it('renders SCHEDULED label correctly', () => {
    render(<StatusBadge status="SCHEDULED" />);
    expect(screen.getByText('Scheduled')).toBeTruthy();
  });

  it('renders COMPLETED label correctly', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('renders CANCELLED label correctly', () => {
    render(<StatusBadge status="CANCELLED" />);
    expect(screen.getByText('Cancelled')).toBeTruthy();
  });

  it('falls back to status string for unknown status', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeTruthy();
  });

  it('renders em-dash when status is undefined', () => {
    render(<StatusBadge status={undefined} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders em-dash when status is null', () => {
    render(<StatusBadge status={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('accepts lowercase status and normalizes label', () => {
    render(<StatusBadge status="at_berth" />);
    expect(screen.getByText('At Berth')).toBeTruthy();
  });

  it('renders with size=lg without crashing', () => {
    render(<StatusBadge status="ACTIVE" size="lg" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });
});
