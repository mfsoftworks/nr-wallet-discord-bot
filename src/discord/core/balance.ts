export interface BalanceAmount {
    amount: number;
    currency: string;
}

export interface Balance {
    object: string;
    available: BalanceAmount[];
    connect_reserved?: BalanceAmount[];
    livemode: boolean;
    pending: BalanceAmount[];
}