export interface OpenExchangeRates {
    timestamp: number;
    base: string;
    rates: {
        [key: string]: number;
    };
}
