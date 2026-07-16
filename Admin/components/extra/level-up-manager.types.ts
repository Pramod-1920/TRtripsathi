export type LevelUpValuePayload = {
  requiredXp: number;
  minLevel?: number;
  maxLevel?: number;
  subRanks?: string[];
  displayName?: string;
  title?: string;
  feeling?: string;
  requireRank?: string;
  hidden?: boolean;
  requirements?: Record<string, number>;
};

export type LevelUpFormState = {
  rankCode: string;
  displayName: string;
  title: string;
  feeling: string;
  requiredXp: string;
  minLevel: string;
  maxLevel: string;
  subRanks: string;
  requireRank: string;
  activityRequirements: Record<string, string>;
  hidden: boolean;
  enabled: boolean;
};
