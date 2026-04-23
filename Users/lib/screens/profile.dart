import 'package:flutter/material.dart';
import '../services/api.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  _ProfileScreenState createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<Map<String, dynamic>> _profile;

  @override
  void initState() {
    super.initState();
    _profile = ApiService.getProfile();
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
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Center(child: Text('Error: \\${snapshot.error}'));
          final data = snapshot.data ?? {};
          // If profile isn't completed yet, send user to onboarding
          if (data['profileCompleted'] == false) {
            // schedule navigation after build
            WidgetsBinding.instance.addPostFrameCallback((_) {
              Navigator.of(context).pushReplacementNamed('/onboarding');
            });
            return const Center(child: CircularProgressIndicator());
          }

          return Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Name: \\${data['firstName'] ?? data['fullName'] ?? '—'}', style: const TextStyle(fontSize: 18)),
                const SizedBox(height: 8),
                Text('Phone: \\${data['phoneNumber'] ?? '—'}', style: const TextStyle(fontSize: 16)),
                const SizedBox(height: 8),
                Text('Location: \\${data['location'] ?? '—'}', style: const TextStyle(fontSize: 16)),
              ],
            ),
          );
        },
      ),
    );
  }
}
