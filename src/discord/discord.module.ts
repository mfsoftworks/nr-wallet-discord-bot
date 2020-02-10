import { Module, Global, HttpModule } from '@nestjs/common';
import { DiscordService } from './services/discord/discord.service';
import { ProfileService } from '../shared/services/profile/profile.service';
import { TransactionService } from '../shared/services/transaction/transaction.service';
import { MoneyService } from './services/money/money.service';

@Global()
@Module({
    imports: [
        HttpModule
    ],
    providers: [
        MoneyService,
        DiscordService,
        ProfileService,
        TransactionService
    ]
})
export class DiscordModule {}
