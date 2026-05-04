import fs from 'node:fs';
import path from 'node:path';
import mongoose, { Model, Schema } from 'mongoose';

type ExtraDocument = {
  _id?: unknown;
  extraCode: string;
  category: string;
  name: string;
  description?: string | null;
  value?: string | null;
  enabled: boolean;
};

type PlaceCatalogFile = {
  provinces?: Array<{
    provinceNumber?: number;
    province?: string;
    districts?: string[];
    places?: Record<string, string[]>;
  }>;
};

type PlaceCatalogRow = {
  provinceNumber: number;
  province: string;
  districts: string[];
  places: Record<string, string[]>;
};

type PlaceMetadata = {
  type?: string;
  province?: string;
  district?: string;
  provinceNumber?: number;
};

const extraSchema = new Schema<ExtraDocument>(
  {
    extraCode: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    value: { type: String, default: null },
    enabled: { type: Boolean, default: true },
  },
  {
    collection: 'extraitems',
    timestamps: true,
  },
);

const ExtraModel: Model<ExtraDocument> =
  mongoose.models.ExtraItem || mongoose.model<ExtraDocument>('ExtraItem', extraSchema);

function readMongoUri() {
  const direct = process.env.MONGODB_URI?.trim();

  if (direct) {
    return direct;
  }

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key === 'MONGODB_URI' && value) {
        return value;
      }
    }
  }

  throw new Error('MONGODB_URI is not set in environment or .env');
}

function normalizePlaceKey(value: string) {
  return value.trim().toLowerCase();
}

function readCatalogFile() {
  const candidates = [
    path.resolve(process.cwd(), 'nepal_province_district.json'),
    path.resolve(process.cwd(), 'backend', 'nepal_province_district.json'),
  ];

  const sourcePath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!sourcePath) {
    throw new Error('Unable to locate nepal_province_district.json');
  }

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const parsed = JSON.parse(raw) as PlaceCatalogFile;

  if (!Array.isArray(parsed.provinces)) {
    throw new Error('Invalid place JSON format: expected provinces array');
  }

<<<<<<< HEAD
  return parsed.provinces.map<PlaceCatalogRow>((item) => {
    const places = Object.entries(item.places ?? {}).reduce<Record<string, string[]>>((acc, [district, rawPlaces]) => {
      const districtName = String(district).trim();

      if (!districtName) {
        return acc;
      }

      acc[districtName] = Array.isArray(rawPlaces)
        ? rawPlaces.map((place) => String(place).trim()).filter(Boolean)
        : [];

      return acc;
    }, {});

    return {
      provinceNumber: Number(item.provinceNumber ?? 0),
      province: String(item.province ?? '').trim(),
      districts: Array.isArray(item.districts)
        ? item.districts.map((district) => String(district).trim()).filter(Boolean)
        : [],
      places,
    };
  });
=======
  return parsed.provinces.map((item) => ({
    province: String(item.province ?? '').trim(),
    districts: Array.isArray(item.districts)
      ? item.districts.map((district) => String(district).trim()).filter(Boolean)
      : [],
    provinceNumber: item.provinceNumber ?? 0,
    places: item.places ?? {},
  }));
>>>>>>> d41db78a9a973145bd2adb83e1a3fd0a8cf7fb95
}

async function generateUniqueExtraCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';

    for (let i = 0; i < 6; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    const extraCode = `EXT-${code}`;
    const exists = await ExtraModel.exists({ extraCode });

    if (!exists) {
      return extraCode;
    }
  }

  throw new Error('Unable to generate unique extra code for places seed');
}

