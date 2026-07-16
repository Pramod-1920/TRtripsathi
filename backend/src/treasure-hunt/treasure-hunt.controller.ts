import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { TreasureHuntService } from './treasure-hunt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';
import {
  CreateTreasureHuntDto,
  UpdateTreasureHuntDto,
  VerifyWaypointDto,
} from './dto/treasure-hunt.dto';

@ApiTags('treasure-hunts')
@Controller('treasure-hunts')
export class TreasureHuntController {
  constructor(private treasureHuntService: TreasureHuntService) {}

  /**
   * Create a treasure hunt (admin/trip organizer)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a treasure hunt' })
  async createTreasureHunt(
    @Body() dto: CreateTreasureHuntDto,
    @CurrentUser() user: any,
  ) {
    return this.treasureHuntService.createTreasureHunt(
      user._id.toString(),
      dto.name,
      dto.waypoints,
      dto.difficulty,
      dto.startDate,
      dto.endDate,
      dto.description,
      dto.tripId,
      dto.estimatedDurationMinutes,
      dto.xpReward,
    );
  }

  /**
   * Get all active treasure hunts
   */
  @Get()
  @ApiOperation({ summary: 'Get all active treasure hunts' })
  async getActiveTreasureHunts(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.treasureHuntService.getActiveTreasureHunts(
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Get treasure hunt by ID
   */
  @Get(':huntId')
  @ApiOperation({ summary: 'Get treasure hunt details' })
  async getTreasureHunt(@Param('huntId') huntId: string) {
    return this.treasureHuntService.getTreasureHunt(huntId);
  }

  /**
   * Get treasure hunts for a trip
   */
  @Get('trip/:tripId')
  @ApiOperation({ summary: 'Get treasure hunts for a trip' })
  async getTreasureHuntsByTrip(@Param('tripId') tripId: string) {
    return this.treasureHuntService.getTreasureHuntsByTrip(tripId);
  }

  /**
   * Update treasure hunt
   */
  @Patch(':huntId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update treasure hunt' })
  async updateTreasureHunt(
    @Param('huntId') huntId: string,
    @Body() dto: UpdateTreasureHuntDto,
    @CurrentUser() user: any,
  ) {
    return this.treasureHuntService.updateTreasureHunt(
      huntId,
      dto,
      user._id.toString(),
    );
  }

  /**
   * Verify waypoint (geospatial check)
   */
  @Post(':huntId/verify-waypoint')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify waypoint location' })
  async verifyWaypoint(
    @Param('huntId') huntId: string,
    @Body() dto: VerifyWaypointDto,
    @CurrentUser() user: any,
  ) {
    return this.treasureHuntService.verifyWaypoint(
      huntId,
      user._id.toString(),
      dto.waypointOrder,
      dto.userLatitude,
      dto.userLongitude,
    );
  }

  /**
   * Get user's progress on a hunt
   */
  @Get(':huntId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get your progress on a hunt' })
  async getUserProgress(
    @Param('huntId') huntId: string,
    @CurrentUser() user: any,
  ) {
    return this.treasureHuntService.getUserProgress(
      huntId,
      user._id.toString(),
    );
  }

  /**
   * Get leaderboard for a hunt
   */
  @Get(':huntId/leaderboard')
  @ApiOperation({ summary: 'Get treasure hunt leaderboard' })
  async getLeaderboard(
    @Param('huntId') huntId: string,
    @Query('limit') limit = '50',
  ) {
    return this.treasureHuntService.getTreasureHuntLeaderboard(
      huntId,
      parseInt(limit),
    );
  }

  /**
   * Get all user's treasure hunt progress
   */
  @Get('user/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get your treasure hunt progress' })
  async getUserTreasureProgress(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.treasureHuntService.getUserTreasureProgress(
      user._id.toString(),
      parseInt(page),
      parseInt(limit),
    );
  }
}
