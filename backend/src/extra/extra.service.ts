import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtraCategory } from './constants/extra-category.enum';
import { CreateExtraDto } from './dto/create-extra.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';
import { PlacesService } from './places.service';
import { ExtraItem } from './schemas/extra.schema';

function normalizeText(value?: string | null) {
  return value?.trim() || null;
}

export type DifficultyTier = {
  id: string;
  label: string;
  adminApprovalRequired: boolean;
  xpMultiplier: number;
  order: number;
  enabled: boolean;
};

type DifficultyValidationError = {
  index: number;
  field: keyof DifficultyTier | 'root';
  message: string;
};

@Injectable()
export class ExtraService {
  constructor(
    @InjectModel(ExtraItem.name) private readonly extraModel: Model<ExtraItem>,
    private readonly placesService: PlacesService,
  ) {}

  private async generateExtraCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    for (let index = 0; index < 6; index += 1) {
      const randomIndex = Math.floor(Math.random() * alphabet.length);
      code += alphabet[randomIndex];
    }

    return `EXT-${code}`;
  }

  private async createUniqueExtraCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const extraCode = await this.generateExtraCode();
      const existing = await this.extraModel.exists({ extraCode });
      if (!existing) {
        return extraCode;
      }
    }

    throw new ConflictException('Unable to generate a unique extra code');
  }

  async createExtra(dto: CreateExtraDto) {
    const extra = await this.extraModel.create({
      extraCode: await this.createUniqueExtraCode(),
      category: dto.category,
      name: dto.name.trim(),
      description: normalizeText(dto.description),
      value: normalizeText(dto.value),
      enabled: dto.enabled ?? true,
      adminApprovalRequired: dto.adminApprovalRequired ?? false,
    });

    if (extra.category === ExtraCategory.Places) {
      this.placesService.invalidateHierarchyCache();
    }

    return extra;
  }

  async listExtras(params: { category?: ExtraCategory; page: number; limit: number }) {
    const filter: { category?: ExtraCategory } = {};

    if (params.category) {
      filter.category = params.category;
    }

    const page = Math.max(1, params.page);
    const limit = Math.min(Math.max(1, params.limit), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.extraModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.extraModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getExtraById(id: string) {
    const extra = await this.extraModel.findById(id);
    if (!extra) {
      throw new NotFoundException('Extra item not found');
    }

    return extra;
  }

  async updateExtra(id: string, dto: UpdateExtraDto) {
    const extra = await this.extraModel.findById(id);
    if (!extra) {
      throw new NotFoundException('Extra item not found');
    }

    if (dto.category) {
      extra.category = dto.category;
    }

    if (dto.name !== undefined) {
      extra.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      extra.description = normalizeText(dto.description);
    }

    if (dto.value !== undefined) {
      extra.value = normalizeText(dto.value);
    }

    if (dto.enabled !== undefined) {
      extra.enabled = dto.enabled;
    }

    if (dto.adminApprovalRequired !== undefined) {
      extra.adminApprovalRequired = dto.adminApprovalRequired;
    }

    await extra.save();
    if (extra.category === ExtraCategory.Places) {
      this.placesService.invalidateHierarchyCache();
    }
    return extra;
  }

  async deleteExtra(id: string) {
    const extra = await this.extraModel.findByIdAndDelete(id);
    if (!extra) {
      throw new NotFoundException('Extra item not found');
    }

    if (extra.category === ExtraCategory.Places) {
      this.placesService.invalidateHierarchyCache();
    }
    return { message: 'Extra item deleted successfully' };
  }

  async getPlaceHierarchy(params?: { includeDeleted?: boolean }) {
    return this.placesService.getHierarchy(params);
  }

  async getPlaceCatalog() {
    return this.placesService.getCatalog();
  }

  private parseDifficultyValue(value?: string | null): DifficultyTier[] | null {
    if (!value?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      if (!Array.isArray(parsed)) {
        return null;
      }

      const normalized = parsed
        .map((item) => {
          if (typeof item !== 'object' || item === null) {
            return null;
          }

          const row = item as Partial<DifficultyTier>;
          const id = typeof row.id === 'string' ? row.id.trim() : '';
          const label = typeof row.label === 'string' ? row.label.trim() : '';
          const xpMultiplier = Number(row.xpMultiplier);

          if (!id || !label || !Number.isFinite(xpMultiplier)) {
            return null;
          }

          return {
            id,
            label,
            adminApprovalRequired: row.adminApprovalRequired === true,
            xpMultiplier,
            order: Number.isFinite(Number(row.order)) ? Number(row.order) : 0,
            enabled: row.enabled !== false,
          };
        })
        .filter((item): item is DifficultyTier => Boolean(item));

      if (parsed.length > 0 && normalized.length === 0) {
        return null;
      }

      return normalized;
    } catch {
      return null;
    }
  }

  private throwDifficultyValidation(errors: DifficultyValidationError[]): never {
    throw new BadRequestException({
      message: 'Validation failed',
      errors,
    });
  }

  private validateAndNormalizeDifficulties(raw: unknown): DifficultyTier[] {
    if (!Array.isArray(raw)) {
      this.throwDifficultyValidation([
        {
          index: -1,
          field: 'root',
          message: 'Difficulty payload must be an array',
        },
      ]);
    }

    if (raw.length === 0) {
      this.throwDifficultyValidation([
        {
          index: -1,
          field: 'root',
          message: 'At least one difficulty is required',
        },
      ]);
    }

    const errors: DifficultyValidationError[] = [];
    const normalized: DifficultyTier[] = [];
    const seenIds = new Set<string>();

    raw.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        errors.push({
          index,
          field: 'root',
          message: 'Each difficulty must be an object',
        });
        return;
      }

      const row = item as Partial<DifficultyTier>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      const xpMultiplier = Number(row.xpMultiplier);
      const normalizedId = id.toLowerCase();

      if (!id) {
        errors.push({ index, field: 'id', message: 'id is required' });
      }

      if (!label) {
        errors.push({ index, field: 'label', message: 'label is required' });
      }

      if (!Number.isFinite(xpMultiplier) || xpMultiplier < 0.5 || xpMultiplier > 10) {
        errors.push({
          index,
          field: 'xpMultiplier',
          message: 'Multiplier must be between 0.5 and 10',
        });
      }

      if (normalizedId) {
        if (seenIds.has(normalizedId)) {
          errors.push({
            index,
            field: 'id',
            message: 'Duplicate id values are not allowed',
          });
        } else {
          seenIds.add(normalizedId);
        }
      }

      normalized.push({
        id,
        label,
        adminApprovalRequired: row.adminApprovalRequired === true,
        xpMultiplier: Number.isFinite(xpMultiplier) ? xpMultiplier : 1,
        order: index + 1,
        enabled: row.enabled !== false,
      });
    });

    if (errors.length > 0) {
      this.throwDifficultyValidation(errors);
    }

    return normalized;
  }

  async getDifficulties(): Promise<DifficultyTier[]> {
    const docs = await this.extraModel
      .find({ category: ExtraCategory.Difficulty })
      .sort({ createdAt: 1 });

    for (const doc of docs) {
      const parsed = this.parseDifficultyValue(doc.value);
      if (!parsed) {
        continue;
      }

      return parsed
        .sort((a, b) => a.order - b.order)
        .map((item, index) => ({
          ...item,
          order: index + 1,
        }));
    }

    return [];
  }

  async saveDifficulties(raw: unknown): Promise<DifficultyTier[]> {
    const normalized = this.validateAndNormalizeDifficulties(raw);
    const docs = await this.extraModel
      .find({ category: ExtraCategory.Difficulty })
      .sort({ createdAt: 1 });

    const existing = docs.find((doc) => this.parseDifficultyValue(doc.value) !== null) ?? docs[0];

    if (existing) {
      existing.name = 'Difficulty Configuration';
      existing.description = null;
      existing.value = JSON.stringify(normalized);
      existing.enabled = true;
      existing.adminApprovalRequired = false;
      await existing.save();
      return normalized;
    }

    await this.extraModel.create({
      extraCode: await this.createUniqueExtraCode(),
      category: ExtraCategory.Difficulty,
      name: 'Difficulty Configuration',
      description: null,
      value: JSON.stringify(normalized),
      enabled: true,
      adminApprovalRequired: false,
    });

    return normalized;
  }
}
