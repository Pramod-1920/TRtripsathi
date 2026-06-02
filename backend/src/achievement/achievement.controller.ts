import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AchievementService } from './achievement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
} from './dto/achievement.dto';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementController {
  constructor(private achievementService: AchievementService) {}

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ADMIN ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new achievement definition (admin only)' })
  async createAchievement(
    @Body() createDto: CreateAchievementDto,
    @CurrentUser('userId') userId: string,
  ) {
    // service expects a Types.ObjectId for admin id
    const adminIdObj = new Types.ObjectId(userId);
    return this.achievementService.createAchievement(createDto, adminIdObj);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all achievements with filters' })
  async listAchievements(
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.achievementService.listAchievements(
      category,
      isActiveBool,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single achievement definition' })
  async getAchievementById(@Param('id') id: string) {
    return this.achievementService.getAchievementById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an achievement definition (admin only)' })
  async updateAchievement(
    @Param('id') id: string,
    @Body() updateDto: UpdateAchievementDto,
  ) {
    return this.achievementService.updateAchievement(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an achievement definition (admin only)' })
  async deleteAchievement(@Param('id') id: string) {
    await this.achievementService.deleteAchievement(id);
    return { message: 'Achievement deleted successfully' };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // USER ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('users/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all achievements for a user with progress' })
  async getUserAchievements(@Param('userId') userId: string) {
    return this.achievementService.getUserAchievements(userId);
  }

  @Get('users/:userId/:achievementId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get specific achievement progress for a user' })
  async getUserAchievementProgress(
    @Param('userId') userId: string,
    @Param('achievementId') achievementId: string,
  ) {
    return this.achievementService.getUserAchievementProgress(
      userId,
      achievementId,
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ADMIN: USER ACHIEVEMENT MANAGEMENT
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Post('admin/users/:userId/reset/:achievementId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Manually reset a user achievement progress (admin only)',
  })
  async resetUserAchievement(
    @Param('userId') userId: string,
    @Param('achievementId') achievementId: string,
  ) {
    return this.achievementService.resetUserAchievement(
      userId,
      achievementId,
    );
  }

  @Get('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all achievement categories (admin only)' })
  async getCategories() {
    return {
      categories: [
        'exploration',
        'hosting',
        'skill',
        'social',
        'special',
      ],
    };
  }
}

