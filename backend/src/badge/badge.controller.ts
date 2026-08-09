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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/constants/roles.enum';
import { BadgeService } from './badge.service';
import { AwardBadgeDto } from './dto/award-badge.dto';
import { UserService } from '../user/user.service';

@ApiTags('Badge')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class BadgeController {
  constructor(
    private readonly badgeService: BadgeService,
    private readonly userService: UserService,
  ) {}

  @Post('profiles/:id/badges')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: award a badge to a profile' })
  async awardBadgeToProfile(
    @Param('id') profileId: string,
    @Body() body: AwardBadgeDto,
  ) {
    // Resolve profile -> ensure we have the profile object
    const profile = (await this.userService.getProfileById(
      profileId,
    )) as unknown as { _id?: string } | null;

    const resolvedId = String(profile?._id ?? profileId);

    // Use badge service to award
    return this.badgeService.awardBadge(
      resolvedId,
      body.badgeCode,
      body.tier ?? '',
      body.name,
      body.description ?? '',
      body.iconUrl,
    );
  }

  @Get('profiles/:id/badges')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: list badges awarded to a profile' })
  async getProfileBadges(@Param('id') profileId: string) {
    const profile = (await this.userService.getProfileById(
      profileId,
    )) as unknown as {
      _id?: string;
    };
    return this.badgeService.getUserBadges(String(profile._id ?? profileId));
  }

  @Delete('profiles/:id/badges/:badgeCode')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: revoke a badge from a profile' })
  async revokeProfileBadge(
    @Param('id') profileId: string,
    @Param('badgeCode') badgeCode: string,
  ) {
    const profile = (await this.userService.getProfileById(
      profileId,
    )) as unknown as {
      _id?: string;
    };
    await this.badgeService.revokeBadge(
      String(profile._id ?? profileId),
      badgeCode,
    );
    return { message: 'Badge revoked successfully' };
  }
}
