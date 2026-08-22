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
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  /**
   * Create a new review for a trip participant
   */
  @Post('trips/:tripId/users/:revieweeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review for a trip participant' })
  async createReview(
    @Param('tripId') tripId: string,
    @Param('revieweeId') revieweeId: string,
    @Body() createDto: CreateReviewDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reviewService.createReview(
      tripId,
      userId,
      revieweeId,
      createDto,
    );
  }

  /**
   * Get all reviews received by a user
   */
  @Get('users/:userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reviews received by a user' })
  async getReviewsForUser(
    @Param('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.reviewService.getReviewsForUser(
      userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Get review statistics for a user
   */
  @Get('users/:userId/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review statistics for a user' })
  async getReviewStats(@Param('userId') userId: string) {
    return this.reviewService.getReviewStats(userId);
  }

  /**
   * Get reviews given by a user (for transparency/audit)
   */
  @Get('given-by/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reviews given by a user' })
  async getReviewsGivenByUser(
    @Param('userId') userId: string,
    @CurrentUser('userId') currentUserId: string,
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    // Users can only see their own given reviews, admin can see all
    if (user.role !== 'admin') {
      const currentUserProfileId =
        await this.reviewService.getUserProfileIdFromAuthId(currentUserId);
      if (currentUserProfileId !== userId) {
        throw new UnauthorizedException('Unauthorized');
      }
    }

    return this.reviewService.getReviewsGivenByUser(
      userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Get all reviews for a specific trip
   */
  @Get('trips/:tripId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reviews for a trip' })
  async getReviewsForTrip(@Param('tripId') tripId: string) {
    return this.reviewService.getReviewsForTrip(tripId);
  }

  /**
   * Get all reviews (admin only)
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reviews (admin only)' })
  async getAllReviews(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('sort') sort = undefined,
    @Query('reviewerId') reviewerId = undefined,
    @Query('revieweeId') revieweeId = undefined,
    @Query('tripId') tripId = undefined,
  ) {
    return this.reviewService.getAllReviews(parseInt(page), parseInt(limit), {
      sort,
      reviewerId,
      revieweeId,
      tripId,
    });
  }

  /**
   * Update a review
   */
  @Patch(':reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a review' })
  async updateReview(
    @Param('reviewId') reviewId: string,
    @Body() updateDto: UpdateReviewDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user?.role === Role.Admin || false;
    return this.reviewService.updateReview(
      reviewId,
      userId,
      updateDto,
      isAdmin,
    );
  }

  /**
   * Delete a review
   */
  @Delete(':reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review' })
  async deleteReview(
    @Param('reviewId') reviewId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user?.role === Role.Admin || false;
    await this.reviewService.deleteReview(reviewId, userId, isAdmin);
    return { message: 'Review deleted successfully' };
  }
}
