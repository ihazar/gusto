import { addDays, isOrderableSlot, localNow, slotKey, upcomingSlots, weekdayOf } from './slots';

// Wed 2026-07-15 10:30 Israel time (IDT = UTC+3) is 07:30 UTC.
const WED_1030 = new Date('2026-07-15T07:30:00Z');

const window = (over: Partial<Parameters<typeof isOrderableSlot>[0]> = {}) => ({
    id: 'w1',
    weekday: 3, // Wednesday
    startTime: '12:00',
    endTime: '15:00',
    maxOrders: 5,
    ...over,
});

describe('localNow', () => {
    it('converts UTC to Israel local date, weekday and time', () => {
        expect(localNow(WED_1030)).toEqual({ date: '2026-07-15', weekday: 3, time: '10:30' });
    });

    it('rolls into the next local day across midnight', () => {
        // 22:30 UTC Wed = 01:30 Thu in Israel (IDT).
        expect(localNow(new Date('2026-07-15T22:30:00Z'))).toEqual({
            date: '2026-07-16',
            weekday: 4,
            time: '01:30',
        });
    });
});

describe('calendar helpers', () => {
    it('addDays crosses month boundaries', () => {
        expect(addDays('2026-07-30', 3)).toBe('2026-08-02');
    });

    it('weekdayOf matches the calendar', () => {
        expect(weekdayOf('2026-07-15')).toBe(3); // Wednesday
        expect(weekdayOf('2026-07-19')).toBe(0); // Sunday
    });
});

describe('upcomingSlots', () => {
    const now = localNow(WED_1030);

    it('includes today’s window while it has not ended, plus next week’s occurrence', () => {
        const slots = upcomingSlots([window()], new Map(), now);
        expect(slots.map((s) => s.date)).toEqual(['2026-07-15', '2026-07-22']);
        expect(slots[0]).toMatchObject({ startTime: '12:00', remaining: 5 });
    });

    it('drops today’s window once it has ended', () => {
        const slots = upcomingSlots([window({ startTime: '08:00', endTime: '10:00' })], new Map(), now);
        expect(slots.map((s) => s.date)).toEqual(['2026-07-22']); // next Wednesday only
    });

    it('subtracts booked orders and floors remaining at 0', () => {
        const booked = new Map([
            [slotKey('w1', '2026-07-15'), 3],
            [slotKey('w1', '2026-07-22'), 99],
        ]);
        const slots = upcomingSlots([window()], booked, now);
        expect(slots.find((s) => s.date === '2026-07-15')?.remaining).toBe(2);
        expect(slots.find((s) => s.date === '2026-07-22')?.remaining).toBe(0);
    });

    it('expands multiple windows sorted by date then start time', () => {
        const slots = upcomingSlots(
            [
                window({ id: 'a', weekday: 4, startTime: '18:00', endTime: '21:00' }), // Thu
                window({ id: 'b', weekday: 4, startTime: '08:00', endTime: '11:00' }), // Thu
                window({ id: 'c', weekday: 0, startTime: '09:00', endTime: '12:00' }), // Sun
            ],
            new Map(),
            now,
        );
        expect(slots.map((s) => `${s.date} ${s.startTime}`)).toEqual([
            '2026-07-16 08:00',
            '2026-07-16 18:00',
            '2026-07-19 09:00',
        ]);
    });
});

describe('isOrderableSlot', () => {
    const now = localNow(WED_1030);

    it('accepts today while the window is still open, and the same weekday next week', () => {
        expect(isOrderableSlot(window(), '2026-07-15', now)).toBe(true);
        expect(isOrderableSlot(window({ weekday: 2 }), '2026-07-21', now)).toBe(true);
        expect(isOrderableSlot(window(), '2026-07-22', now)).toBe(true); // day 7, last in horizon
    });

    it('rejects past dates, wrong weekdays, ended windows and beyond-horizon dates', () => {
        expect(isOrderableSlot(window(), '2026-07-08', now)).toBe(false); // last week
        expect(isOrderableSlot(window(), '2026-07-16', now)).toBe(false); // Thu ≠ Wed window
        expect(isOrderableSlot(window({ endTime: '10:00', startTime: '08:00' }), '2026-07-15', now)).toBe(false);
        expect(isOrderableSlot(window(), '2026-07-29', now)).toBe(false); // 14 days out
    });
});
