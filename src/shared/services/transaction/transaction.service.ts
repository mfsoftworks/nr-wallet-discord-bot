import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Message } from 'discord.js';
import { Transaction } from '../../core/transaction';
import { Redis } from 'ioredis';

@Injectable()
export class TransactionService {
    private client: Redis;

    constructor(private _redis: RedisService) {
        this.client = _redis.getClient();
    }

    // Save pending transaction
    public save(transaction: Transaction): Promise<string> {
        const message = transaction.message
        delete transaction.message
        return this.client.set(`transaction:${message.guild.id}:${message.author.id}`, transaction.toJSON())
    }

    // Pull pending transaction from database
    public async get(message: Message): Promise<Transaction> {
        const tx = new Transaction(
            message,
            JSON.parse(
                await this.client.get(`transaction:${message.guild.id}:${message.author.id}`)
            )
        )
        return tx
    }
}
