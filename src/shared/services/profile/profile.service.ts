import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Profile } from '../../core/profile';
import { Redis } from 'ioredis';

@Injectable()
export class ProfileService {
    private client: Redis;

    constructor(private _redis: RedisService) {
        this.client = _redis.getClient();
    }

    // Save user
    public save(profile: Profile): Promise<string> {
        return this.client.set(`user:${profile.id}`, JSON.stringify(profile))
    }

    // Get user
    public async get(id: string): Promise<Profile> {
        return new Profile(
            Object.assign(
                JSON.parse(await this.client.get(`user:${id}`)) || {}, { id }
            )
        )
    }
}
