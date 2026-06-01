import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RankUpAchievementService } from './rank-up-achievement.service';
import {
  CreateRankUpAchievementDto,
  UpdateRankUpAchievementDto,
  RankUpAchievementResponseDto,
  RankUpValidationResponseDto,
  RankCode,
} from './dto/rank-up-achievement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';

@ApiTags('rank-up-achievements')
@Controller('rank-up-achievements')
export class RankUpAchievementController {
  constructor(private rankUpAchievementService: RankUpAchievementService) {}

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ADMIN ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * POST /rank-up-achievements
   * Create a new rank-up achievement (Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new rank-up achievement definition (admin only)' })
  async create(
    @Body() createDto: CreateRankUpAchievementDto,
    @CurrentUser('userId') userId: string,
  ): Promise<RankUpAchievementResponseDto> {
    return this.rankUpAchievementService.create(createDto, userId);
  }

  /**
   * PATCH /rank-up-achievements/:id
   * Update a rank-up achievement (Admin only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a rank-up achievement definition (admin only)' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRankUpAchievementDto,
  ): Promise<RankUpAchievementResponseDto> {
    return this.rankUpAchievementService.update(id, updateDto);
  }

  /**
   * DELETE /rank-up-achievements/:id
   * Delete a rank-up achievement (Admin only)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a rank-up achievement definition (admin only)' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.rankUpAchievementService.delete(id);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // USER ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * GET /rank-up-achievements
   * Get all rank-up achievements with optional filters
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all rank-up achievements with optional filters' })
  async findAll(
    @Query('targetRank') targetRank?: RankCode,
    @Query('activityType') activityType?: string,
    @Query('isActive') isActive?: string,
  ): Promise<RankUpAchievementResponseDto[]> {
    return this.rankUpAchievementService.findAll({
      targetRank,
      activityType,
      isActive: isActive === 'true',
    });
  }

  /**
   * GET /rank-up-achievements/rank/:targetRank
   * Get all achievements required for a specific rank
   */
  @Get('rank/:targetRank')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get rank-up requirements for a specific rank' })
  async findByRank(@Param('targetRank') targetRank: RankCode): Promise<RankUpAchievementResponseDto[]> {
    return this.rankUpAchievementService.findByRank(targetRank);
  }

  /**
   * GET /rank-up-achievements/activity/:activityType
   * Get achievements linked to a specific activity type
   */
  @Get('activity/:activityType')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get rank-up achievements for a specific activity' })
  async findByActivityType(@Param('activityType') activityType: string): Promise<RankUpAchievementResponseDto[]> {
    return this.rankUpAchievementService.findByActivityType(activityType);
  }

  /**
   * GET /rank-up-achievements/code/:code
   * Get a specific achievement by code
   */
  @Get('code/:code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific rank-up achievement by code' })
  async findByCode(@Param('code') code: string): Promise<RankUpAchievementResponseDto> {
    return this.rankUpAchievementService.findByCode(code);
  }

  /**
   * GET /rank-up-achievements/:id
   * Get a specific achievement by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific rank-up achievement by ID' })
  async findById(@Param('id') id: string): Promise<RankUpAchievementResponseDto> {
    return this.rankUpAchievementService.findById(id);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // USER PROGRESS ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * GET /rank-up-achievements/validate/:targetRank
   * Check if current user meets rank-up requirements
   */
  @Get('validate/:targetRank')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate if user can rank up to target rank' })
  async validateRankUp(
    @Param('targetRank') targetRank: RankCode,
    @CurrentUser('userId') userId: string,
  ): Promise<RankUpValidationResponseDto> {
    return this.rankUpAchievementService.validateRankUp(userId, targetRank);
  }

  /**
   * GET /rank-up-achievements/user/progress
   * Get all rank-up progress for current user
   */
  @Get('user/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get rank-up progress for all ranks' })
  async getUserProgress(@CurrentUser('userId') userId: string): Promise<RankUpValidationResponseDto[]> {
    return this.rankUpAchievementService.getUserRankUpProgress(userId);
  }
}


