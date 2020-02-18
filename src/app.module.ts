import { Module, HttpModule } from '@nestjs/common';
import { RedisModule } from 'nestjs-redis';
import { AppController } from './app.controller';
import { DiscordModule } from './discord/discord.module';
import config from 'config';
import { ProfileService } from './shared/services/profile/profile.service';
import { TransactionService } from './shared/services/transaction/transaction.service';
import { MoneyService } from './discord/services/money/money.service';

@Module({
    imports: [
        HttpModule,
        RedisModule.register(config.get('redis')),
        DiscordModule
    ],
    controllers: [AppController],
    providers: [
        MoneyService,
        ProfileService,
        TransactionService
    ],
})
export class AppModule {}
