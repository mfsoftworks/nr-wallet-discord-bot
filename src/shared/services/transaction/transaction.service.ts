/* eslint-disable @typescript-eslint/camelcase */
import { Injectable, HttpService, OnApplicationBootstrap } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Message, TextChannel } from 'discord.js';
import { Transaction } from '../../core/transaction';
import { Redis } from 'ioredis';
import { MoneyService } from '../money/money.service';
import { Profile } from '../../core/profile';
import { ProfileService } from '../profile/profile.service';
import { Observable, forkJoin } from 'rxjs';
import { SHA256, enc } from 'crypto-js';
import config from 'config';
import { map, switchMap, tap, mergeMap } from 'rxjs/operators';

@Injectable()
export class TransactionService implements OnApplicationBootstrap {
    private client: Redis;

    constructor(
        private readonly http: HttpService,
        private readonly _redis: RedisService,
        private _money: MoneyService,
        private _profile: ProfileService
    ) {}

    public onApplicationBootstrap(): void {
        this.client = this._redis.getClient();
        console.log(this.constructor.name, 'established Redis connection');
    }

    // Save pending transaction
    public save(transaction: Transaction): Promise<string> {
        return this.client.set(`transaction:${transaction.guild}:${transaction.sender}`, JSON.stringify(transaction))
    }

    // Pull pending transaction from database
    public async get(message: Message): Promise<Transaction> {
        // Get tx data
        const data = await this.client.get(`transaction:${message.guild.id}:${message.author.id}`)
        if (!data) {
            return null
        }
        return new Transaction(
            null, JSON.parse(data)
        )
    }

    // Clear transaction from pending pool
    public clear(tx: Transaction): Promise<number> {
        return this.client.del(`transaction:${tx.guild}:${tx.sender}`)
    }

    // Execute transaction with server
    public async execute(tx: Transaction, message: Message): Promise<Observable<boolean>> {
        // Get sender
        const user: Profile = await this._profile.get(tx.sender)

        // Get profile array for receivers
        const receivers = await Promise.all(tx.users.map(u => this._profile.get(u)))

        // Send tx.action({ tx.amount, tx.currency }), to server with sender token and user id
        const transactions = receivers.map(u => this.doTransaction(
            tx.action == 'split' ? (tx.amount as number)/tx.users.length : tx.amount as number,
            tx.currency as string,
            user,
            u,
            message
        ))

        // Return array of transactions to ensure all completed before progressing
        return forkJoin(...transactions)
    }

    private doTransaction(amount: number, currency: string, user: Profile, to: Profile, message: Message): Observable<any> {
        // Create unique nonce from Discord info and timestamp
        const nonce = SHA256(
            `${user.id}${to.id}${new Date().getTime()}`,
            config.get('discord_token')
        ).toString(enc.Hex)

        // Get a payment intent for transaction
        return this.http.get(
            `${config.get('wallet.api')}/transaction/prepare`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }, params: {
                    amount: amount,
                    for_user_id: to.wallet_id,
                    nonce
                }
            }
        ).pipe(
            // Get intent data
            map(d => d.data),
            tap(i => console.log('Transaction intent:', i)),
            switchMap(i =>
                // Get payment sources
                this._profile.sources(user).pipe(
                    // Map to first payment source
                    map(sources => sources[0]),
                    tap(pm => console.log('Using payment method:', pm)),
                    mergeMap(pm =>
                        // Execute payment
                        this.http.post(
                            `${config.get('wallet.api')}/transaction/pay`, {
                                amount: amount,
                                currency: currency,
                                description: `Discord transfer from @${message.author.username} (${message.guild.name} #${(message.channel as TextChannel).name})`,
                                stripe_transaction_id: i.id,
                                status: 'pending',
                                type: 'card',
                                for_user_id: { id: to.wallet_id },
                                payment_method: pm.id
                            }, {
                                headers: {
                                    'Authorization': `Bearer ${user.token}`
                                }
                            }
                        )
                    ),
                    map(tx => tx.data),
                    tap(tx => console.log('Transaction response:', tx))
                )
            )
        )
    }

    // Return transaction to string
    public toString(tx: Transaction): string {
        return `Awesome! I'll ${tx.action === 'split' ? 'split' : 'send'}:\n\n` +
        `${this._money.format(tx.amount as number, tx.currency as string)} ${tx.action === 'split' ? 'between' : 'to'} ${tx.users.length === 1 ? `<@${tx.users[0]}>\n` : tx.users.reduce((t: string, u: string) => t += `<@${u}>\n`, '\n\n')}` +
        `\nSend a \`$confirm\` to confirm this transaction`
    }
}
