import { Module } from '@nestjs/common';
import { DiscordService } from './services/discord/discord.service';

@Module({
    imports: [],
    providers: [
        DiscordService
    ]
})
export class DiscordModule {}
