import { haversineDistanceMeters } from './geo.util';

describe('haversineDistanceMeters', () => {
  it('returns zero for the same point', () => {
    expect(
      haversineDistanceMeters(
        { latitude: 27.7104, longitude: 85.3488 },
        { latitude: 27.7104, longitude: 85.3488 },
      ),
    ).toBe(0);
  });

  it('matches the known distance for one longitude degree at the equator', () => {
    const distance = haversineDistanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );

    expect(distance).toBeGreaterThan(111_190);
    expect(distance).toBeLessThan(111_200);
  });

  it('is symmetric for two Nepal locations', () => {
    const pashupatinath = { latitude: 27.7104, longitude: 85.3488 };
    const boudhanath = { latitude: 27.7215, longitude: 85.362 };

    expect(haversineDistanceMeters(pashupatinath, boudhanath)).toBeCloseTo(
      haversineDistanceMeters(boudhanath, pashupatinath),
      8,
    );
  });

  it('rejects invalid coordinates', () => {
    expect(() =>
      haversineDistanceMeters(
        { latitude: 91, longitude: 85 },
        { latitude: 27, longitude: 85 },
      ),
    ).toThrow(RangeError);
  });
});
