'use client';

import { ExtraManager } from '@/components/extra/extra-manager';

export default function ExtraPlacesPage() {
  return (
    <ExtraManager
      category="places"
      title="Places"
      description="Create, edit, and delete place entries for the admin Extra section."
      itemLabel="Place"
    />
  );
}