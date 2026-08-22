import { Types } from 'mongoose';
import { Role } from '../auth/constants/roles.enum';
import { UserService } from './user.service';

describe('UserService place-evidence integrity', () => {
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const authId = new Types.ObjectId();
  const profileId = new Types.ObjectId();
  const validPlace = {
    id: 'place_pashupatinath',
    name: 'Pashupatinath Temple',
    category: 'temple_spiritual',
    latitude: 27.7104,
    longitude: 85.3488,
    verificationRadiusMeters: 500,
  };
  const validPayload = {
    url: 'https://res.cloudinary.com/trip-test/image/upload/photo.jpg',
    travelerUrl:
      'https://res.cloudinary.com/trip-test/image/upload/traveler.jpg',
    kind: 'solo' as const,
    title: 'Pashupatinath visit',
    category: 'temple_spiritual',
    province: 'Bagmati Province',
    district: 'Kathmandu',
    municipality: 'Kathmandu Metropolitan City',
    place: 'Pashupatinath Temple',
    address: 'Gaushala, Kathmandu',
    latitude: 27.7104,
    longitude: 85.3488,
    locationAccuracyMeters: 15,
    locationCapturedAt: new Date().toISOString(),
  };

  const hierarchyWith = (place: Record<string, unknown>) => ({
    provinces: [
      {
        id: 'prov_bagmati',
        name: 'Bagmati Province',
        districts: [
          {
            id: 'dist_kathmandu',
            name: 'Kathmandu',
            municipalities: [
              {
                id: 'mun_kathmandu',
                name: 'Kathmandu Metropolitan City',
                places: [place],
              },
            ],
          },
        ],
      },
    ],
  });

  function setup(options?: {
    place?: Record<string, unknown>;
    duplicateHash?: boolean;
  }) {
    const profile = {
      _id: profileId,
      authId,
      photoVerificationRequests: [],
    };
    const userModel = {
      findOne: jest.fn().mockResolvedValue(profile),
      exists: jest.fn().mockResolvedValue(options?.duplicateHash ?? false),
      findByIdAndUpdate: jest.fn().mockResolvedValue(profile),
    };
    const authModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          role: Role.User,
          isActive: true,
          verificationRequired: false,
        }),
      }),
    };
    const placesService = {
      getHierarchy: jest
        .fn()
        .mockResolvedValue(hierarchyWith(options?.place ?? validPlace)),
    };
    const service = new UserService(
      userModel as never,
      authModel as never,
      {} as never,
      placesService as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
    );
    return { service, userModel };
  }

  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'trip-test';
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const traveler = input.toString().includes('traveler.jpg');
      return new Response(
        Uint8Array.from(traveler ? [5, 6, 7, 8] : [1, 2, 3, 4]),
        {
          status: 200,
          headers: { 'content-type': 'image/jpeg', 'content-length': '4' },
        },
      );
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalCloudName === undefined) {
      delete process.env.CLOUDINARY_CLOUD_NAME;
    } else {
      process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
    }
  });

  it('accepts fresh evidence inside the trusted radius', async () => {
    const { service, userModel } = setup();

    const result = await service.createPhotoVerificationRequest(
      authId.toString(),
      validPayload,
    );

    expect(result.request.distanceFromPlaceMeters).toBe(0);
    expect(result.request.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects evidence outside the trusted radius', async () => {
    const { service } = setup();

    await expect(
      service.createPhotoVerificationRequest(authId.toString(), {
        ...validPayload,
        latitude: 27.72,
      }),
    ).rejects.toThrow('move within 500 metres');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails closed when the catalog place has no trusted coordinates', async () => {
    const { service } = setup({
      place: {
        id: validPlace.id,
        name: validPlace.name,
        category: validPlace.category,
      },
    });

    await expect(
      service.createPhotoVerificationRequest(authId.toString(), validPayload),
    ).rejects.toThrow('until an admin adds trusted coordinates');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an exact image hash already used by pending or approved evidence', async () => {
    const { service, userModel } = setup({ duplicateHash: true });

    await expect(
      service.createPhotoVerificationRequest(authId.toString(), validPayload),
    ).rejects.toThrow('exact photo was already submitted');
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
