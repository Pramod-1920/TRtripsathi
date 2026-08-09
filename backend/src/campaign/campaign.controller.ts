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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ApproveCampaignDto, RejectCampaignDto } from './dto/review-campaign.dto';
import {
  AddTaskDto,
  TransitionCampaignPhaseDto,
  UpdateParticipantRoleDto,
  UpdatePlanningDto,
  UpdateTaskDto,
  VerifyPlanningRejectDto,
} from './dto/lifecycle.dto';
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
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CreateCampaignDto,
    @GetCurrentUser('userId') userId: string,
    @Req() req,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.service.createCampaign(dto, userId, isAdmin);
  }

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.service.listCampaigns(Number(page), Number(limit), false, undefined, true);
  }

  @Get('admin/phase/:phase')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async adminListByLifecycle(
    @Param('phase') phase: 'draft' | 'open' | 'planning' | 'verification' | 'ready' | 'started' | 'completed' | 'cancelled',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.listCampaignsByLifecyclePhase(phase, Number(page), Number(limit));
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async adminList(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('includeFuture') includeFuture = 'true',
    @Query('approvalStatus') approvalStatus?: 'draft' | 'submitted' | 'approved' | 'rejected',
  ) {
    return this.service.listCampaigns(
      Number(page),
      Number(limit),
      includeFuture === 'true',
      approvalStatus,
    );
  }

  @Get('admin/bin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async adminBinList(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.listDeletedCampaigns(Number(page), Number(limit));
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async listMine(
    @GetCurrentUser('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.service.listUserCampaigns(
      userId,
      Number(page),
      Number(limit),
    );
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.getCampaignById(id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async joinCampaign(
    @Param('id') id: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.service.joinCampaign(id, userId);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leaveCampaign(
    @Param('id') id: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.service.leaveCampaign(id, userId);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmCampaign(
    @Param('id') id: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.service.confirmParticipation(id, userId);
  }

  @Patch(':id/participants/:participantId/role')
  @UseGuards(JwtAuthGuard)
  async updateParticipantRole(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @Body() dto: UpdateParticipantRoleDto,
    @GetCurrentUser('userId') requesterId: string,
    @Req() req,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.service.updateParticipantRole(id, participantId, dto.role, requesterId, isAdmin);
  }

  @Patch(':id/planning')
  @UseGuards(JwtAuthGuard)
  async updatePlanning(
    @Param('id') id: string,
    @Body() dto: UpdatePlanningDto,
    @GetCurrentUser('userId') requesterId: string,
    @Req() req,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.service.updatePlanning(id, dto, requesterId, isAdmin);
  }

  @Post(':id/tasks')
  @UseGuards(JwtAuthGuard)
  async addTask(
    @Param('id') id: string,
    @Body() dto: AddTaskDto,
    @GetCurrentUser('userId') requesterId: string,
    @Req() req,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.service.addTask(id, dto, requesterId, isAdmin);
  }

  @Patch(':id/tasks/:taskId')
  @UseGuards(JwtAuthGuard)
  async updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @GetCurrentUser('userId') requesterId: string,
    @Req() req,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.service.updateTask(id, taskId, dto, requesterId, isAdmin);
  }

  @Post(':id/phase-transition')
  @UseGuards(JwtAuthGuard)
  async transitionPhase(
    @Param('id') id: string,
    @Body() dto: TransitionCampaignPhaseDto,
    @GetCurrentUser('userId') requesterId: string,
    @Req() req,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.service.transitionCampaignPhase(id, dto.toPhase, requesterId, isAdmin, dto.reason);
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

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  async submit(
    @Param('id') id: string,
    @GetCurrentUser('userId') requesterId: string,
    @Req() req,
  ) {
    const isAdmin = req.user?.role === Role.Admin;
    return this.service.submitCampaign(id, requesterId, isAdmin);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  async verify(
    @Param('id') id: string,
    @Body() body: { url?: string; publicId?: string | null; caption?: string | null },
    @GetCurrentUser('userId') requesterId: string,
  ) {
    return this.service.verifyCampaignCompletion(id, requesterId, body?.url ? { url: body.url, publicId: body.publicId ?? null, caption: body.caption ?? null } : undefined);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async approve(
    @Param('id') id: string,
    @GetCurrentUser('userId') adminId: string,
    @Body() dto: ApproveCampaignDto,
  ) {
    return this.service.approveCampaign(id, adminId, dto.note);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async reject(
    @Param('id') id: string,
    @GetCurrentUser('userId') adminId: string,
    @Body() dto: RejectCampaignDto,
  ) {
    return this.service.rejectCampaign(id, adminId, dto.reason);
  }

  @Post(':id/verification/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async approveVerification(
    @Param('id') id: string,
    @GetCurrentUser('userId') adminId: string,
    @Body() dto: ApproveCampaignDto,
  ) {
    return this.service.approvePlanningVerification(id, adminId, dto.note);
  }

  @Post(':id/verification/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async rejectVerification(
    @Param('id') id: string,
    @GetCurrentUser('userId') adminId: string,
    @Body() dto: VerifyPlanningRejectDto,
  ) {
    return this.service.rejectPlanningVerification(id, adminId, dto.reason);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteCampaign(
    @Param('id') id: string,
    @GetCurrentUser('userId') requesterId: string,
    @Req() req,
    @Query('reason') reason?: string,
  ) {
    if (req.user?.role === Role.Admin) {
      return this.service.adminDeleteCampaign(
        id,
        requesterId,
        reason,
        this.userModel,
      );
    }
    return this.service.deleteOwnCampaign(id, requesterId);
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async restoreDeleted(
    @Param('id') id: string,
    @GetCurrentUser('userId') adminId: string,
  ) {
    return this.service.restoreDeletedCampaign(id, adminId);
  }

  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async permanentDelete(
    @Param('id') id: string,
    @GetCurrentUser('userId') adminId: string,
    @Query('reason') reason?: string,
  ) {
    return this.service.hardDeleteCampaign(id, adminId, reason);
  }
}
