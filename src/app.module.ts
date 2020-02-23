import { Module } from '@nestjs/common';
import { RedisModule } from 'nestjs-redis';
import { DiscordModule } from './discord/discord.module';
import config from 'config';
import { SharedModule } from './shared/shared.module';
import { AuthFrontendModule } from './auth-frontend/auth-frontend.module';

@Module({
    imports: [
        RedisModule.forRootAsync({
            useFactory: () => config.get('redis')
        }),
        SharedModule,
        DiscordModule,
        AuthFrontendModule
    ]
})
export class AppModule {}
