import { Module } from '@nestjs/common';
import { RedisModule } from 'nestjs-redis';
import { AppController } from './app.controller';
import { DiscordModule } from './discord/discord.module';
import config from 'config';
import { SharedModule } from './shared/shared.module';

@Module({
    imports: [
        SharedModule,
        RedisModule.register(config.get('redis')),
        DiscordModule
    ],
    controllers: [AppController],
    providers: [],
})
export class AppModule {}
