import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Nav from './index';
import type { User } from '~/types/models';

// Mock Remix components
vi.mock('@remix-run/react', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Form: ({ children, ...props }: any) => (
    <form {...props}>
      {children}
    </form>
  ),
}));

describe('Nav component', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'jackie@podplanner.com',
  };

  it('should render the Podplanner brand', () => {
    render(<Nav user={mockUser} />);

    expect(screen.getByText('Podplanner')).toBeInTheDocument();
  });

  it('should display the user email', () => {
    render(<Nav user={mockUser} />);

    expect(screen.getByText('jackie@podplanner.com')).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    render(<Nav user={mockUser} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should have correct href for navigation links', () => {
    render(<Nav user={mockUser} />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    const calendarLink = screen.getByText('Calendar').closest('a');
    const settingsLink = screen.getByText('Settings').closest('a');

    expect(dashboardLink).toHaveAttribute('href', '/');
    expect(calendarLink).toHaveAttribute('href', '/calendar');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('should render Sign Out button', () => {
    render(<Nav user={mockUser} />);

    const signOutButton = screen.getByText('Sign Out');
    expect(signOutButton).toBeInTheDocument();
  });

  it('should have logout form with correct action', () => {
    const { container } = render(<Nav user={mockUser} />);

    const form = container.querySelector('form');
    expect(form).toHaveAttribute('action', '/logout');
    expect(form).toHaveAttribute('method', 'post');
  });

  it('should render with different user emails', () => {
    const anotherUser: User = {
      id: 'user-456',
      email: 'jacey@podplanner.com',
    };

    render(<Nav user={anotherUser} />);

    expect(screen.getByText('jacey@podplanner.com')).toBeInTheDocument();
    expect(screen.queryByText('jackie@podplanner.com')).not.toBeInTheDocument();
  });

  it('should be able to submit logout form', async () => {
    const user = userEvent.setup();
    const { container } = render(<Nav user={mockUser} />);

    const signOutButton = screen.getByText('Sign Out');
    const form = container.querySelector('form');

    await user.click(signOutButton);

    // Form should still be in the DOM (actual submission handled by Remix)
    expect(form).toBeInTheDocument();
  });
});
