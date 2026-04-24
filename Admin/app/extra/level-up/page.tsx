'use client';

import { ExtraManager } from '@/components/extra/extra-manager';

export default function ExtraLevelUpPage() {
  return (
    <ExtraManager
      category="level-up"
      title="Level Up"
      description="Create rank progression rules. Use Name for rank title, Value for required level, and Description for required activities."
      itemLabel="Rank Rule"
      valueLabel="Required Level"
      valuePlaceholder="e.g. 5"
      descriptionLabel="Required Activities"
      descriptionPlaceholder="Describe requirements (trek, hike, new places, temples, lakes, etc.)"
      valueColumnLabel="Required Level"
    />
  );
}