import 'package:flutter/material.dart';
import '../services/api.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({Key? key}) : super(key: key);

  @override
  _OnboardingScreenState createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _firstController = TextEditingController();
  final _lastController = TextEditingController();
  final _locationController = TextEditingController();
  String? _experienceLevel;
  bool _loading = false;
  String? _error;

  final List<String> _levels = ['beginner', 'intermediate', 'advanced'];
  final _ageController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Complete your profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _firstController,
              decoration: const InputDecoration(labelText: 'First name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _lastController,
              decoration: const InputDecoration(labelText: 'Last name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _locationController,
              decoration: const InputDecoration(labelText: 'Location (city)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _ageController,
              decoration: const InputDecoration(labelText: 'Age (optional, must be > 8)'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _experienceLevel,
              items: _levels.map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
              onChanged: (v) => setState(() => _experienceLevel = v),
              decoration: const InputDecoration(labelText: 'Experience level'),
            ),
            const SizedBox(height: 20),
            if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading ? const CircularProgressIndicator() : const Text('Save and continue'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final updates = <String, dynamic>{
      'firstName': _firstController.text.trim(),
      'lastName': _lastController.text.trim(),
      'location': _locationController.text.trim(),
      if (_experienceLevel != null) 'experienceLevel': _experienceLevel,
      };

      // Age validation (optional)
      final ageText = _ageController.text.trim();
      if (ageText.isNotEmpty) {
        final age = int.tryParse(ageText);
        if (age == null) {
          setState(() {
            _loading = false;
            _error = 'Age must be a number';
          });
          return;
        }
        if (age <= 8) {
          setState(() {
            _loading = false;
            _error = 'Age must be greater than 8';
          });
          return;
        }
        updates['age'] = age;
      }
    };

    try {
      await ApiService.updateProfile(updates);
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/profile');
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }
}
