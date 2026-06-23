import { Injectable } from '@nestjs/common';

/** DI token for the active payment provider. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentAuthorization {
    provider: string;
    providerRef: string;
    status: 'AUTHORIZED' | 'FAILED';
}

/**
 * Authorize-not-capture: hold funds at order time, capture on handoff. Void a
 * still-authorized payment (chef reject / timeout), refund a captured one.
 * Swap the mock for an Israeli PSP (Tranzila/Meshulam/Cardcom) + Bit later
 * without touching OrdersService.
 */
export interface PaymentProvider {
    authorize(amount: number, currency: string, orderRef: string): Promise<PaymentAuthorization>;
    /** Capture previously-authorized funds. */
    capture(providerRef: string): Promise<void>;
    /** Release an authorization that was never captured. */
    void(providerRef: string): Promise<void>;
    /** Return captured funds to the customer. */
    refund(providerRef: string): Promise<void>;
}

/** Dev/test provider: always succeeds. No real money moves. */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
    async authorize(_amount: number, _currency: string, orderRef: string): Promise<PaymentAuthorization> {
        return { provider: 'mock', providerRef: `mock_auth_${orderRef}`, status: 'AUTHORIZED' };
    }
    async capture(_providerRef: string): Promise<void> {}
    async void(_providerRef: string): Promise<void> {}
    async refund(_providerRef: string): Promise<void> {}
}
