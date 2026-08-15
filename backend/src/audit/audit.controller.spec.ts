import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '../auth/constants/roles.enum';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditController } from './audit.controller';

describe('AuditController authorization', () => {
  it('requires authentication and limits access to admins and moderators', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, AuditController)).toEqual([
      Role.Admin,
      Role.Moderator,
    ]);
  });

  it('rejects a normal user from the audit endpoint role policy', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([Role.Admin, Role.Moderator]),
    } as any);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.User } }),
      }),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(
      'You do not have permission to access this resource',
    );
  });

  it('passes all supported filters to the service', () => {
    const service = { listEvents: jest.fn() };
    const controller = new AuditController(service as any);

    controller.list(
      '2',
      '25',
      undefined,
      'campaign.',
      'admin-1',
      'campaign',
      'CMP-1',
      '2026-08-01',
      '2026-08-16',
    );

    expect(service.listEvents).toHaveBeenCalledWith({
      page: 2,
      limit: 25,
      type: undefined,
      action: 'campaign.',
      actorId: 'admin-1',
      entityType: 'campaign',
      entityId: 'CMP-1',
      from: '2026-08-01',
      to: '2026-08-16',
    });
  });
});
