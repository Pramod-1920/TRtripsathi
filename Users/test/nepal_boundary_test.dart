import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_boundary.dart';

void main() {
  test('recognizes locations inside Nepal', () {
    expect(isInsideNepal(const LatLng(27.7172, 85.3240)), isTrue);
    expect(isInsideNepal(const LatLng(28.2096, 83.9856)), isTrue);
  });

  test('rejects locations outside Nepal', () {
    expect(isInsideNepal(const LatLng(28.6139, 77.2090)), isFalse);
    expect(isInsideNepal(const LatLng(26.7271, 88.3953)), isFalse);
  });
}
