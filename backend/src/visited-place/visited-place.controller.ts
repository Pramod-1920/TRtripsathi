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
