import { IsInt, Min, IsOptional } from 'class-validator';

export class AdminUpdateCampaignQuotaDto {
  @IsInt()
  @Min(0)
  campaignQuota!: number;

  @IsOptional()
  resetToJanFirst?: boolean;
}
