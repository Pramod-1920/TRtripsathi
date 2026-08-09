import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/constants/roles.enum';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetReferrerDto } from './dto/set-referrer.dto';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { TriggerXpEventDto } from './dto/trigger-xp-event.dto';
import { TriggerAchievementEventDto } from './dto/trigger-achievement-event.dto';
import { CreatePhotoVerificationRequestDto } from './dto/create-photo-verification-request.dto';
import { ReviewPhotoVerificationRequestDto } from './dto/review-photo-verification-request.dto';
import { UserService } from './user.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('User')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly audit: AuditService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get own profile' })
  @ApiOkResponse({ description: 'Own profile fetched successfully' })
  async getOwnProfile(@GetCurrentUser('userId') authId: string) {
    return this.userService.getProfileByAuthId(authId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update own profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ description: 'Own profile updated successfully' })
  async updateOwnProfile(
    @GetCurrentUser('userId') authId: string,
    @Body() updates: UpdateProfileDto,
  ) {
    return this.userService.updateOwnProfile(authId, updates);
  }

  @Delete('profile')
  @ApiOperation({ summary: 'Delete own account and profile' })
  @ApiOkResponse({ description: 'Own account deleted successfully' })
  async deleteOwnProfile(@GetCurrentUser('userId') authId: string) {
    return this.userService.deleteOwnProfile(authId);
  }

  @Post('xp/events')
  @ApiOperation({
    summary: 'Apply XP rules for own profile using an event key',
  })
  @ApiBody({ type: TriggerXpEventDto })
  @ApiOkResponse({ description: 'XP event evaluated successfully' })
  async triggerOwnXpEvent(
    @GetCurrentUser('userId') authId: string,
    @Body() body: TriggerXpEventDto,
  ) {
    void authId;
    void body;
    throw new ForbiddenException(
      'XP rewards are awarded only by verified server workflows',
    );
  }

  @Post('achievements/events')
  @ApiOperation({ summary: 'Record an achievement event for own profile' })
  @ApiBody({ type: TriggerAchievementEventDto })
  @ApiOkResponse({ description: 'Achievement event recorded successfully' })
  async triggerOwnAchievementEvent(
    @GetCurrentUser('userId') authId: string,
    @Body() body: TriggerAchievementEventDto,
  ) {
    return this.userService.recordAchievementEvent(authId, body);
  }

  @Get('profile/xp/history')
  @ApiOperation({ summary: 'Get own XP award history with pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ description: 'XP history fetched successfully' })
  async getOwnXpHistory(
    @GetCurrentUser('userId') authId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.userService.getOwnXpHistory(authId, page, limit);
  }

  @Post('profile/referrer')
  @ApiOperation({ summary: 'Set own referrer profile once' })
  @ApiBody({ type: SetReferrerDto })
  @ApiOkResponse({ description: 'Referrer linked successfully' })
  async setOwnReferrer(
    @GetCurrentUser('userId') authId: string,
    @Body() body: SetReferrerDto,
  ) {
    return this.userService.setReferrerForOwnProfile(
      authId,
      body.referrerProfileId,
    );
  }

  @Post('ratings')
  @ApiOperation({
    summary: 'Submit rating for another profile and auto-trigger rating XP',
  })
  @ApiBody({ type: SubmitRatingDto })
  @ApiOkResponse({ description: 'Rating submitted successfully' })
  async submitRating(
    @GetCurrentUser('userId') authId: string,
    @Body() body: SubmitRatingDto,
  ) {
    return this.userService.submitRating(authId, body);
  }

  @Post('photos/verification-requests')
  @ApiOperation({
    summary: 'Submit campaign photo for manual verification before XP award',
  })
  @ApiBody({ type: CreatePhotoVerificationRequestDto })
  @ApiOkResponse({ description: 'Photo verification request submitted' })
  async createPhotoVerificationRequest(
    @GetCurrentUser('userId') authId: string,
    @Body() body: CreatePhotoVerificationRequestDto,
  ) {
    return this.userService.createPhotoVerificationRequest(authId, body);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search public user profiles' })
  @ApiQuery({ name: 'q', required: false, example: 'john' })
  @ApiQuery({ name: 'experienceLevel', required: false, example: 'beginner' })
  @ApiQuery({ name: 'province', required: false, example: 'Bagmati' })
  @ApiQuery({
    name: 'district',
    required: false,
    example: 'Kathmandu District',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({
    description: 'Public profiles list returned with pagination',
    example: {
      items: [
        {
          _id: '6805f4a8b7a4f7d6e0f2d0d3',
          firstName: 'John',
          lastName: 'Doe',
          profilePhoto:
            'https://res.cloudinary.com/demo/image/upload/profile.jpg',
          location: 'Kathmandu',
          province: 'Bagmati',
          district: 'Kathmandu District',
          experienceLevel: 'beginner',
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    },
  })
  async searchUsers(@Query() query: SearchUsersDto) {
    return this.userService.searchUsers(query);
  }

  @Get('admin/profiles')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: list user profiles with pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'q', required: false, example: 'kathmandu' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'active', 'inactive', 'complete', 'incomplete'],
    example: 'all',
  })
  @ApiOkResponse({ description: 'User profiles list fetched successfully' })
  async getAllProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('q') q?: string,
    @Query('status')
    status?: 'all' | 'active' | 'inactive' | 'complete' | 'incomplete',
  ) {
    // Enforce maximum limit for safety (prevents accidental data dumps)
    const MAX_LIMIT = 100;
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const safePage = Math.max(page, 1);

    const result = await this.userService.getAllProfiles({
      page: safePage,
      limit: safeLimit,
      q,
      status,
    });
    await this.audit.logEvent({
      type: 'admin.list_profiles',
      page: safePage,
      limit: safeLimit,
    });
    return result;
  }

  @Get('admin/photo-verification-requests')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Admin: list photo verification requests across all profiles',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'approved', 'rejected', 'all'],
    example: 'pending',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({
    description: 'Photo verification queue fetched successfully',
  })
  async getPhotoVerificationQueue(
    @Query('status')
    status: 'pending' | 'approved' | 'rejected' | 'all' | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // Enforce maximum limit for safety (prevents accidental data dumps)
    const MAX_LIMIT = 100;
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const safePage = Math.max(page, 1);

    const result = await this.userService.getPhotoVerificationQueue({
      status,
      page: safePage,
      limit: safeLimit,
    });

    await this.audit.logEvent({
      type: 'admin.list_photo_verification_queue',
      status: status ?? 'pending',
      page: safePage,
      limit: safeLimit,
    });

    return result;
  }

  @Get('admin/profiles/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: get user profile by ID' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  @ApiOkResponse({ description: 'User profile fetched successfully' })
  async getProfileById(@Param('id') profileId: string) {
    const profile = await this.userService.getProfileById(profileId);
    await this.audit.logEvent({ type: 'admin.view_profile', profileId });
    return profile;
  }

  @Get('admin/profiles/:id/xp/history')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: get XP history for a user profile' })
  async adminGetXpHistory(
    @Param('id') profileId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.userService.adminGetXpHistory(profileId, page, limit);
  }

  @Post('admin/profiles/:id/xp')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: manually add XP to a user profile' })
  async adminAddXp(
    @Param('id') profileId: string,
    @Body() body: { points: number; reason: string },
    @GetCurrentUser('userId') adminId: string,
  ) {
    const result = await this.userService.adminAddXpToUser(
      profileId,
      body.points,
      adminId,
      body.reason,
    );
    await this.audit.logEvent({
      type: 'admin.add_xp',
      profileId,
      adminId,
      points: body.points,
      reason: body.reason,
    });
    return result;
  }

  @Post('admin/profiles/:id/xp/simulate')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Admin: preview enabled XP rules without awarding XP',
  })
  async adminSimulateXp(
    @Param('id') profileId: string,
    @Body() body: TriggerXpEventDto,
  ) {
    return this.userService.simulateXpForProfileEvent(
      profileId,
      body.eventKey,
      body.context ?? {},
    );
  }

  @Patch('admin/profiles/:id/xp/history/:historyId')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: correct an XP history entry' })
  async adminUpdateXpHistory(
    @Param('id') profileId: string,
    @Param('historyId') historyId: string,
    @Body() body: { points: number; reason: string },
    @GetCurrentUser('userId') adminId: string,
  ) {
    return this.userService.adminUpdateXpHistoryEntry(
      profileId,
      historyId,
      body,
      adminId,
    );
  }

  @Delete('admin/profiles/:id/xp/history/:historyId')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: delete an XP history entry' })
  async adminDeleteXpHistory(
    @Param('id') profileId: string,
    @Param('historyId') historyId: string,
    @Body() body: { reason: string },
    @GetCurrentUser('userId') adminId: string,
  ) {
    return this.userService.adminDeleteXpHistoryEntry(
      profileId,
      historyId,
      adminId,
      body.reason,
    );
  }

  @Patch('admin/:id/campaign-quota')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: update campaign creation quota for a user' })
  async adminUpdateCampaignQuota(
    @Param('id') profileId: string,
    @Body() body: { campaignQuota: number; resetToJanFirst?: boolean },
  ) {
    // body expected: { campaignQuota: number, resetToJanFirst?: boolean }
    return this.userService.adminUpdateCampaignQuota(profileId, body);
  }

  @Patch('admin/profiles/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: update any profile fields' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  @ApiBody({ type: Object })
  @ApiOkResponse({ description: 'Admin updated profile successfully' })
  async adminUpdateProfile(
    @Param('id') profileId: string,
    @Body() updates: Record<string, unknown>,
  ) {
    const before = await this.userService.getProfileById(profileId);
    const result = await this.userService.adminUpdateProfile(
      profileId,
      updates,
    );
    await this.audit.logEvent({
      type: 'admin.update_profile',
      profileId,
      before,
      updates,
    });
    return result;
  }

  @Delete('admin/profiles/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary:
      'Admin: deactivate an active user or permanently delete an inactive user',
  })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  @ApiOkResponse({
    description: 'Admin deactivated or permanently deleted the user',
  })
  async adminDeleteProfile(@Param('id') profileId: string) {
    const before = await this.userService.getProfileById(profileId);
    const result = await this.userService.adminDeleteProfile(profileId);
    await this.audit.logEvent({
      type:
        result.action === 'deactivated'
          ? 'admin.deactivate_profile'
          : 'admin.delete_profile',
      profileId,
      before,
      action: result.action,
    });
    return result;
  }

  @Patch('admin/profiles/:id/photos/verification-requests/:requestCode')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Admin: approve or reject a user photo verification request',
  })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  @ApiParam({
    name: 'requestCode',
    description: 'Photo verification request code',
  })
  @ApiBody({ type: ReviewPhotoVerificationRequestDto })
  @ApiOkResponse({
    description: 'Photo verification request reviewed successfully',
  })
  async reviewPhotoVerificationRequest(
    @Param('id') profileId: string,
    @Param('requestCode') requestCode: string,
    @Body() body: ReviewPhotoVerificationRequestDto,
    @GetCurrentUser('userId') adminId: string,
  ) {
    const result = await this.userService.reviewPhotoVerificationRequest(
      profileId,
      requestCode,
      body,
      adminId,
    );

    await this.audit.logEvent({
      type: 'admin.review_photo_verification',
      profileId,
      requestCode,
      adminId,
      status: body.status,
    });

    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get another user public profile by profile ID' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  @ApiOkResponse({
    description: 'Public profile fetched successfully',
    example: {
      _id: '6805f4a8b7a4f7d6e0f2d0d3',
      profileCompleted: true,
      firstName: 'John',
      lastName: 'Doe',
      profilePhoto: 'https://res.cloudinary.com/demo/image/upload/profile.jpg',
      bio: 'I enjoy trekking and travel planning.',
      location: 'Kathmandu',
      province: 'Bagmati',
      district: 'Kathmandu District',
      landmark: 'Near Durbar Marg',
      experienceLevel: 'beginner',
      createdAt: '2026-04-21T10:00:00.000Z',
    },
  })
  async getPublicProfile(@Param('id') profileId: string) {
    const profile = await this.userService.getPublicProfileById(profileId);
    await this.audit.logEvent({ type: 'profile.view', profileId });
    return profile;
  }
}
