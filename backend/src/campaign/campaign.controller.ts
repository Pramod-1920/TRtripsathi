import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Param,
  Patch,
  Delete,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';

@Controller('campaigns')
export class CampaignController {
  constructor(
    private readonly service: CampaignService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateCampaignDto,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.service.createCampaign(dto, userId);
  }

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.service.listCampaigns(Number(page), Number(limit));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.getCampaignById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @GetCurrentUser('userId') userId: string,
    @Req() req,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.service.updateCampaign(id, dto, userId, isAdmin);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async adminDelete(
    @Param('id') id: string,
    @GetCurrentUser('userId') adminId: string,
    @Query('reason') reason?: string,
  ) {
    return this.service.adminDeleteCampaign(
      id,
      adminId,
      reason,
      this.userModel,
    );
  }
}
