import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { UserService } from './user.service';

@ApiTags('User')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

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

  @Get('search')
  @ApiOperation({ summary: 'Search public user profiles' })
  @ApiQuery({ name: 'q', required: false, example: 'john' })
  @ApiQuery({ name: 'experienceLevel', required: false, example: 'beginner' })
  @ApiQuery({ name: 'province', required: false, example: 'Bagmati' })
  @ApiQuery({ name: 'district', required: false, example: 'Kathmandu District' })
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
          profilePhoto: 'https://res.cloudinary.com/demo/image/upload/profile.jpg',
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
  @ApiOperation({ summary: 'Admin: list all profiles with pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({ description: 'Admin profiles list fetched successfully' })
  async getAllProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.userService.getAllProfiles({ page, limit: Math.min(limit, 50) });
  }

  @Get('admin/profiles/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: get profile by ID' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  @ApiOkResponse({ description: 'Admin profile fetched successfully' })
  async getProfileById(@Param('id') profileId: string) {
    return this.userService.getProfileById(profileId);
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
    return this.userService.adminUpdateProfile(profileId, updates);
  }

  @Delete('admin/profiles/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: delete any profile and linked auth account' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  @ApiOkResponse({ description: 'Admin deleted profile successfully' })
  async adminDeleteProfile(@Param('id') profileId: string) {
    return this.userService.adminDeleteProfile(profileId);
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
    return this.userService.getPublicProfileById(profileId);
  }
}
