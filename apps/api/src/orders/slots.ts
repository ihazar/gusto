import { DeliverySlot } from '@gusto/contracts';

/** All kitchens are Israeli (Israel-first), so slots run on Israel local time. */
export const KITCHEN_TZ = 'Asia/Jerusalem';

/**
 * How far ahead customers can book: today + the next 7 days. Eight days, so a
 * weekly window still shows its next occurrence after today's has ended.
 */
export const SLOT_HORIZON_DAYS = 8;

/** "Now" broken into kitchen-local calendar parts. */
export interface LocalNow {
    /** "YYYY-MM-DD" */
    date: string;
    /** 0 = Sunday … 6 = Saturday. */
    weekday: number;
    /** "HH:mm" */
    time: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The current date/weekday/time as seen in the kitchen's timezone. */
export function localNow(now: Date = new Date(), tz: string = KITCHEN_TZ): LocalNow {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            weekday: 'short',
        })
            .formatToParts(now)
            .map((p) => [p.type, p.value]),
    );
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: WEEKDAYS.indexOf(parts.weekday),
        time: `${parts.hour}:${parts.minute}`,
    };
}

/** date ("YYYY-MM-DD") + n days. Pure calendar math, no timezone involved. */
export function addDays(date: string, n: number): string {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" calendar date. */
export function weekdayOf(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** A chef's weekly window, as stored in the Availability table. */
export interface SlotWindow {
    id: string;
    weekday: number;
    startTime: string;
    endTime: string;
    maxOrders: number;
}

/** Key for counting orders booked into one slot (window × date). */
export const slotKey = (availabilityId: string, date: string): string => `${availabilityId}|${date}`;

/**
 * Expand weekly windows into the concrete slots a customer can order into over
 * the next SLOT_HORIZON_DAYS, with remaining capacity. Today's windows are
 * included until they end; full slots are included with remaining = 0 so the
 * UI can show them as "Full".
 */
export function upcomingSlots(windows: SlotWindow[], booked: Map<string, number>, now: LocalNow): DeliverySlot[] {
    const slots: DeliverySlot[] = [];
    for (let i = 0; i < SLOT_HORIZON_DAYS; i++) {
        const date = addDays(now.date, i);
        const weekday = (now.weekday + i) % 7;
        for (const w of windows) {
            if (w.weekday !== weekday) continue;
            if (i === 0 && w.endTime <= now.time) continue; // already over today
            const used = booked.get(slotKey(w.id, date)) ?? 0;
            slots.push({
                availabilityId: w.id,
                date,
                weekday,
                startTime: w.startTime,
                endTime: w.endTime,
                maxOrders: w.maxOrders,
                remaining: Math.max(0, w.maxOrders - used),
            });
        }
    }
    return slots.sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? -1 : 1));
}

/**
 * Whether a (window, date) pair is a slot a customer may order into right now:
 * inside the horizon, on the window's weekday, and not already ended today.
 * Capacity is checked separately (it needs a DB count).
 */
export function isOrderableSlot(window: SlotWindow, date: string, now: LocalNow): boolean {
    if (date < now.date || date > addDays(now.date, SLOT_HORIZON_DAYS - 1)) return false;
    if (weekdayOf(date) !== window.weekday) return false;
    if (date === now.date && window.endTime <= now.time) return false;
    return true;
}
