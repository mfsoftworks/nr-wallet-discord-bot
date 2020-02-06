import { Module, Global } from '@nestjs/common';
import { DiscordService } from './services/discord/discord.service';
import { ProfileService } from '../shared/services/profile/profile.service';
import { TransactionService } from '../shared/services/transaction/transaction.service';

@Global()
@Module({
    providers: [
        DiscordService,
        ProfileService,
        TransactionService
    ]
})
export class DiscordModule {}
