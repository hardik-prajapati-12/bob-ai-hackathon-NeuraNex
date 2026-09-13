import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../components/common/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default message "Loading..."', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders with custom message', () => {
    render(<LoadingSpinner message="Fetching vessels..." />);
    expect(screen.getByText('Fetching vessels...')).toBeTruthy();
  });

  it('does not render message span when message is empty string', () => {
    render(<LoadingSpinner message="" />);
    expect(screen.queryByText('Loading...')).toBeFalsy();
  });

  it('renders spinner element (div with animation)', () => {
    const { container } = render(<LoadingSpinner />);
    // The spinner div is inside a flex container
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBeGreaterThan(0);
  });

  it('renders without crashing when size is set', () => {
    render(<LoadingSpinner size={48} message="Loading data" />);
    expect(screen.getByText('Loading data')).toBeTruthy();
  });

  it('renders without crashing when size is 0', () => {
    render(<LoadingSpinner size={0} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
