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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { CreateExtraDto } from './dto/create-extra.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';
import { ExtraCategory } from './constants/extra-category.enum';
import { ExtraService } from './extra.service';

@ApiTags('extra')
@Controller('extra')
export class ExtraController {
  constructor(private readonly extraService: ExtraService) {}

  // PUBLIC ENDPOINTS (no auth required)
  @Get('places')
  @ApiOperation({ summary: 'Get places hierarchy (public - for user dropdowns)' })
  @ApiOkResponse({ description: 'Places hierarchy fetched successfully' })
  async getPublicPlaces() {
    const result = await this.extraService.getPlaceCatalog();
    return result;
  }

  // ADMIN ENDPOINTS (require auth)
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
  @ApiOperation({ summary: 'Admin: get places hierarchy (province + district + place)' })
  @ApiQuery({ name: 'includeDisabled', required: false, example: false })
  @ApiOkResponse({ description: 'Places hierarchy fetched successfully' })
  getPlacesHierarchy(@Query('includeDisabled') includeDisabled = 'false') {
    const shouldIncludeDisabled = includeDisabled === 'true' || includeDisabled === '1';
    return this.extraService.getPlaceHierarchy({ includeDisabled: shouldIncludeDisabled });
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