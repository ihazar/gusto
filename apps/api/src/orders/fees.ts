/**
 * Pricing engine. Commission + fees model (Israel-first).
 *
 * Note: VAT here is applied to the platform fees + delivery only — home-food
 * chefs are often `עוסק פטור` (VAT-exempt on the food itself). This is a
 * simplification to revisit with the invoicing/tax work (see ROADMAP §5).
 */
export const FEES = {
    /** Platform's cut of the dish subtotal (chef payout = subtotal − commission). */
    commissionRate: 0.15,
    /** Customer-facing service fee on the subtotal. */
    serviceFeeRate: 0.05,
    /** Flat delivery fee (distance-based in M5). */
    deliveryFee: 15,
    /** Israeli VAT rate. */
    vatRate: 0.18,
};

export interface ComputedTotals {
    subtotal: number;
    serviceFee: number;
    deliveryFee: number;
    tip: number;
    vat: number;
    total: number;
    /** Platform's commission, retained for chef payout accounting (M4). */
    commission: number;
    currency: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeTotals(subtotal: number, tip: number, currency = 'ILS'): ComputedTotals {
    const serviceFee = round2(subtotal * FEES.serviceFeeRate);
    const deliveryFee = FEES.deliveryFee;
    const vat = round2((serviceFee + deliveryFee) * FEES.vatRate);
    const commission = round2(subtotal * FEES.commissionRate);
    const total = round2(subtotal + serviceFee + deliveryFee + vat + tip);
    return { subtotal: round2(subtotal), serviceFee, deliveryFee, tip: round2(tip), vat, total, commission, currency };
}
