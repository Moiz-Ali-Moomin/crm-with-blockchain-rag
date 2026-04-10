import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WalletsService } from './wallets.service';
import { WalletsRepository } from './wallets.repository';
import { WalletsController } from './wallets.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { CUSTODY_PROVIDER } from '../blockchain/custody/custody.interface';
import { FireblocksCustodyAdapter } from '../blockchain/custody/fireblocks-custody.adapter';
import { LocalCustodyAdapter } from '../blockchain/custody/local-custody.adapter';

@Module({
  imports: [LedgerModule, ConfigModule],
  controllers: [WalletsController],
  providers: [
    WalletsService,
    WalletsRepository,
    {
      provide: CUSTODY_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('CUSTODY_PROVIDER', 'local');
        // Swap by setting CUSTODY_PROVIDER=fireblocks in production
        if (provider === 'fireblocks') return new FireblocksCustodyAdapter(config);
        return new LocalCustodyAdapter(config);
      },
    },
  ],
  exports: [WalletsService, WalletsRepository],
})
export class WalletsModule {}
