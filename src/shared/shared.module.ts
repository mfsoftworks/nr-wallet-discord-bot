import { Module, Global, HttpModule } from '@nestjs/common';
import { ProfileService } from './services/profile/profile.service';
import { TransactionService } from './services/transaction/transaction.service';
import { MoneyService } from './services/money/money.service';

@Global()
@Module({
    imports: [
        HttpModule
    ],
    providers: [
        MoneyService,
        ProfileService,
        TransactionService
    ],
    exports: [
        HttpModule,
        MoneyService,
        ProfileService,
        TransactionService
    ]
})
export class SharedModule {}
