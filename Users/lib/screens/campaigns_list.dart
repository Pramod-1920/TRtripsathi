import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/campaigns_provider.dart';

class CampaignsListScreen extends StatefulWidget {
  const CampaignsListScreen({super.key});

  @override
  State<CampaignsListScreen> createState() => _CampaignsListScreenState();
}

class _CampaignsListScreenState extends State<CampaignsListScreen> {
  late CampaignsProvider _campaignsProvider;

  @override
  void initState() {
    super.initState();
    _campaignsProvider = context.read<CampaignsProvider>();
    _campaignsProvider.loadCampaigns();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Campaigns'),
        elevation: 0,
      ),
      body: Consumer<CampaignsProvider>(
        builder: (context, provider, _) {
          if (provider.loading && provider.campaigns.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.campaigns.isEmpty) {
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
                    onPressed: () => provider.loadCampaigns(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.campaigns.isEmpty) {
            return const Center(
              child: Text('No campaigns found'),
            );
          }

          return ListView.builder(
            itemCount: provider.campaigns.length,
            itemBuilder: (context, index) {
              final campaign = provider.campaigns[index];
              return CampaignCard(
                campaign: campaign,
                onJoin: () => _joinCampaign(campaign['_id']),
              );
            },
          );
        },
      ),
    );
  }

  void _joinCampaign(String campaignId) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _campaignsProvider.joinCampaign(campaignId);
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Successfully joined campaign!')),
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text('Error: ${e.toString()}')),
      );
    }
  }
}

class CampaignCard extends StatelessWidget {
  final dynamic campaign;
  final VoidCallback onJoin;

  const CampaignCard({
    super.key,
    required this.campaign,
    required this.onJoin,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              campaign['title'] ?? 'Untitled Campaign',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              campaign['description'] ?? '',
              style: Theme.of(context).textTheme.bodySmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Status: ${campaign['status'] ?? 'Unknown'}',
                  style: Theme.of(context).textTheme.labelSmall,
                ),
                ElevatedButton.icon(
                  onPressed: onJoin,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Join'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
