import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/api.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  _ProfileScreenState createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const _seenAchievementCompletionIdsKey =
      'seen_achievement_completion_ids';

  final _storage = const FlutterSecureStorage();
  late Future<Map<String, dynamic>> _profile;

  @override
  void initState() {
    super.initState();
    _profile = _fetchProfile();
  }

  Future<Map<String, dynamic>> _fetchProfile() async {
    final data = await ApiService.getProfile();
    await _showNewAchievementPopupIfNeeded(data);
    return data;
  }

  Future<void> _showNewAchievementPopupIfNeeded(
      Map<String, dynamic> data) async {
    final rawProgress = data['achievementProgress'];

    if (!mounted || rawProgress is! List<dynamic>) {
      return;
    }

    final completedEntries = rawProgress
        .whereType<Map<String, dynamic>>()
        .where((entry) => entry['completedAt'] != null)
        .toList();

    if (completedEntries.isEmpty) {
      return;
    }

    final seenRaw = await _storage.read(key: _seenAchievementCompletionIdsKey);
    final seenIds = <String>{};

    if (seenRaw != null && seenRaw.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(seenRaw);
        if (decoded is List) {
          seenIds.addAll(decoded.map((item) => item.toString()));
        }
      } catch (_) {
        // Ignore malformed persisted state and continue with an empty seen set.
      }
    }

    final newlyCompleted = completedEntries.where((entry) {
      final id = _buildCompletionId(entry);
      return id.isNotEmpty && !seenIds.contains(id);
    }).toList();

    if (newlyCompleted.isEmpty) {
      return;
    }

    for (final entry in newlyCompleted) {
      seenIds.add(_buildCompletionId(entry));
    }

    await _storage.write(
      key: _seenAchievementCompletionIdsKey,
      value: jsonEncode(seenIds.toList()),
    );

    await WidgetsBinding.instance.endOfFrame;

    if (!mounted) {
      return;
    }

    for (final entry in newlyCompleted) {
      final title = (entry['title']?.toString().trim().isNotEmpty ?? false)
          ? entry['title'].toString().trim()
          : (entry['key']?.toString().trim().isNotEmpty ?? false)
              ? entry['key'].toString().trim()
              : 'Achievement completed';
      final rewardXp =
          (entry['rewardXp'] is num) ? (entry['rewardXp'] as num).toInt() : 0;

      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Achievement Unlocked'),
          content: Text(
            rewardXp > 0
                ? '$title completed. +$rewardXp XP added to your total XP.'
                : '$title completed.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  }

  String _buildCompletionId(Map<String, dynamic> entry) {
    final key = entry['key']?.toString().trim() ?? '';
    final completedAt = entry['completedAt']?.toString().trim() ?? '';
    return '$key::$completedAt';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              // Use AuthProvider to sign out and notify app
              final auth = Provider.of<AuthProvider>(context, listen: false);
              await auth.signOut();
            },
          )
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _profile,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting)
            return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError)
            return Center(child: Text('Error: \\${snapshot.error}'));
          final data = snapshot.data ?? {};
          // If profile isn't completed yet, send user to onboarding
          if (data['profileCompleted'] == false) {
            // schedule navigation after build
            WidgetsBinding.instance.addPostFrameCallback((_) {
              Navigator.of(context).pushReplacementNamed('/onboarding');
            });
            return const Center(child: CircularProgressIndicator());
          }

          return RefreshIndicator(
            onRefresh: () async {
              setState(() {
                _profile = _fetchProfile();
              });
              await _profile;
            },
            child: ListView(
              padding: const EdgeInsets.all(16.0),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('XP',
                                style: TextStyle(
                                    fontSize: 12, color: Colors.black54)),
                            const SizedBox(height: 4),
                            Text(
                              '\\${data['xp'] ?? 0}',
                              style: const TextStyle(
                                  fontSize: 24, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('Level',
                                style: TextStyle(
                                    fontSize: 12, color: Colors.black54)),
                            const SizedBox(height: 4),
                            Text(
                              '\\${data['level'] ?? 1}',
                              style: const TextStyle(
                                  fontSize: 20, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text('Name: \\${data['firstName'] ?? data['fullName'] ?? '—'}',
                    style: const TextStyle(fontSize: 18)),
                const SizedBox(height: 8),
                Text('Phone: \\${data['phoneNumber'] ?? '—'}',
                    style: const TextStyle(fontSize: 16)),
                const SizedBox(height: 8),
                Text('Location: \\${data['location'] ?? '—'}',
                    style: const TextStyle(fontSize: 16)),
              ],
            ),
          );
        },
      ),
    );
  }
}
