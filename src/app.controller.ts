/* eslint-disable @typescript-eslint/camelcase */
import { Controller, Get, Query, HttpService } from '@nestjs/common';
import { SHA256, enc } from 'crypto-js';
import config from 'config';
import { ProfileService } from './shared/services/profile/profile.service';
import { Profile } from './shared/core/profile';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators'

@Controller()
export class AppController {
    constructor(
        private readonly http: HttpService,
        private _profile: ProfileService
    ) {}

    @Get('authorise')
    authorise(@Query('code') code: string, @Query('state') state?: string): Observable<string> {
        if (!code || !state) {
            return of('Error, invalid information returned from server')
        }

        const id = state.split(',')[0]
        const hmac = state.split(',')[1]
        const comparison = SHA256(id, config.get('wallet.secret')).toString(enc.Hex)

        // Verify state
        if (comparison !== hmac) {
            return of('Error Linking account, please try again')
        }

        // Exchange code for token
        return this.http.post(`${config.get('wallet.endpoint')}/oauth/token`, {
            grant_type: 'authorization_code',
            client_id: config.get('wallet.client'),
            client_secret: config.get('wallet.secret'),
            redirect_uri: config.get('wallet.redirect_uri'),
            code
        }).pipe(
            tap(d => console.log('Wallet server authorise response', d)),
            map(d => d.data.access_token),
            tap(token => console.log('Token:', token)),
            map(token => {
                // TODO: Get data from server

                // Create profile and save
                this._profile.save(new Profile({
                    id,
                    token,
                    balance: {
                        available: 0,
                        pending: 0
                    },
                    currency: 'SGD'
                }));

                // Return success page
                return 'Account successfully linked!'
            }),
            catchError(e => {
                console.warn(e);
                return 'Error occured';
            })
        );
    }
}
