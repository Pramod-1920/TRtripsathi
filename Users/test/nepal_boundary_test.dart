import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_boundary.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_administrative_registry.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_district_boundaries.dart';

void main() {
  test('recognizes locations inside Nepal', () {
    expect(isInsideNepal(const LatLng(27.7172, 85.3240)), isTrue);
    expect(isInsideNepal(const LatLng(28.2096, 83.9856)), isTrue);
  });

  test('rejects locations outside Nepal', () {
    expect(isInsideNepal(const LatLng(28.6139, 77.2090)), isFalse);
    expect(isInsideNepal(const LatLng(26.7271, 88.3953)), isFalse);
  });

  group('district coverage registry', () {
    test('contains the official 77 unique districts across seven provinces',
        () {
      expect(nepalDistrictsByProvince.keys.toSet(), {1, 2, 3, 4, 5, 6, 7});
      expect(
        nepalDistrictsByProvince
            .map((key, value) => MapEntry(key, value.length)),
        {1: 14, 2: 8, 3: 13, 4: 11, 5: 12, 6: 10, 7: 9},
      );

      final registered = nepalDistrictsByProvince.values.expand((item) => item);
      expect(registered.length, 77);
      expect(registered.toSet().length, 77);
    });

    test('visual boundaries exactly match the completion registry', () {
      expect(nepalDistrictBoundaries.length, 77);
      expect(
        nepalDistrictBoundaries.map((district) => district.name).toSet().length,
        77,
      );

      for (final province in nepalDistrictsByProvince.keys) {
        final boundaryNames = nepalDistrictBoundaries
            .where((district) => district.province == province)
            .map((district) => district.name)
            .toSet();
        expect(boundaryNames, nepalDistrictsByProvince[province]);
      }
    });

    test('every visual district has valid Nepal coordinates and geometry', () {
      for (final district in nepalDistrictBoundaries) {
        expect(district.points.length, greaterThanOrEqualTo(3),
            reason: district.name);
        expect(district.center.latitude, inInclusiveRange(26.0, 31.0),
            reason: district.name);
        expect(district.center.longitude, inInclusiveRange(80.0, 89.0),
            reason: district.name);
        for (final point in district.points) {
          expect(point.latitude, inInclusiveRange(26.0, 31.0),
              reason: district.name);
          expect(point.longitude, inInclusiveRange(80.0, 89.0),
              reason: district.name);
        }
      }
    });

    test('official and common spellings resolve to map district keys', () {
      const variants = {
        'Sirah': 'siraha',
        'Dhanusha': 'dhanusa',
        'Kavreplanchok': 'kavrepalanchowk',
        'Ramechap': 'ramechhap',
        'Makawanpur': 'makwanpur',
        'Nawalparasi East': 'nawalpur',
        'Nawalparasi West': 'parasi',
        'Rukum East': 'eastern_rukum',
        'Rukum West': 'western_rukum',
        'Kapilbastu': 'kapilvastu',
        'Dailekha': 'dailekh',
      };

      for (final entry in variants.entries) {
        expect(nepalDistrictAliases(entry.key), contains(entry.value));
      }
    });
  });
}
