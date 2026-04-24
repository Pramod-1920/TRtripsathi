import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtraCategory } from './constants/extra-category.enum';
import { CreateExtraDto } from './dto/create-extra.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';
import { ExtraItem } from './schemas/extra.schema';

function normalizeText(value?: string | null) {
  return value?.trim() || null;
}

@Injectable()
export class ExtraService {
  constructor(
    @InjectModel(ExtraItem.name) private readonly extraModel: Model<ExtraItem>,
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
    });

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

    await extra.save();
    return extra;
  }

  async deleteExtra(id: string) {
    const extra = await this.extraModel.findByIdAndDelete(id);
    if (!extra) {
      throw new NotFoundException('Extra item not found');
    }

    return { message: 'Extra item deleted successfully' };
  }
}