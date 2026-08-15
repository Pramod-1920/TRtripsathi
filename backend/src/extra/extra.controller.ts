import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { CreateExtraDto } from './dto/create-extra.dto';
import { BulkSeedPlacesDto, PatchPlacesDto } from './dto/places.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';
import { ExtraCategory } from './constants/extra-category.enum';
import { ExtraService } from './extra.service';
import { PlacesService } from './places.service';
import { XP_EVENT_CATALOG } from './constants/xp-event-catalog';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('extra')
@Controller('extra')
export class ExtraController {
  constructor(
    private readonly extraService: ExtraService,
    private readonly placesService: PlacesService,
    private readonly audit: AuditService,
  ) {}

  // PUBLIC ENDPOINTS (no auth required)
  @Get('places')
  @ApiOperation({
    summary: 'Get places hierarchy (public - for user dropdowns)',
  })
  @ApiOkResponse({ description: 'Places hierarchy fetched successfully' })
  async getPublicPlaces() {
    const result = await this.extraService.getPlaceCatalog();
    return result;
  }

  @Get('activities')
  @ApiOperation({
    summary: 'Get enabled activity categories and subcategories (public)',
  })
  @ApiOkResponse({ description: 'Activity catalog fetched successfully' })
  getPublicActivities() {
    return this.extraService.getPublicActivities();
  }

  // ADMIN ENDPOINTS (require auth)
  @Get('xp/events')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: list registered XP reward triggers' })
  getXpEventCatalog() {
    return { items: XP_EVENT_CATALOG };
  }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: create an extra item' })
  @ApiOkResponse({ description: 'Extra item created successfully' })
  create(@Body() dto: CreateExtraDto) {
    return this.extraService.createExtra(dto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: list extra items' })
  @ApiQuery({ name: 'category', required: false, enum: ExtraCategory })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ description: 'Extra items fetched successfully' })
  list(
    @Query('category') category?: ExtraCategory,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.extraService.listExtras({
      category,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('places/hierarchy')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Admin: get places hierarchy (province + district + municipality)',
  })
  @ApiQuery({ name: 'includeDeleted', required: false, example: false })
  @ApiOkResponse({ description: 'Places hierarchy fetched successfully' })
  getPlacesHierarchy(@Query('includeDeleted') includeDeleted = 'false') {
    const shouldIncludeDeleted =
      includeDeleted === 'true' || includeDeleted === '1';
    return this.placesService.getHierarchy({
      includeDeleted: shouldIncludeDeleted,
    });
  }

  @Post('places/bulk-seed')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Admin: replace full places hierarchy via bulk seed',
  })
  @ApiBody({ type: BulkSeedPlacesDto })
  @ApiOkResponse({ description: 'Places hierarchy seeded successfully' })
  async bulkSeedPlaces(
    @Body() dto: BulkSeedPlacesDto,
    @CurrentUser('userId') actorId: string,
  ) {
    const result = await this.placesService.bulkSeed(dto);
    await this.audit.logEvent({
      type: 'places.bulk_seeded',
      actorId,
      provinceCount: dto.provinces.length,
    });
    return result;
  }

  @Patch('places')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Admin: patch places hierarchy with atomic operations',
  })
  @ApiBody({ type: PatchPlacesDto })
  @ApiOkResponse({ description: 'Places hierarchy updated successfully' })
  async patchPlaces(
    @Body() dto: PatchPlacesDto,
    @CurrentUser('userId') actorId: string,
  ) {
    const result = await this.placesService.patchHierarchy(dto.operations);
    await this.audit.logEvent({
      type: 'places.hierarchy_changed',
      actorId,
      operationCount: dto.operations.length,
      operations: dto.operations.map((operation) => operation.type),
    });
    return result;
  }

  @Get('difficulty')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: get difficulty configuration list' })
  @ApiOkResponse({ description: 'Difficulty list fetched successfully' })
  getDifficulties() {
    return this.extraService.getDifficulties();
  }

  @Put('difficulty')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Admin: replace full difficulty configuration list',
  })
  @ApiOkResponse({ description: 'Difficulty list saved successfully' })
  saveDifficulties(@Body() body: unknown) {
    return this.extraService.saveDifficulties(body);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: get extra item by id' })
  @ApiParam({ name: 'id', description: 'Extra item id' })
  @ApiOkResponse({ description: 'Extra item fetched successfully' })
  get(@Param('id') id: string) {
    return this.extraService.getExtraById(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: update extra item' })
  @ApiParam({ name: 'id', description: 'Extra item id' })
  @ApiOkResponse({ description: 'Extra item updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateExtraDto) {
    return this.extraService.updateExtra(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Admin: delete extra item' })
  @ApiParam({ name: 'id', description: 'Extra item id' })
  @ApiOkResponse({ description: 'Extra item deleted successfully' })
  delete(@Param('id') id: string) {
    return this.extraService.deleteExtra(id);
  }
}
