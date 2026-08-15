import { PlacesService } from './places.service';

describe('PlacesService trusted-coordinate backfill', () => {
  const hierarchy = {
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
                places: [
                  {
                    id: 'place_pashupatinath',
                    name: 'Pashupatinath Temple',
                    category: 'temple_spiritual',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  function setup() {
    const document = {
      value: JSON.stringify(hierarchy),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const model = {
      findOne: jest.fn().mockResolvedValue(document),
    };
    return {
      document,
      service: new PlacesService(model as never),
    };
  }

  it('previews changes without modifying or saving the hierarchy', async () => {
    const { document, service } = setup();
    const originalValue = document.value;

    const result = await service.backfillTrustedCoordinates({
      dryRun: true,
      entries: [
        {
          placeId: 'place_pashupatinath',
          latitude: 27.7104,
          longitude: 85.3488,
          verificationRadiusMeters: 350,
        },
      ],
    });

    expect(result).toMatchObject({
      dryRun: true,
      applied: false,
      summary: { requested: 1, changed: 1, unchanged: 0 },
    });
    expect(document.value).toBe(originalValue);
    expect(document.save).not.toHaveBeenCalled();
  });

  it('applies all validated coordinate changes in one save', async () => {
    const { document, service } = setup();

    const result = await service.backfillTrustedCoordinates({
      dryRun: false,
      entries: [
        {
          placeId: 'place_pashupatinath',
          latitude: 27.7104,
          longitude: 85.3488,
        },
      ],
    });
    const saved = JSON.parse(document.value);
    const place = saved.provinces[0].districts[0].municipalities[0].places[0];

    expect(result.applied).toBe(true);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(place).toMatchObject({
      latitude: 27.7104,
      longitude: 85.3488,
      verificationRadiusMeters: 500,
    });
  });

  it('rejects duplicate place IDs before saving', async () => {
    const { document, service } = setup();

    await expect(
      service.backfillTrustedCoordinates({
        dryRun: false,
        entries: [
          {
            placeId: 'place_pashupatinath',
            latitude: 27.7104,
            longitude: 85.3488,
          },
          {
            placeId: 'place_pashupatinath',
            latitude: 27.7105,
            longitude: 85.3489,
          },
        ],
      }),
    ).rejects.toThrow('Duplicate placeId');
    expect(document.save).not.toHaveBeenCalled();
  });
});
