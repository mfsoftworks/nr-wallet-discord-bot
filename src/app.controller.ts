/* eslint-disable @typescript-eslint/camelcase */
import { Controller, Get, Query, HttpService, Redirect } from '@nestjs/common';
import { SHA256, enc } from 'crypto-js';
import config from 'config';
import { ProfileService } from './shared/services/profile/profile.service';
import { Profile } from './shared/core/profile';
import { Observable, of } from 'rxjs';
import { map, tap, catchError, mergeMap } from 'rxjs/operators'

@Controller()
export class AppController {
    constructor(
        private readonly http: HttpService,
        private _profile: ProfileService
    ) {}

    @Get()
    @Redirect(config.get('wallet.app'), 301)
    home(): void {
        return;
    }

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

        // Create profile
        const user = new Profile({ id })

        // Exchange code for token
        return this.http.post(`${config.get('wallet.endpoint')}/oauth/token`, {
            grant_type: 'authorization_code',
            client_id: config.get('wallet.client'),
            client_secret: config.get('wallet.secret'),
            redirect_uri: config.get('wallet.redirect_uri'),
            code
        }).pipe(
            // Pull out token and save
            map(d => d.data.access_token),
            tap(token => console.log('Token:', token)),
            tap(token => Object.assign(user, { token })),
            // Get data from server
            mergeMap(token => this.http.get(
                `${config.get('wallet.api')}/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            )),
            map(a => a.data),
            map(account => {
                // Set user currency
                user.currency = account.defaultCurrency;
                console.log('Account', user);
                console.log('JSON:', JSON.stringify(user));
                this._profile.save(user);

                // Return success
                return 'Account successfully linked!'
            }),
            // Return error
            catchError(e => {
                console.warn(e);
                return 'Error occured';
            })
        );
    }
}
