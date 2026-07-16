import { IsString, IsEnum, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateReportDto {
  @IsEnum(['user', 'trip'])
  targetType: string;

  @IsEnum([
    'harassment',
    'spam',
    'inappropriate_content',
    'safety_concern',
    'fraud',
    'other',
  ])
  reason: string;

  @IsString()
  @MinLength(20)
  @MaxLength(500)
  description: string;
}

export class UpdateReportStatusDto {
  @IsEnum(['open', 'investigating', 'resolved', 'dismissed'])
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
  targetId: string;
  targetType: string;
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
  totalReports: number;
  openReports: number;
  investigatingReports: number;
  resolvedReports: number;
  dismissedReports: number;
  topReasons: {
    reason: string;
    count: number;
  }[];
}
