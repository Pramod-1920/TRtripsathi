'use client';

import { ExtraManager } from '@/components/extra/extra-manager';

export default function ExtraDifficultyPage() {
  return (
    <ExtraManager
      category="difficulty"
      title="Difficulty"
      description="Create, edit, and delete difficulty entries for the admin Extra section."
      itemLabel="Difficulty"
      showValueField={false}
      showDescriptionField={false}
    />
  );
}