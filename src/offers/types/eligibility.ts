// src/offers/types/eligibility.ts
export type Eligibility = {
    // gating
    requires_promocode?: boolean;
    promocode?: string | null;

    loyalty_only?: boolean;               // нужна карта/участие
    min_spend?: number | null;            // от N ₸
    min_qty?: number | null;              // от N шт
    time_window?: {                       // окно действия (дополнительно к start/end)
        days?: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>;
        start_time?: string | null;         // '09:00'
        end_time?: string | null;           // '18:00'
    } | null;

    // канальные ограничения
    channel_restricted?: boolean;
    channels?: string[];                  // ['APP_WOLT','IN_STORE',...]
};
