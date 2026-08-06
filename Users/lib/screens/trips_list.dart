import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/trips_provider.dart';

class TripsListScreen extends StatefulWidget {
  const TripsListScreen({super.key});

  @override
  State<TripsListScreen> createState() => _TripsListScreenState();
}

class _TripsListScreenState extends State<TripsListScreen> {
  late TripsProvider _tripsProvider;

  @override
  void initState() {
    super.initState();
    _tripsProvider = context.read<TripsProvider>();
    _tripsProvider.loadTrips();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trips'),
        elevation: 0,
      ),
      body: Consumer<TripsProvider>(
        builder: (context, provider, _) {
          if (provider.loading && provider.trips.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.trips.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    'Error: ${provider.error}',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.loadTrips(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.trips.isEmpty) {
            return const Center(
              child: Text('No trips found'),
            );
          }

          return ListView.builder(
            itemCount: provider.trips.length,
            itemBuilder: (context, index) {
              final trip = provider.trips[index];
              return TripCard(trip: trip);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Navigate to create trip screen
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Create trip feature coming soon')),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class TripCard extends StatelessWidget {
  final dynamic trip;

  const TripCard({super.key, required this.trip});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8),
      child: ListTile(
        title: Text(trip['title'] ?? 'Untitled Trip'),
        subtitle: Text(
          '${trip['province'] ?? 'Unknown'} • ${trip['difficulty'] ?? 'Unknown'}',
        ),
        trailing: Text(trip['status'] ?? ''),
        onTap: () {
          // Navigate to trip details
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Trip details: ${trip['title']}')),
          );
        },
      ),
    );
  }
}
