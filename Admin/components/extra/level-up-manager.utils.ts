import type { ExtraItem } from '@/lib/extras';
import type { LevelUpFormState, LevelUpValuePayload } from './level-up-manager.types';

export function getDefaultLevelUpFormState(): LevelUpFormState {
  return {
    rankCode: '',
    displayName: '',
    title: '',
    feeling: '',
    requiredXp: '',
    minLevel: '',
    maxLevel: '',
    subRanks: '',
    requireRank: '',
    activityRequirements: {},
    hidden: false,
    enabled: true,
  };
}

export function parseLevelUpValue(rawValue?: string | null): LevelUpValuePayload | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<LevelUpValuePayload>;
    const requiredXp = Number(parsed.requiredXp);

    if (!Number.isFinite(requiredXp)) {
      return null;
    }

    return {
      requiredXp,
      ...(parsed.minLevel !== undefined ? { minLevel: Number(parsed.minLevel) } : {}),
      ...(parsed.maxLevel !== undefined ? { maxLevel: Number(parsed.maxLevel) } : {}),
      ...(Array.isArray(parsed.subRanks)
        ? { subRanks: parsed.subRanks.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0) }
        : typeof parsed.subRanks === 'string'
          ? {
              subRanks: String(parsed.subRanks)
                .split(',')
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0),
            }
          : {}),
      ...(parsed.displayName ? { displayName: String(parsed.displayName) } : {}),
      ...(parsed.title ? { title: String(parsed.title) } : {}),
      ...(parsed.feeling ? { feeling: String(parsed.feeling) } : {}),
      ...(parsed.requireRank ? { requireRank: String(parsed.requireRank) } : {}),
      ...(parsed.hidden ? { hidden: true } : {}),
      ...(parsed.requirements ? { requirements: parsed.requirements } : {}),
    };
  } catch {
    const requiredXp = Number(rawValue);

    if (!Number.isFinite(requiredXp)) {
      return null;
    }

    return { requiredXp };
  }
}

export function buildLevelUpValue(form: LevelUpFormState, activityKeys?: string[]) {
  const requiredXp = Number(form.requiredXp);

  if (!Number.isFinite(requiredXp) || requiredXp < 0) {
    throw new Error('Required XP must be a number greater than or equal to 0.');
  }

  const requirements: LevelUpValuePayload['requirements'] = {};

  const minLevel = Number(form.minLevel);
  const maxLevel = Number(form.maxLevel);

  if (form.minLevel.trim()) {
    if (!Number.isFinite(minLevel) || minLevel < 1 || minLevel > 100) {
      throw new Error('Minimum level must be between 1 and 100.');
    }
  }

  if (form.maxLevel.trim()) {
    if (!Number.isFinite(maxLevel) || maxLevel < 1 || maxLevel > 100) {
      throw new Error('Maximum level must be between 1 and 100.');
    }
  }

  if (
    form.minLevel.trim()
    && form.maxLevel.trim()
    && minLevel > maxLevel
  ) {
    throw new Error('Minimum level cannot be greater than maximum level.');
  }

  const subRanks = form.subRanks
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const allowedKeys = new Set(activityKeys ?? Object.keys(form.activityRequirements ?? {}));

  for (const [key, rawValue] of Object.entries(form.activityRequirements ?? {})) {
    if (!allowedKeys.has(key)) {
      continue;
    }

    const value = Number(rawValue);
    if (Number.isFinite(value) && value > 0) {
      requirements[key] = Math.floor(value);
    }
  }

  const payload: LevelUpValuePayload = {
    requiredXp: Math.floor(requiredXp),
    ...(form.minLevel.trim() ? { minLevel: Math.floor(minLevel) } : {}),
    ...(form.maxLevel.trim() ? { maxLevel: Math.floor(maxLevel) } : {}),
    ...(subRanks.length > 0 ? { subRanks } : {}),
    ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
    ...(form.title.trim() ? { title: form.title.trim() } : {}),
    ...(form.feeling.trim() ? { feeling: form.feeling.trim() } : {}),
    ...(form.requireRank.trim() ? { requireRank: form.requireRank.trim() } : {}),
    ...(form.hidden ? { hidden: true } : {}),
    ...(Object.keys(requirements).length > 0 ? { requirements } : {}),
  };

  return JSON.stringify(payload);
}

export function buildLevelUpEditForm(item: ExtraItem): LevelUpFormState {
  const parsed = parseLevelUpValue(item.value);

  return {
    rankCode: item.name ?? '',
    displayName: parsed?.displayName ?? parsed?.title ?? '',
    title: parsed?.title ?? '',
    feeling: parsed?.feeling ?? '',
    requiredXp: parsed?.requiredXp !== undefined ? String(parsed.requiredXp) : '',
    minLevel: parsed?.minLevel !== undefined ? String(parsed.minLevel) : '',
    maxLevel: parsed?.maxLevel !== undefined ? String(parsed.maxLevel) : '',
    subRanks: Array.isArray(parsed?.subRanks) ? parsed.subRanks.join(', ') : '',
    requireRank: parsed?.requireRank ?? '',
    activityRequirements: Object.fromEntries(
      Object.entries(parsed?.requirements ?? {}).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
    hidden: parsed?.hidden ?? false,
    enabled: item.enabled !== false,
  };
}

export function formatLevelUpRequirements(requirements?: LevelUpValuePayload['requirements']) {
  if (!requirements) {
    return '-';
  }

  const formatted = Object.entries(requirements)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  return formatted || '-';
}
