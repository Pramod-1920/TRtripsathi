import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { TripService } from './trip.service';
import {
  CreateTripDto,
  UpdateTripDto,
  JoinTripDto,
  CheckinTripDto,
  ApproveParticipantDto,
  ConfirmCompletionDto,
} from './dto/create-trip.dto';
import { AuditService } from '../audit/audit.service';

@ApiTags('Trips')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripController {
  constructor(
    private readonly tripService: TripService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new trip' })
  @ApiBody({ type: CreateTripDto })
  @ApiCreatedResponse({ description: 'Trip created successfully' })
  async createTrip(
    @Body() createTripDto: CreateTripDto,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.tripService.createTrip(createTripDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all trips with optional filters' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, example: 'upcoming' })
  @ApiQuery({ name: 'activityType', required: false, example: 'hike' })
  @ApiQuery({ name: 'difficulty', required: false, example: 'moderate' })
  @ApiQuery({ name: 'province', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({
    name: 'lng',
    required: false,
    description: 'User longitude for geospatial search',
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    description: 'User latitude for geospatial search',
  })
  @ApiQuery({
    name: 'maxDistance',
    required: false,
    description: 'Max distance in meters (default 50000)',
  })
  @ApiOkResponse({ description: 'Trips list retrieved successfully' })
  async listTrips(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('activityType') activityType?: string,
    @Query('difficulty') difficulty?: string,
    @Query('province') province?: string,
    @Query('district') district?: string,
    @Query('lng') lng?: string,
    @Query('lat') lat?: string,
    @Query('maxDistance') maxDistance?: string,
  ) {
    return this.tripService.listTrips({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      activityType,
      difficulty,
      province,
      district,
      lng: lng ? Number(lng) : undefined,
      lat: lat ? Number(lat) : undefined,
      maxDistance: maxDistance ? Number(maxDistance) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trip details' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiOkResponse({ description: 'Trip details retrieved successfully' })
  async getTrip(@Param('id') tripId: string) {
    return this.tripService.getTrip(tripId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update trip (host or admin only)' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: UpdateTripDto })
  @ApiOkResponse({ description: 'Trip updated successfully' })
  async updateTrip(
    @Param('id') tripId: string,
    @Body() updateTripDto: UpdateTripDto,
    @GetCurrentUser('userId') userId: string,
    @Req() req: any,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.tripService.updateTrip(tripId, updateTripDto, userId, isAdmin);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Delete trip (admin only)' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiOkResponse({ description: 'Trip deleted successfully' })
  async deleteTrip(
    @Param('id') tripId: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.tripService.deleteTrip(tripId, userId, true);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a trip' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: JoinTripDto })
  @ApiOkResponse({
    description: 'Successfully joined trip or added to waitlist',
  })
  async joinTrip(
    @Param('id') tripId: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.tripService.joinTrip(tripId, userId);
  }

  @Post(':id/checkin')
  @ApiOperation({ summary: 'Check in to an ongoing trip' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiOkResponse({ description: 'Check-in recorded successfully' })
  async checkIn(
    @Param('id') tripId: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.tripService.checkIn(tripId, userId);
  }

  @Get(':id/participants')
  @ApiOperation({ summary: 'List trip participants' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ description: 'Trip participants retrieved successfully' })
  async getParticipants(
    @Param('id') tripId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tripService.getParticipants(
      tripId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Patch(':id/participants/:userId/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Approve/reject/remove a trip participant (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiBody({ type: ApproveParticipantDto })
  @ApiOkResponse({ description: 'Participant status updated successfully' })
  async approveParticipant(
    @Param('id') tripId: string,
    @Param('userId') userId: string,
    @Body() approveDto: ApproveParticipantDto,
    @GetCurrentUser('userId') adminId: string,
  ) {
    return this.tripService.approveParticipant(
      tripId,
      userId,
      approveDto,
      adminId,
    );
  }

  @Post(':id/confirm-completion')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Confirm trip completion for participants (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: ConfirmCompletionDto })
  @ApiOkResponse({ description: 'Trip completion confirmed' })
  async confirmCompletion(
    @Param('id') tripId: string,
    @Body() confirmDto: ConfirmCompletionDto,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.tripService.confirmCompletion(tripId, confirmDto, userId);
  }
}
