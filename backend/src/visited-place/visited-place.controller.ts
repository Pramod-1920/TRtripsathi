import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VisitedPlaceService } from './visited-place.service';
import { UserService } from '../user/user.service';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';

@ApiTags('Visited places')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('admin/profiles/:profileId/visited-places')
export class VisitedPlaceController {
  constructor(
    private readonly visitedPlaceService: VisitedPlaceService,
    private readonly userService: UserService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list places visited by a user' })
  async list(@Param('profileId') profileId: string) {
    await this.userService.getProfileById(profileId);
    return this.visitedPlaceService.getUserVisits(profileId);
  }

  @Post()
  @ApiOperation({ summary: 'Admin: record a visited district or province' })
  async record(
    @Param('profileId') profileId: string,
    @Body()
    body: {
      placeCode: string;
      placeType: 'district' | 'province';
      visitedAt?: string;
    },
  ) {
    await this.userService.getProfileById(profileId);
    return this.visitedPlaceService.recordVisit(
      profileId,
      body.placeCode,
      body.placeType,
      body.visitedAt ? new Date(body.visitedAt) : undefined,
    );
  }

  @Delete(':placeCode')
  @ApiOperation({ summary: 'Admin: remove a visited-place record' })
  async remove(
    @Param('profileId') profileId: string,
    @Param('placeCode') placeCode: string,
  ) {
    await this.userService.getProfileById(profileId);
    return this.visitedPlaceService.removeVisit(profileId, placeCode);
  }
}

@ApiTags('Visited places')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.User)
@Controller('visited-places')
export class MyVisitedPlaceController {
  constructor(
    private readonly visitedPlaceService: VisitedPlaceService,
    private readonly userService: UserService,
  ) {}

  @Get('mine')
  @ApiOperation({ summary: 'List my verified district and province visits' })
  async listMine(@GetCurrentUser('userId') authId: string) {
    const profile = await this.userService.getProfileByAuthId(authId);
    const storedItems = await this.visitedPlaceService.getUserVisits(
      String(profile._id),
    );
    const itemMap = new Map<string, Record<string, unknown>>();
    for (const item of storedItems) {
      const plain = item.toObject() as Record<string, unknown>;
      itemMap.set(`${item.placeType}:${item.placeCode}`, plain);
    }
    const approvedPlaces = (profile.photoVerificationRequests ?? []).filter(
      (request) =>
        request.status === 'approved' &&
        Boolean(request.place?.trim()) &&
        Boolean(request.district?.trim()),
    );
    for (const request of approvedPlaces) {
      const placeCode = String(request.district)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
      const key = `district:${placeCode}`;
      const existing = itemMap.get(key);
      itemMap.set(key, {
        ...(existing ?? {}),
        placeCode,
        placeType: 'district',
        visitCount: Math.max(0, Number(existing?.visitCount ?? 0)) + 1,
        visitedAt: request.reviewedAt ?? request.submittedAt,
      });
    }
    const items = Array.from(itemMap.values()).sort(
      (first, second) =>
        new Date(String(second.visitedAt ?? 0)).getTime() -
        new Date(String(first.visitedAt ?? 0)).getTime(),
    );
    const districtItems = items.filter((item) => item.placeType === 'district');
    const provinceItems = items.filter((item) => item.placeType === 'province');

    return {
      items,
      approvedPlaces: approvedPlaces.map((request) => ({
        requestCode: request.requestCode,
        title: request.title,
        category: request.category,
        province: request.province,
        district: request.district,
        municipality: request.municipality,
        place: request.place,
        address: request.address,
        photoUrl: request.url,
        latitude: request.latitude,
        longitude: request.longitude,
        verifiedAt: request.reviewedAt,
      })),
      summary: {
        districtsVisited: districtItems.length,
        provincesVisited: provinceItems.length,
        totalVerifiedVisits: districtItems.reduce(
          (total, item) => total + Math.max(1, Number(item.visitCount ?? 1)),
          0,
        ),
      },
    };
  }
}
