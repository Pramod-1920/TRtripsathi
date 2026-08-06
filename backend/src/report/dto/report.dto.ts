import { IsString, IsEnum, MinLength, MaxLength, IsOptional } from 'class-validator';

export const reportCategories = ['feedback', 'report'] as const;
export const reportStatuses = ['open', 'investigating', 'resolved', 'dismissed'] as const;
export const reportTargetTypes = ['user', 'trip'] as const;
export const feedbackReasons = ['bug', 'feature_request', 'general_feedback', 'other'] as const;
export const playerReportReasons = [
  'harassment',
  'spam',
  'inappropriate_content',
  'safety_concern',
  'fraud',
  'other',
] as const;

export class CreateReportDto {
  @IsEnum(reportTargetTypes)
  targetType: string;

  @IsEnum(playerReportReasons)
  reason: string;

  @IsString()
  @MinLength(20)
  @MaxLength(500)
  description: string;
}

export class CreateFeedbackDto {
  @IsEnum(feedbackReasons)
  reason: string;

  @IsString()
  @MinLength(20)
  @MaxLength(500)
  description: string;
}

export class UpdateReportStatusDto {
  @IsEnum(reportStatuses)
  status: string;

  @IsOptional()
  @IsString()
  resolution?: string;
}

export class AssignReportDto {
  @IsString()
  moderatorId: string;
}

export class ReportResponseDto {
  _id: string;
  reporterId: string;
  category: string;
  targetId?: string;
  targetType?: string;
  reason: string;
  description: string;
  status: string;
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ReportStatsDto {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  topReasons: {
    reason: string;
    count: number;
  }[];
  byCategory: {
    feedback: number;
    report: number;
  };
}
