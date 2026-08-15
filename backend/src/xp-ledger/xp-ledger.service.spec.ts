import { Types } from 'mongoose';
import { XpLedgerSchema } from './schemas/xp-ledger.schema';
import { XpLedgerService } from './xp-ledger.service';

describe('XpLedgerService idempotency', () => {
  it('declares a unique partial index for each user and context key', () => {
    const index = XpLedgerSchema.indexes().find(
      ([fields]) => fields.userId === 1 && fields.contextKey === 1,
    );

    expect(index).toBeDefined();
    expect(index?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { contextKey: { $type: 'string' } },
    });
  });

  it('returns the existing reservation after a duplicate-key race', async () => {
    const existing = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      contextKey: 'RULE-1:once_per_user',
      xpAmount: 25,
    };
    const model = {
      create: jest.fn().mockRejectedValue({ code: 11000 }),
      findOne: jest.fn().mockResolvedValue(existing),
    };
    const service = new XpLedgerService(model as never);

    const result = await service.reserveXpAward({
      userId: String(existing.userId),
      xpAmount: 25,
      eventCode: 'profile_completed',
      contextKey: existing.contextKey,
    });

    expect(result).toEqual({ ledger: existing, created: false });
    expect(model.findOne).toHaveBeenCalledWith({
      userId: existing.userId,
      contextKey: existing.contextKey,
    });
  });
});
