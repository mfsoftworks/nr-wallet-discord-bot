import { Injectable, HttpService } from '@nestjs/common';
import Decimal from 'decimal.js';
import * as fx from 'money';
import { Observable, timer } from 'rxjs';
import { map, share, mergeMap } from 'rxjs/operators';
import config from 'config';
import { OpenExchangeRates } from 'src/discord/core/open-exchange-rates';
import { CurrencyDecimalPlaces } from 'src/discord/core/currency-decimal-places.enum';

@Injectable()
export class MoneyService {
    constructor(private http: HttpService) {
        timer(0, 1000 * 60 * 60).pipe(
            mergeMap(() => this.updateRates()),
            share()
        );
    }

    // Take base currency and convert to a displayable decimal
    format(amount: number, currency: string): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency
        }).format(this.compress(amount, currency));
    }

    // Take the number input and convert to base currency
    unformat(amount: number, currency: string): number {
        return this.uncompress(amount, currency);
    }

    // Compress format to decimal amount
    compress(amount: number, currency: string): number {
        return new Decimal(amount).div(new Decimal(10).pow(CurrencyDecimalPlaces[currency.toUpperCase()])).toNumber();
    }

    // Uncompress format to base denomination
    uncompress(amount: number, currency: string): number {
        return new Decimal(amount).times(new Decimal(10).pow(CurrencyDecimalPlaces[currency.toUpperCase()])).toNumber();
    }

    // Take a base currency and convert to a secondary currency
    convert(amount: number, from: string, to: string): Observable<number> {
        return this.updateRates().pipe(
            // Compress in base currency, convert to fx and uncompress using fx
            map(() => Math.round(
                this.uncompress(
                    fx(this.compress(amount, from)).convert({ from: from.toUpperCase(), to: to.toUpperCase() }),
                    from
                )
            ))
        )
    }

    // API: Update exchange rates
    updateRates(): Observable<OpenExchangeRates> {
        return this.http.get<OpenExchangeRates>(
            `${config.get('fx.url')}`, {
                // eslint-disable-next-line @typescript-eslint/camelcase
                params: { app_id: config.get('fx.client_id') }
            }
        ).pipe(
            map(d => d.data),
            map((data: OpenExchangeRates) => {
                console.log('Open exchange rates:', data)
                fx.base = data.base;
                fx.rates = data.rates;
                return data
            })
        )
    }
}
