import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { XpLedgerService } from './xp-ledger.service';
import { XpLedger, XpLedgerSchema } from './schemas/xp-ledger.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: XpLedger.name, schema: XpLedgerSchema },
    ]),
  ],
  providers: [XpLedgerService],
  exports: [XpLedgerService],
})
export class XpLedgerModule {}
