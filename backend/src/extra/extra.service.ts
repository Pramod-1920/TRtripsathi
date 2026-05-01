import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { ExtraCategory } from './constants/extra-category.enum';
import { CreateExtraDto } from './dto/create-extra.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';
import { ExtraItem } from './schemas/extra.schema';

function normalizeText(value?: string | null) {
  return value?.trim() || null;
}

type PlaceCatalogRecord = {
  province: string;
  districts: string[];
};

type PlaceCatalogDistrictItem = {
  district: string;
  places: string[];
};

type PlaceCatalogItem = {
  province: string;
  districts: string[];
  districtItems: PlaceCatalogDistrictItem[];
};

type PlaceHierarchyResult = {
  source: 'extras' | 'json';
  items: PlaceCatalogItem[];
};

function normalizePlaceKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function readPlaceCatalogFile(): PlaceCatalogRecord[] {
  const candidatePaths = [
    path.resolve(process.cwd(), 'nepal_province_district.json'),
    path.resolve(process.cwd(), 'backend', 'nepal_province_district.json'),
  ];

  const sourcePath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));

  if (!sourcePath) {
    return [];
  }

  try {
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const parsed = JSON.parse(raw) as {
      provinces?: Array<{ province?: string; districts?: string[] }>;
    };

    if (!Array.isArray(parsed.provinces)) {
      return [];
    }

    return parsed.provinces
      .map((item) => ({
        province: String(item.province ?? '').trim(),
        districts: Array.isArray(item.districts)
          ? item.districts.map((district) => String(district).trim()).filter(Boolean)
          : [],
      }))
      .filter((item) => item.province.length > 0);
  } catch {
    return [];
  }
}

function parsePlaceValue(value?: string | null): {
  type?: 'province' | 'district' | 'place';
  province?: string;
  district?: string;
} | null {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as { type?: unknown; province?: unknown; district?: unknown };
    const type = parsed.type === 'province' || parsed.type === 'district' || parsed.type === 'place'
      ? parsed.type
      : undefined;
    const province = typeof parsed.province === 'string' ? parsed.province.trim() : undefined;
    const district = typeof parsed.district === 'string' ? parsed.district.trim() : undefined;
    return {
      ...(type ? { type } : {}),
      ...(province ? { province } : {}),
      ...(district ? { district } : {}),
    };
  } catch {
    return null;
  }
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

  private buildHierarchyFromJson(): PlaceCatalogItem[] {
    return readPlaceCatalogFile()
      .map((item) => {
        const uniqueDistricts = Array.from(new Set(item.districts))
          .sort((first, second) => first.localeCompare(second));

        return {
          province: item.province,
          districts: uniqueDistricts,
          districtItems: uniqueDistricts.map((district) => ({
            district,
            places: [],
          })),
        };
      })
      .sort((first, second) => first.province.localeCompare(second.province));
  }

  private buildHierarchyFromExtras(placeExtras: Array<{ name?: string | null; value?: string | null }>) {
    const provinceNodes = new Map<string, {
      province: string;
      districts: Map<string, { district: string; places: Set<string> }>;
    }>();

    const ensureProvince = (provinceName: string) => {
      const provinceKey = normalizePlaceKey(provinceName);

      if (!provinceKey) {
        return null;
      }

      if (!provinceNodes.has(provinceKey)) {
        provinceNodes.set(provinceKey, {
          province: provinceName,
          districts: new Map(),
        });
      }

      const provinceNode = provinceNodes.get(provinceKey);

      if (!provinceNode) {
        return null;
      }

      provinceNode.province = provinceName;
      return provinceNode;
    };

    const ensureDistrict = (provinceName: string, districtName: string) => {
      const provinceNode = ensureProvince(provinceName);

      if (!provinceNode) {
        return null;
      }

      const districtKey = normalizePlaceKey(districtName);

      if (!districtKey) {
        return null;
      }

      if (!provinceNode.districts.has(districtKey)) {
        provinceNode.districts.set(districtKey, {
          district: districtName,
          places: new Set(),
        });
      }

      const districtNode = provinceNode.districts.get(districtKey);

      if (!districtNode) {
        return null;
      }

      districtNode.district = districtName;
      return districtNode;
    };

    for (const item of placeExtras) {
      const name = String(item.name ?? '').trim();

      if (!name) {
        continue;
      }

      const metadata = parsePlaceValue(item.value);
      const type = metadata?.type ?? 'district';

      if (type === 'province') {
        ensureProvince(name);
        continue;
      }

      if (type === 'district') {
        const provinceName = metadata?.province?.trim();

        if (!provinceName) {
          continue;
        }

        ensureDistrict(provinceName, name);
        continue;
      }

      const provinceName = metadata?.province?.trim();
      const districtName = metadata?.district?.trim();

      if (!provinceName || !districtName) {
        continue;
      }

      const districtNode = ensureDistrict(provinceName, districtName);

      if (!districtNode) {
        continue;
      }

      districtNode.places.add(name);
    }

    return Array.from(provinceNodes.values())
      .map((provinceNode) => {
        const districtItems = Array.from(provinceNode.districts.values())
          .map((districtNode) => ({
            district: districtNode.district,
            places: Array.from(districtNode.places).sort((first, second) => first.localeCompare(second)),
          }))
          .sort((first, second) => first.district.localeCompare(second.district));

        return {
          province: provinceNode.province,
          districts: districtItems.map((item) => item.district),
          districtItems,
        };
      })
      .sort((first, second) => first.province.localeCompare(second.province));
  }

  async getPlaceHierarchy(params?: { includeDisabled?: boolean }): Promise<PlaceHierarchyResult> {
    const includeDisabled = params?.includeDisabled === true;
    const filter: { category: ExtraCategory; enabled?: { $ne: false } } = {
      category: ExtraCategory.Places,
    };

    if (!includeDisabled) {
      filter.enabled = { $ne: false };
    }

    const placeExtras = await this.extraModel
      .find(filter)
      .select('name value')
      .lean();

    const fromExtras = this.buildHierarchyFromExtras(placeExtras);

    if (fromExtras.length > 0) {
      return {
        items: fromExtras,
        source: 'extras',
      };
    }

    return {
      items: this.buildHierarchyFromJson(),
      source: 'json',
    };
  }

  async getPlaceCatalog() {
    return this.getPlaceHierarchy({ includeDisabled: false });
  }
}