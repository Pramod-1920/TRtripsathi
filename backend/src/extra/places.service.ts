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
  BackfillPlaceTrustDto,
  BulkSeedPlacesDto,
  PlaceOperationDto,
} from './dto/places.dto';
import { ExtraItem } from './schemas/extra.schema';

export type PlaceTitleNode = {
  id: string;
  name: string;
  category?: string;
  subcategory?: string | null;
  latitude?: number;
  longitude?: number;
  verificationRadiusMeters?: number;
  deleted?: boolean;
};

export type PlaceMunicipalityNode = {
  id: string;
  name: string;
  places: PlaceTitleNode[];
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
  municipalities: string[];
  municipalityItems: Array<{
    municipality: string;
    places: Array<{
      place: string;
      category?: string;
      subcategory?: string | null;
      latitude?: number;
      longitude?: number;
      verificationRadiusMeters?: number;
    }>;
  }>;
  placeItems: Array<{
    place: string;
    municipality: string;
    category?: string;
    subcategory?: string | null;
    latitude?: number;
    longitude?: number;
    verificationRadiusMeters?: number;
  }>;
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
  private readonly hierarchyCache = new Map<
    string,
    { expiresAt: number; data: PlacesHierarchy }
  >();

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
                      places: Array.isArray(municipality.places)
                        ? municipality.places.map((place) => ({
                            id: String(place.id ?? '').trim(),
                            name: String(place.name ?? '').trim(),
                            category:
                              typeof place.category === 'string' &&
                              place.category.trim()
                                ? place.category.trim()
                                : undefined,
                            subcategory:
                              typeof place.subcategory === 'string' &&
                              place.subcategory.trim()
                                ? place.subcategory.trim()
                                : undefined,
                            latitude: Number.isFinite(Number(place.latitude))
                              ? Number(place.latitude)
                              : undefined,
                            longitude: Number.isFinite(Number(place.longitude))
                              ? Number(place.longitude)
                              : undefined,
                            verificationRadiusMeters: Number.isFinite(
                              Number(place.verificationRadiusMeters),
                            )
                              ? Number(place.verificationRadiusMeters)
                              : undefined,
                            deleted: place.deleted === true ? true : undefined,
                          }))
                        : [],
                    }))
                  : [],
              }))
            : [],
        })),
      };
    } catch {
      throw new InternalServerErrorException(
        'Stored places hierarchy is invalid JSON',
      );
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
                  places: municipality.places
                    .filter((place) => place.deleted !== true)
                    .map((place) => ({
                      id: place.id,
                      name: place.name,
                      category: place.category,
                      subcategory: place.subcategory,
                      latitude: place.latitude,
                      longitude: place.longitude,
                      verificationRadiusMeters: place.verificationRadiusMeters,
                    })),
                })),
            })),
        })),
    };
  }

  private validateHierarchy(
    hierarchy: PlacesHierarchy,
    options?: { requireAtLeastOneProvince?: boolean },
  ) {
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
        throw new BadRequestException(
          'Every province must include id and name',
        );
      }

      if (allIds.has(province.id)) {
        throw new BadRequestException(`Duplicate ID found: ${province.id}`);
      }
      allIds.add(province.id);

      const provinceNameKey = normalizeName(province.name);
      if (provinceNames.has(provinceNameKey)) {
        throw new BadRequestException(
          `Duplicate province name: ${province.name}`,
        );
      }
      provinceNames.add(provinceNameKey);

      const districtNames = new Set<string>();
      for (const district of province.districts ?? []) {
        if (!district.id || !district.name) {
          throw new BadRequestException(
            `Every district in ${province.name} must include id and name`,
          );
        }

        if (allIds.has(district.id)) {
          throw new BadRequestException(`Duplicate ID found: ${district.id}`);
        }
        allIds.add(district.id);

        const districtNameKey = normalizeName(district.name);
        if (districtNames.has(districtNameKey)) {
          throw new BadRequestException(
            `Duplicate district name in ${province.name}: ${district.name}`,
          );
        }
        districtNames.add(districtNameKey);

        const municipalityNames = new Set<string>();
        for (const municipality of district.municipalities ?? []) {
          if (!municipality.id || !municipality.name) {
            throw new BadRequestException(
              `Every municipality in ${district.name} must include id and name`,
            );
          }

          if (allIds.has(municipality.id)) {
            throw new BadRequestException(
              `Duplicate ID found: ${municipality.id}`,
            );
          }
          allIds.add(municipality.id);

          const municipalityNameKey = normalizeName(municipality.name);
          if (municipalityNames.has(municipalityNameKey)) {
            throw new BadRequestException(
              `Duplicate municipality name in ${district.name}: ${municipality.name}`,
            );
          }
          municipalityNames.add(municipalityNameKey);

          const placeNames = new Set<string>();
          for (const place of municipality.places ?? []) {
            if (!place.id || !place.name) {
              throw new BadRequestException(
                `Every place in ${municipality.name} must include id and name`,
              );
            }
            if (allIds.has(place.id)) {
              throw new BadRequestException(`Duplicate ID found: ${place.id}`);
            }
            allIds.add(place.id);
            if (place.category !== undefined && !place.category.trim()) {
              throw new BadRequestException(
                `Place category cannot be empty in ${municipality.name}`,
              );
            }
            if (place.subcategory?.trim() && !place.category?.trim()) {
              throw new BadRequestException(
                `Place ${place.name} cannot have a subcategory without a category`,
              );
            }
            const hasLatitude = Number.isFinite(place.latitude);
            const hasLongitude = Number.isFinite(place.longitude);
            if (hasLatitude !== hasLongitude) {
              throw new BadRequestException(
                `Place ${place.name} must include both latitude and longitude`,
              );
            }
            if (
              hasLatitude &&
              (place.latitude! < -90 || place.latitude! > 90)
            ) {
              throw new BadRequestException(
                `Invalid latitude for ${place.name}`,
              );
            }
            if (
              hasLongitude &&
              (place.longitude! < -180 || place.longitude! > 180)
            ) {
              throw new BadRequestException(
                `Invalid longitude for ${place.name}`,
              );
            }
            if (
              place.verificationRadiusMeters !== undefined &&
              (!Number.isInteger(place.verificationRadiusMeters) ||
                place.verificationRadiusMeters < 50 ||
                place.verificationRadiusMeters > 10000)
            ) {
              throw new BadRequestException(
                `Verification radius for ${place.name} must be 50-10000 metres`,
              );
            }
            const placeNameKey = normalizeName(place.name);
            if (placeNames.has(placeNameKey)) {
              throw new BadRequestException(
                `Duplicate place name in ${municipality.name}: ${place.name}`,
              );
            }
            placeNames.add(placeNameKey);
          }
        }
      }
    }
  }

  private findNode(
    hierarchy: PlacesHierarchy,
    id: string,
  ):
    | (
        | { type: 'province'; province: PlaceProvinceNode }
        | {
            type: 'district';
            province: PlaceProvinceNode;
            district: PlaceDistrictNode;
          }
        | {
            type: 'municipality';
            province: PlaceProvinceNode;
            district: PlaceDistrictNode;
            municipality: PlaceMunicipalityNode;
          }
        | {
            type: 'place';
            province: PlaceProvinceNode;
            district: PlaceDistrictNode;
            municipality: PlaceMunicipalityNode;
            place: PlaceTitleNode;
          }
      )
    | null {
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
          for (const place of municipality.places ?? []) {
            if (place.id === id) {
              return {
                type: 'place',
                province,
                district,
                municipality,
                place,
              };
            }
          }
        }
      }
    }

    return null;
  }

  private generateUniqueNodeId(
    hierarchy: PlacesHierarchy,
    prefix: 'prov' | 'dist' | 'mun' | 'place',
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
          municipality.places?.forEach((place) => existingIds.add(place.id));
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

  private applyOperation(
    hierarchy: PlacesHierarchy,
    operation: PlaceOperationDto,
  ) {
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
          throw new BadRequestException(
            'Province add operation does not accept parentId',
          );
        }

        hierarchy.provinces.push({
          id: this.generateUniqueNodeId(hierarchy, 'prov', name),
          name,
          districts: [],
        });
        return;
      }

      if (!operation.parentId?.trim()) {
        throw new BadRequestException(
          'Add operation requires parentId for district, municipality or place',
        );
      }

      const parent = this.findNode(hierarchy, operation.parentId.trim());
      if (!parent) {
        throw new BadRequestException(
          `Parent not found: ${operation.parentId}`,
        );
      }

      if (operation.type === 'district') {
        if (parent.type !== 'province') {
          throw new BadRequestException(
            'District can only be added under a province',
          );
        }

        parent.province.districts.push({
          id: this.generateUniqueNodeId(hierarchy, 'dist', name),
          name,
          municipalities: [],
        });
        return;
      }

      if (operation.type === 'place') {
        if (parent.type !== 'municipality') {
          throw new BadRequestException(
            'Place can only be added under a municipality',
          );
        }
        const category = operation.category?.trim();
        const subcategory = operation.subcategory?.trim() || null;
        if (!category) {
          throw new BadRequestException(
            'Place add operation requires an activity category',
          );
        }
        if (
          !Number.isFinite(operation.latitude) ||
          !Number.isFinite(operation.longitude)
        ) {
          throw new BadRequestException(
            'Place add operation requires trusted latitude and longitude',
          );
        }
        parent.municipality.places.push({
          id: this.generateUniqueNodeId(hierarchy, 'place', name),
          name,
          category,
          subcategory,
          latitude: operation.latitude,
          longitude: operation.longitude,
          verificationRadiusMeters: operation.verificationRadiusMeters ?? 500,
        });
        return;
      }

      if (parent.type !== 'district') {
        throw new BadRequestException(
          'Municipality can only be added under a district',
        );
      }

      parent.district.municipalities.push({
        id: this.generateUniqueNodeId(hierarchy, 'mun', name),
        name,
        places: [],
      });
      return;
    }

    if (operation.op === 'hard_delete') {
      if (!operation.id?.trim()) {
        throw new BadRequestException('hard_delete operation requires id');
      }

      const node = this.findNode(hierarchy, operation.id.trim());
      if (!node) {
        throw new BadRequestException(`Node not found: ${operation.id}`);
      }

      const ensureSoftDeleted = (deleted?: boolean) => {
        if (deleted !== true) {
          throw new BadRequestException(
            'You must disable (soft delete) the node before hard deleting it',
          );
        }
      };

      if (node.type === 'province') {
        ensureSoftDeleted(node.province.deleted);
        if (
          node.province.districts.some((district) => district.deleted !== true)
        ) {
          throw new BadRequestException(
            'Cannot hard delete a province with non-deleted districts',
          );
        }
        hierarchy.provinces = hierarchy.provinces.filter(
          (province) => province.id !== node.province.id,
        );
        return;
      }

      if (node.type === 'district') {
        ensureSoftDeleted(node.district.deleted);
        if (
          node.district.municipalities.some(
            (municipality) => municipality.deleted !== true,
          )
        ) {
          throw new BadRequestException(
            'Cannot hard delete a district with non-deleted municipalities',
          );
        }
        node.province.districts = node.province.districts.filter(
          (district) => district.id !== node.district.id,
        );
        return;
      }

      if (node.type === 'municipality') {
        ensureSoftDeleted(node.municipality.deleted);
        if (node.municipality.places.some((place) => place.deleted !== true)) {
          throw new BadRequestException(
            'Cannot hard delete a municipality with non-deleted places',
          );
        }
        node.district.municipalities = node.district.municipalities.filter(
          (municipality) => municipality.id !== node.municipality.id,
        );
        return;
      }

      ensureSoftDeleted(node.place.deleted);
      node.municipality.places = node.municipality.places.filter(
        (place) => place.id !== node.place.id,
      );
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
      if (node.type === 'municipality') {
        node.municipality.name = nextName;
        return;
      }
      node.place.name = nextName;
      if (operation.category !== undefined) {
        const category = operation.category.trim();
        if (!category) {
          throw new BadRequestException('Place category cannot be empty');
        }
        node.place.category = category;
      }
      if (operation.subcategory !== undefined) {
        node.place.subcategory = operation.subcategory?.trim() || null;
      }
      if (operation.latitude !== undefined) {
        node.place.latitude = operation.latitude;
      }
      if (operation.longitude !== undefined) {
        node.place.longitude = operation.longitude;
      }
      if (operation.verificationRadiusMeters !== undefined) {
        node.place.verificationRadiusMeters =
          operation.verificationRadiusMeters;
      }
      return;
    }

    if (operation.op === 'delete') {
      if (node.type === 'province') {
        if (
          node.province.districts.some((district) => district.deleted !== true)
        ) {
          throw new BadRequestException(
            'Cannot delete a province with non-deleted districts',
          );
        }
        node.province.deleted = true;
        return;
      }

      if (node.type === 'district') {
        if (
          node.district.municipalities.some(
            (municipality) => municipality.deleted !== true,
          )
        ) {
          throw new BadRequestException(
            'Cannot delete a district with non-deleted municipalities',
          );
        }
        node.district.deleted = true;
        return;
      }
      if (node.type === 'municipality') {
        if (node.municipality.places.some((place) => place.deleted !== true)) {
          throw new BadRequestException(
            'Cannot delete a municipality with non-deleted places',
          );
        }
        node.municipality.deleted = true;
        return;
      }
      node.place.deleted = true;
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
      if (node.type === 'municipality') {
        delete node.municipality.deleted;
        return;
      }
      delete node.place.deleted;
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
      description: 'Nepal province-district-municipality-place hierarchy',
      value: JSON.stringify({ provinces: [] }),
      enabled: true,
      adminApprovalRequired: false,
    });
  }

  async getHierarchy(params?: {
    includeDeleted?: boolean;
  }): Promise<PlacesHierarchy> {
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
    const normalizedPayload: PlacesHierarchy = {
      provinces: payload.provinces.map((province) => ({
        ...province,
        districts: province.districts.map((district) => ({
          ...district,
          municipalities: district.municipalities.map((municipality) => ({
            ...municipality,
            places: municipality.places ?? [],
          })),
        })),
      })),
    };
    this.validateHierarchy(normalizedPayload, {
      requireAtLeastOneProvince: true,
    });
    this.invalidateHierarchyCache();

    const document = await this.ensureHierarchyDocument();
    document.category = ExtraCategory.Places;
    document.name = PLACE_HIERARCHY_NAME;
    document.value = JSON.stringify(normalizedPayload);
    document.enabled = true;
    document.adminApprovalRequired = false;
    await document.save();

    this.invalidateHierarchyCache();
    return this.getHierarchy({ includeDeleted: true });
  }

  async patchHierarchy(
    operations: PlaceOperationDto[],
  ): Promise<PlacesHierarchy> {
    if (!Array.isArray(operations) || operations.length < 1) {
      throw new BadRequestException(
        'operations must include at least one operation',
      );
    }

    const document = await this.ensureHierarchyDocument();
    const source = this.parseHierarchyValue(document.value);
    const working = this.cloneHierarchy(source);

    operations.forEach((operation, index) => {
      try {
        this.applyOperation(working, operation);
        this.validateHierarchy(working);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Invalid operation';
        throw new BadRequestException(
          `Operation ${index + 1} failed: ${message}`,
        );
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

  async backfillTrustedCoordinates(payload: BackfillPlaceTrustDto) {
    if (!Array.isArray(payload.entries) || payload.entries.length < 1) {
      throw new BadRequestException('entries must include at least one place');
    }
    if (payload.entries.length > 1000) {
      throw new BadRequestException(
        'A backfill request supports up to 1000 places',
      );
    }

    const document = await this.findHierarchyDocument();
    if (!document) {
      throw new BadRequestException('Places hierarchy has not been created');
    }
    const working = this.cloneHierarchy(
      this.parseHierarchyValue(document.value),
    );
    const seen = new Set<string>();
    const changes = payload.entries.map((entry, index) => {
      const placeId = String(entry.placeId ?? '').trim();
      if (!placeId) {
        throw new BadRequestException(`Entry ${index + 1} requires placeId`);
      }
      if (seen.has(placeId)) {
        throw new BadRequestException(
          `Duplicate placeId in backfill: ${placeId}`,
        );
      }
      seen.add(placeId);
      if (
        !Number.isFinite(entry.latitude) ||
        entry.latitude < -90 ||
        entry.latitude > 90 ||
        !Number.isFinite(entry.longitude) ||
        entry.longitude < -180 ||
        entry.longitude > 180
      ) {
        throw new BadRequestException(`Invalid coordinates for ${placeId}`);
      }
      const radius = entry.verificationRadiusMeters ?? 500;
      if (!Number.isInteger(radius) || radius < 50 || radius > 10000) {
        throw new BadRequestException(
          `Verification radius for ${placeId} must be 50-10000 metres`,
        );
      }

      const node = this.findNode(working, placeId);
      if (!node || node.type !== 'place') {
        throw new BadRequestException(`Place not found: ${placeId}`);
      }
      const before = {
        latitude: node.place.latitude ?? null,
        longitude: node.place.longitude ?? null,
        verificationRadiusMeters: node.place.verificationRadiusMeters ?? null,
      };
      const after = {
        latitude: entry.latitude,
        longitude: entry.longitude,
        verificationRadiusMeters: radius,
      };
      const changed =
        before.latitude !== after.latitude ||
        before.longitude !== after.longitude ||
        before.verificationRadiusMeters !== after.verificationRadiusMeters;

      node.place.latitude = after.latitude;
      node.place.longitude = after.longitude;
      node.place.verificationRadiusMeters = after.verificationRadiusMeters;
      return {
        placeId,
        place: node.place.name,
        municipality: node.municipality.name,
        district: node.district.name,
        province: node.province.name,
        deleted: node.place.deleted === true,
        changed,
        before,
        after,
      };
    });

    this.validateHierarchy(working);
    const dryRun = payload.dryRun !== false;
    if (!dryRun) {
      document.value = JSON.stringify(working);
      document.category = ExtraCategory.Places;
      document.name = PLACE_HIERARCHY_NAME;
      document.enabled = true;
      await document.save();
      this.invalidateHierarchyCache();
    }

    return {
      dryRun,
      applied: !dryRun,
      summary: {
        requested: changes.length,
        changed: changes.filter((change) => change.changed).length,
        unchanged: changes.filter((change) => !change.changed).length,
      },
      changes,
    };
  }

  async getCatalog(): Promise<{ source: 'extras'; items: CatalogItem[] }> {
    const hierarchy = await this.getHierarchy({ includeDeleted: false });
    const items = hierarchy.provinces.map((province) => {
      const districtItems = province.districts.map((district) => {
        const municipalityItems = district.municipalities.map(
          (municipality) => ({
            municipality: municipality.name,
            places: municipality.places.map((place) => ({
              place: place.name,
              category: place.category,
              subcategory: place.subcategory,
              latitude: place.latitude,
              longitude: place.longitude,
              verificationRadiusMeters: place.verificationRadiusMeters,
            })),
          }),
        );
        const placeItems = district.municipalities.flatMap((municipality) =>
          municipality.places.map((place) => ({
            place: place.name,
            municipality: municipality.name,
            category: place.category,
            subcategory: place.subcategory,
            latitude: place.latitude,
            longitude: place.longitude,
            verificationRadiusMeters: place.verificationRadiusMeters,
          })),
        );
        return {
          district: district.name,
          places: placeItems.map((item) => item.place),
          municipalities: municipalityItems.map((item) => item.municipality),
          municipalityItems,
          placeItems,
        };
      });

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
