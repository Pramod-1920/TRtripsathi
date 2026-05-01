'use client';

import { ExtraManager } from '@/components/extra/extra-manager';

export default function ExtraActivitiesPage() {
  return (
    <ExtraManager
      category="activities"
      title="Activities"
      description="Create, edit, and delete campaign activities used by campaign creation."
      itemLabel="Activity"
      showValueField={false}
      showDescriptionField={false}
    />
  );
}