<<<<<<< HEAD
function parsePlaceValue(value?: string | null): PlaceMetadata | null {
=======
function parsePlaceValue(value?: string | null): { type?: string; province?: string; district?: string } | null {
>>>>>>> d41db78a9a973145bd2adb83e1a3fd0a8cf7fb95
  if (!value || !value.trim()) {
    return null;
  }

  try {
<<<<<<< HEAD
    return JSON.parse(value) as PlaceMetadata;
=======
    return JSON.parse(value) as { type?: string; province?: string; district?: string };
>>>>>>> d41db78a9a973145bd2adb83e1a3fd0a8cf7fb95
  } catch {
    return null;
  }
}

async function upsertPlaceByMetadata(input: {
  name: string;
  type: 'province' | 'district' | 'place';
  province?: string;
  district?: string;
  provinceNumber?: number;
}) {
  const placeName = input.name.trim();

  if (!placeName) {
    return false;
  }

  const allPlaces = await ExtraModel.find({ category: 'places' })
    .select('_id name value')
    .lean();

  const match = allPlaces.find((item) => {
    if (normalizePlaceKey(String(item.name ?? '')) !== normalizePlaceKey(placeName)) {
      return false;
    }

    const metadata = parsePlaceValue(item.value);

    if (!metadata || metadata.type !== input.type) {
      return false;
    }

    if (input.type === 'province') {
      return true;
    }

    if (input.type === 'district') {
      return normalizePlaceKey(String(metadata.province ?? '')) === normalizePlaceKey(String(input.province ?? ''));
    }

    return (
      normalizePlaceKey(String(metadata.province ?? '')) === normalizePlaceKey(String(input.province ?? ''))
      && normalizePlaceKey(String(metadata.district ?? '')) === normalizePlaceKey(String(input.district ?? ''))
    );
  });

  if (match) {
    return false;
  }

  let value = '';
  let description = '';

  if (input.type === 'province') {
    value = JSON.stringify({
      type: 'province',
      ...(input.provinceNumber ? { provinceNumber: input.provinceNumber } : {}),
    });
    description = `Province ${input.provinceNumber ? `#${input.provinceNumber}` : ''} - Seeded from nepal_province_district.json`;
  } else if (input.type === 'district') {
    value = JSON.stringify({ type: 'district', province: input.province?.trim() ?? '' });
    description = `District in ${input.province?.trim() ?? 'Unknown Province'}`;
  } else {
    value = JSON.stringify({
      type: 'place',
      province: input.province?.trim() ?? '',
      district: input.district?.trim() ?? '',
    });
    description = `${input.name} in ${input.district?.trim() ?? 'Unknown District'}, ${input.province?.trim() ?? 'Unknown Province'}`;
  }

  await ExtraModel.create({
    extraCode: await generateUniqueExtraCode(),
    category: 'places',
    name: placeName,
    description,
    value,
    enabled: true,
  });

  return true;
}

async function run() {
  const mongoUri = readMongoUri();
  const catalog = readCatalogFile();

  await mongoose.connect(mongoUri);

  try {
    let created = 0;
    const districtSeen = new Set<string>();

    for (const provinceRow of catalog) {
      const province = provinceRow.province.trim();
      const provinceNumber = provinceRow.provinceNumber ?? 0;

      if (!province) {
        continue;
      }

      if (await upsertPlaceByMetadata({ name: province, type: 'province', provinceNumber })) {
        created += 1;
      }

      for (const districtRaw of provinceRow.districts) {
        const district = districtRaw.trim();

        if (!district) {
          continue;
        }

        const districtKey = `${normalizePlaceKey(province)}::${normalizePlaceKey(district)}`;

        if (districtSeen.has(districtKey)) {
          continue;
        }

        districtSeen.add(districtKey);

        if (await upsertPlaceByMetadata({
          name: district,
          type: 'district',
          province,
        })) {
          created += 1;
        }

        // Seed places for this district
        const places = provinceRow.places?.[district] ?? [];
        for (const place of places) {
          if (await upsertPlaceByMetadata({
            name: place.trim(),
            type: 'place',
            province,
            district,
          })) {
            created += 1;
          }
        }
      }
    }

    const total = await ExtraModel.countDocuments({ category: 'places' });
    console.log(`Places seed completed. Added ${created} new records. Total places: ${total}.`);
  } finally {
    await mongoose.disconnect();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Places seed failed:', message);
  process.exitCode = 1;
});
