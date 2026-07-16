import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveCampaignDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

export class RejectCampaignDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
