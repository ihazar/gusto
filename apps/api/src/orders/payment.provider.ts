import { Injectable } from '@nestjs/common';

/** DI token for the active payment provider. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentAuthorization {
    provider: string;
    providerRef: string;
    status: 'AUTHORIZED' | 'FAILED';
}

/**
 * Authorize-not-capture: hold funds at order time, capture on handoff (M4).
 * Swap the mock for an Israeli PSP (Tranzila/Meshulam/Cardcom) + Bit later
 * without touching OrdersService.
 */
export interface PaymentProvider {
    authorize(amount: number, currency: string, orderRef: string): Promise<PaymentAuthorization>;
}

/** Dev/test provider: always authorizes. No real money moves. */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
    async authorize(_amount: number, _currency: string, orderRef: string): Promise<PaymentAuthorization> {
        return { provider: 'mock', providerRef: `mock_auth_${orderRef}`, status: 'AUTHORIZED' };
    }
}
