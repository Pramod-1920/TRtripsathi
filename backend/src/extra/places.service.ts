import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtraCategory } from './constants/extra-category.enum';
import {
  BulkSeedPlacesDto,
  PlaceOperationDto,
} from './dto/places.dto';
import { ExtraItem } from './schemas/extra.schema';

export type PlaceMunicipalityNode = {
  id: string;
  name: string;
  deleted?: boolean;
};

export type PlaceDistrictNode = {
  id: string;
  name: string;
  municipalities: PlaceMunicipalityNode[];
  deleted?: boolean;
};

export type PlaceProvinceNode = {
  id: string;
  name: string;
  districts: PlaceDistrictNode[];
  deleted?: boolean;
};

export type PlacesHierarchy = {
  provinces: PlaceProvinceNode[];
};

type CatalogDistrictItem = {
  district: string;
  places: string[];
};

type CatalogItem = {
  province: string;
  districts: string[];
  districtItems: CatalogDistrictItem[];
};

const PLACE_HIERARCHY_NAME = 'Nepal Geography Hierarchy';
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

@Injectable()
export class PlacesService {
  private readonly hierarchyCache = new Map<string, { expiresAt: number; data: PlacesHierarchy }>();

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

  invalidateHierarchyCache() {
    this.hierarchyCache.clear();
  }

  private cloneHierarchy(value: PlacesHierarchy): PlacesHierarchy {
    return JSON.parse(JSON.stringify(value)) as PlacesHierarchy;
  }

  private parseHierarchyValue(value?: string | null): PlacesHierarchy {
    if (!value?.trim()) {
      return { provinces: [] };
    }

    try {
      const parsed = JSON.parse(value) as Partial<PlacesHierarchy>;
      if (!parsed || !Array.isArray(parsed.provinces)) {
        return { provinces: [] };
      }

      return {
        provinces: parsed.provinces.map((province) => ({
          id: String(province.id ?? '').trim(),
          name: String(province.name ?? '').trim(),
          deleted: province.deleted === true ? true : undefined,
          districts: Array.isArray(province.districts)
            ? province.districts.map((district) => ({
                id: String(district.id ?? '').trim(),
                name: String(district.name ?? '').trim(),
                deleted: district.deleted === true ? true : undefined,
                municipalities: Array.isArray(district.municipalities)
                  ? district.municipalities.map((municipality) => ({
                      id: String(municipality.id ?? '').trim(),
                      name: String(municipality.name ?? '').trim(),
                      deleted: municipality.deleted === true ? true : undefined,
                    }))
                  : [],
              }))
            : [],
        })),
      };
    } catch {
      throw new InternalServerErrorException('Stored places hierarchy is invalid JSON');
    }
  }

  private stripDeletedNodes(hierarchy: PlacesHierarchy): PlacesHierarchy {
    return {
      provinces: hierarchy.provinces
        .filter((province) => province.deleted !== true)
        .map((province) => ({
          id: province.id,
          name: province.name,
          districts: province.districts
            .filter((district) => district.deleted !== true)
            .map((district) => ({
              id: district.id,
              name: district.name,
              municipalities: district.municipalities
                .filter((municipality) => municipality.deleted !== true)
                .map((municipality) => ({
                  id: municipality.id,
                  name: municipality.name,
                })),
            })),
        })),
    };
  }

  private validateHierarchy(hierarchy: PlacesHierarchy, options?: { requireAtLeastOneProvince?: boolean }) {
    if (!Array.isArray(hierarchy.provinces)) {
      throw new BadRequestException('places.provinces must be an array');
    }

    if (options?.requireAtLeastOneProvince && hierarchy.provinces.length < 1) {
      throw new BadRequestException('At least one province is required');
    }

    const allIds = new Set<string>();
    const provinceNames = new Set<string>();

    for (const province of hierarchy.provinces) {
      if (!province.id || !province.name) {
        throw new BadRequestException('Every province must include id and name');
      }

      if (allIds.has(province.id)) {
        throw new BadRequestException(`Duplicate ID found: ${province.id}`);
      }
      allIds.add(province.id);

      const provinceNameKey = normalizeName(province.name);
      if (provinceNames.has(provinceNameKey)) {
        throw new BadRequestException(`Duplicate province name: ${province.name}`);
      }
      provinceNames.add(provinceNameKey);

      const districtNames = new Set<string>();
      for (const district of province.districts ?? []) {
        if (!district.id || !district.name) {
          throw new BadRequestException(`Every district in ${province.name} must include id and name`);
        }

        if (allIds.has(district.id)) {
          throw new BadRequestException(`Duplicate ID found: ${district.id}`);
        }
        allIds.add(district.id);

        const districtNameKey = normalizeName(district.name);
        if (districtNames.has(districtNameKey)) {
          throw new BadRequestException(`Duplicate district name in ${province.name}: ${district.name}`);
        }
        districtNames.add(districtNameKey);

        const municipalityNames = new Set<string>();
        for (const municipality of district.municipalities ?? []) {
          if (!municipality.id || !municipality.name) {
            throw new BadRequestException(`Every municipality in ${district.name} must include id and name`);
          }

          if (allIds.has(municipality.id)) {
            throw new BadRequestException(`Duplicate ID found: ${municipality.id}`);
          }
          allIds.add(municipality.id);

          const municipalityNameKey = normalizeName(municipality.name);
          if (municipalityNames.has(municipalityNameKey)) {
            throw new BadRequestException(`Duplicate municipality name in ${district.name}: ${municipality.name}`);
          }
          municipalityNames.add(municipalityNameKey);
        }
      }
    }
  }

