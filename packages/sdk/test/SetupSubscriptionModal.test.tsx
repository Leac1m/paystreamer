import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SetupSubscriptionModal } from '../src/ui/SetupSubscriptionModal';

// Mock the React hooks used inside the modal
vi.mock('../src/react/usePlatform', () => ({
  usePlatform: vi.fn(() => ({
    data: {
      tiers: [
        { amount: '10000000000', frequency: '60000' } // 10 PUSD
      ]
    },
    isLoading: false
  }))
}));

vi.mock('../src/react/useUserAccount', () => ({
  useUserAccount: vi.fn(() => ({
    userAccount: { balance: 0n, accountId: 'acc_123', accountCapId: 'cap_123' },
    isLoading: false
  }))
}));

vi.mock('../src/react/usePusdBalance', () => ({
  usePusdBalance: vi.fn(() => ({
    data: 100000000000n, // 100 PUSD
    isLoading: false
  }))
}));

const mockSubscribe = vi.fn();
vi.mock('../src/react/useSubscribe', () => ({
  useSubscribe: vi.fn(() => ({
    subscribe: mockSubscribe,
    isLoading: false,
    error: null,
    recommendedDeposit: 10000000000n,
    hasAccount: true
  }))
}));

vi.mock('../src/ui/ThemeContext', () => ({
  useThemeStyles: vi.fn(() => ({}))
}));

describe('SetupSubscriptionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly when isOpen is true', () => {
    render(
      <SetupSubscriptionModal 
        isOpen={true} 
        onClose={() => {}} 
        platformId="plat_123" 
        tierIndex={0} 
      />
    );
    expect(screen.getByText('Fill Up & Subscribe')).toBeDefined();
    // 10 PUSD tier amount
    expect(screen.getByText('10.00 PUSD')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SetupSubscriptionModal 
        isOpen={false} 
        onClose={() => {}} 
        platformId="plat_123" 
        tierIndex={0} 
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls subscribe when submit button is clicked', async () => {
    mockSubscribe.mockResolvedValueOnce('digest_123');
    
    render(
      <SetupSubscriptionModal 
        isOpen={true} 
        onClose={() => {}} 
        platformId="plat_123" 
        tierIndex={0} 
      />
    );
    
    const button = screen.getByRole('button', { name: 'Subscribe' });
    fireEvent.click(button);
    
    expect(mockSubscribe).toHaveBeenCalledWith(10000000000n);
  });
});
