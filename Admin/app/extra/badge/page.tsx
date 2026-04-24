'use client';

import { ExtraManager } from '@/components/extra/extra-manager';

export default function ExtraBadgePage() {
  return (
    <ExtraManager
      category="badge"
      title="Badge"
      description="Create, edit, and delete badge entries for the admin Extra section."
      itemLabel="Badge"
    />
  );
}