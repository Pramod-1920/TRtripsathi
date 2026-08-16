import 'package:flutter/material.dart';

class RankBadgeIcon extends StatelessWidget {
  const RankBadgeIcon({
    super.key,
    required this.rankCode,
    this.badge,
    this.size = 28,
  });

  final String rankCode;
  final Object? badge;
  final double size;

  String get _imageUrl {
    final value = badge;
    if (value is! Map) return '';
    return (value['imageUrl'] ?? value['iconUrl'] ?? '').toString().trim();
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = _imageUrl;

    return Semantics(
      image: true,
      label: 'Rank $rankCode badge',
      child: Container(
        width: size,
        height: size,
        padding: EdgeInsets.all(size * .08),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const LinearGradient(
            colors: [Color(0xFFFFE19A), Color(0xFFF2B84B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(
            color: Colors.white.withValues(alpha: .8),
            width: size >= 24 ? 1.5 : 1,
          ),
          boxShadow: size >= 24
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: .18),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: ClipOval(
          child: imageUrl.isEmpty
              ? _RankBadgeFallback(rankCode: rankCode)
              : Image.network(
                  imageUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) =>
                      _RankBadgeFallback(rankCode: rankCode),
                ),
        ),
      ),
    );
  }
}

class _RankBadgeFallback extends StatelessWidget {
  const _RankBadgeFallback({required this.rankCode});

  final String rankCode;

  @override
  Widget build(BuildContext context) => Container(
        alignment: Alignment.center,
        color: const Color(0xFF173F38),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Padding(
            padding: const EdgeInsets.all(2),
            child: Text(
              rankCode.toUpperCase(),
              style: const TextStyle(
                color: Color(0xFFFFE19A),
                fontWeight: FontWeight.w900,
                height: 1,
              ),
            ),
          ),
        ),
      );
}
