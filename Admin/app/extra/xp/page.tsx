'use client';

import { ExtraManager } from '@/components/extra/extra-manager';

export default function ExtraXpPage() {
  return (
    <ExtraManager
      category="xp"
      title="XP"
      description="Create, edit, and delete XP entries for the admin Extra section."
      itemLabel="XP entry"
    />
  );
}