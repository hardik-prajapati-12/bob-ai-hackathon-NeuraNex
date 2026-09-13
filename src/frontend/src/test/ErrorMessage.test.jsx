import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorMessage from '../components/common/ErrorMessage';

describe('ErrorMessage', () => {
  it('renders with default message', () => {
    render(<ErrorMessage />);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
  });

  it('renders with custom message', () => {
    render(<ErrorMessage message="Failed to load vessels." />);
    expect(screen.getByText('Failed to load vessels.')).toBeTruthy();
  });

  it('does not render Retry button when onRetry is not provided', () => {
    render(<ErrorMessage message="An error occurred." />);
    expect(screen.queryByText('Retry')).toBeFalsy();
  });

  it('renders Retry button when onRetry callback is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage message="Load failed." onRetry={onRetry} />);
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('calls onRetry when Retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage message="Load failed." onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not call onRetry before button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage message="Error." onRetry={onRetry} />);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('renders error icon (svg)', () => {
    const { container } = render(<ErrorMessage message="Error." />);
    // lucide-react renders an SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('Retry button can be clicked multiple times', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage message="Error." onRetry={onRetry} />);
    const btn = screen.getByText('Retry');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