  private findNode(hierarchy: PlacesHierarchy, id: string): (
    | { type: 'province'; province: PlaceProvinceNode }
    | { type: 'district'; province: PlaceProvinceNode; district: PlaceDistrictNode }
    | {
        type: 'municipality';
        province: PlaceProvinceNode;
        district: PlaceDistrictNode;
        municipality: PlaceMunicipalityNode;
      }
  ) | null {
    for (const province of hierarchy.provinces) {
      if (province.id === id) {
        return { type: 'province', province };
      }

      for (const district of province.districts) {
        if (district.id === id) {
          return { type: 'district', province, district };
        }

        for (const municipality of district.municipalities) {
          if (municipality.id === id) {
            return {
              type: 'municipality',
              province,
              district,
              municipality,
            };
          }
        }
      }
    }

    return null;
  }

  private generateUniqueNodeId(
    hierarchy: PlacesHierarchy,
    prefix: 'prov' | 'dist' | 'mun',
    name: string,
  ): string {
    const baseSlug = normalizeSlug(name);
    if (!baseSlug) {
      throw new BadRequestException('Name must contain letters or numbers');
    }

    const existingIds = new Set<string>();
    hierarchy.provinces.forEach((province) => {
      existingIds.add(province.id);
      province.districts.forEach((district) => {
        existingIds.add(district.id);
        district.municipalities.forEach((municipality) => {
          existingIds.add(municipality.id);
        });
      });
    });

    let candidate = `${prefix}_${baseSlug}`;
    let suffix = 2;

    while (existingIds.has(candidate)) {
      candidate = `${prefix}_${baseSlug}_${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private applyOperation(hierarchy: PlacesHierarchy, operation: PlaceOperationDto) {
    if (operation.op === 'add') {
      if (!operation.type) {
        throw new BadRequestException('Add operation requires type');
      }
      if (!operation.name?.trim()) {
        throw new BadRequestException('Add operation requires a valid name');
      }

      const name = operation.name.trim();

      if (operation.type === 'province') {
        if (operation.parentId) {
          throw new BadRequestException('Province add operation does not accept parentId');
        }

        hierarchy.provinces.push({
          id: this.generateUniqueNodeId(hierarchy, 'prov', name),
          name,
          districts: [],
        });
        return;
      }

      if (!operation.parentId?.trim()) {
        throw new BadRequestException('Add operation requires parentId for district/municipality');
      }

      const parent = this.findNode(hierarchy, operation.parentId.trim());
      if (!parent) {
        throw new BadRequestException(`Parent not found: ${operation.parentId}`);
      }

      if (operation.type === 'district') {
        if (parent.type !== 'province') {
          throw new BadRequestException('District can only be added under a province');
        }

        parent.province.districts.push({
          id: this.generateUniqueNodeId(hierarchy, 'dist', name),
          name,
          municipalities: [],
        });
        return;
      }

      if (parent.type !== 'district') {
        throw new BadRequestException('Municipality can only be added under a district');
      }

      parent.district.municipalities.push({
        id: this.generateUniqueNodeId(hierarchy, 'mun', name),
        name,
      });
      return;
    }

    if (!operation.id?.trim()) {
      throw new BadRequestException(`${operation.op} operation requires id`);
    }

    const node = this.findNode(hierarchy, operation.id.trim());
    if (!node) {
      throw new BadRequestException(`Node not found: ${operation.id}`);
    }

    if (operation.op === 'rename') {
      if (!operation.name?.trim()) {
        throw new BadRequestException('Rename operation requires a valid name');
      }

      const nextName = operation.name.trim();
      if (node.type === 'province') {
        node.province.name = nextName;
        return;
      }
      if (node.type === 'district') {
        node.district.name = nextName;
        return;
      }
      node.municipality.name = nextName;
      return;
    }

    if (operation.op === 'delete') {
      if (node.type === 'province') {
        if (node.province.districts.some((district) => district.deleted !== true)) {
          throw new BadRequestException('Cannot delete a province with non-deleted districts');
        }
        node.province.deleted = true;
        return;
      }

      if (node.type === 'district') {
        if (node.district.municipalities.some((municipality) => municipality.deleted !== true)) {
          throw new BadRequestException('Cannot delete a district with non-deleted municipalities');
        }
        node.district.deleted = true;
        return;
      }

      node.municipality.deleted = true;
      return;
    }

    if (operation.op === 'restore') {
      if (node.type === 'province') {
        delete node.province.deleted;
        return;
      }
      if (node.type === 'district') {
        delete node.district.deleted;
        return;
      }
      delete node.municipality.deleted;
      return;
    }

    throw new BadRequestException(`Unsupported operation: ${operation.op}`);
  }

  private async findHierarchyDocument() {
    const dedicated = await this.extraModel.findOne({
      category: ExtraCategory.Places,
      name: PLACE_HIERARCHY_NAME,
    });
    if (dedicated) {
      return dedicated;
    }

    const candidates = await this.extraModel
      .find({ category: ExtraCategory.Places })
      .sort({ updatedAt: -1 });

    for (const candidate of candidates) {
      try {
        const parsed = this.parseHierarchyValue(candidate.value);
        if (Array.isArray(parsed.provinces)) {
          return candidate;
        }
      } catch {
        // ignore invalid/non-hierarchy place extras and continue
      }
    }

    return null;
  }

  private async ensureHierarchyDocument() {
    const existing = await this.findHierarchyDocument();
    if (existing) {
      return existing;
    }

    return this.extraModel.create({
      extraCode: await this.createUniqueExtraCode(),
      category: ExtraCategory.Places,
      name: PLACE_HIERARCHY_NAME,
      description: 'Nepal province-district-municipality hierarchy',
      value: JSON.stringify({ provinces: [] }),
      enabled: true,
      adminApprovalRequired: false,
    });
  }

  async getHierarchy(params?: { includeDeleted?: boolean }): Promise<PlacesHierarchy> {
    const includeDeleted = params?.includeDeleted === true;
    const cacheKey = includeDeleted ? 'with_deleted' : 'active_only';
    const cached = this.hierarchyCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return this.cloneHierarchy(cached.data);
    }

    const document = await this.findHierarchyDocument();
    if (!document) {
      return { provinces: [] };
    }

    const parsed = this.parseHierarchyValue(document.value);
    const response = includeDeleted ? parsed : this.stripDeletedNodes(parsed);

    this.hierarchyCache.set(cacheKey, {
      data: this.cloneHierarchy(response),
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return response;
  }

  async bulkSeed(payload: BulkSeedPlacesDto): Promise<PlacesHierarchy> {
    this.validateHierarchy(payload, { requireAtLeastOneProvince: true });
    this.invalidateHierarchyCache();

    const document = await this.ensureHierarchyDocument();
    document.category = ExtraCategory.Places;
    document.name = PLACE_HIERARCHY_NAME;
    document.value = JSON.stringify(payload);
    document.enabled = true;
    document.adminApprovalRequired = false;
    await document.save();

    this.invalidateHierarchyCache();
    return this.getHierarchy({ includeDeleted: true });
  }

  async patchHierarchy(operations: PlaceOperationDto[]): Promise<PlacesHierarchy> {
    if (!Array.isArray(operations) || operations.length < 1) {
      throw new BadRequestException('operations must include at least one operation');
    }

    const document = await this.ensureHierarchyDocument();
    const source = this.parseHierarchyValue(document.value);
    const working = this.cloneHierarchy(source);

    operations.forEach((operation, index) => {
      try {
        this.applyOperation(working, operation);
        this.validateHierarchy(working);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid operation';
        throw new BadRequestException(`Operation ${index + 1} failed: ${message}`);
      }
    });

    this.invalidateHierarchyCache();
    document.value = JSON.stringify(working);
    document.category = ExtraCategory.Places;
    document.name = PLACE_HIERARCHY_NAME;
    document.enabled = true;
    await document.save();
    this.invalidateHierarchyCache();

    return this.getHierarchy({ includeDeleted: true });
  }

  async getCatalog(): Promise<{ source: 'extras'; items: CatalogItem[] }> {
    const hierarchy = await this.getHierarchy({ includeDeleted: false });
    const items = hierarchy.provinces.map((province) => {
      const districtItems = province.districts.map((district) => ({
        district: district.name,
        places: district.municipalities.map((municipality) => municipality.name),
      }));

      return {
        province: province.name,
        districts: districtItems.map((item) => item.district),
        districtItems,
      };
    });

    return {
      source: 'extras',
      items,
    };
  }
}
