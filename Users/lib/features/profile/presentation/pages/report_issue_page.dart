import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/notifications/push_notification_service.dart';

const _forest = Color(0xFF173F38);
const _forestSoft = Color(0xFFE8F0ED);
const _amber = Color(0xFFF2B84B);
const _canvas = Color(0xFFF5F4EF);
const _ink = Color(0xFF17201D);
const _muted = Color(0xFF68746F);
const _line = Color(0xFFE1E3DD);

class ReportIssuePage extends StatefulWidget {
  const ReportIssuePage({super.key});

  @override
  State<ReportIssuePage> createState() => _ReportIssuePageState();
}

class _ReportIssuePageState extends State<ReportIssuePage>
    with WidgetsBindingObserver {
  final _formKey = GlobalKey<FormState>();
  final _detailsController = TextEditingController();
  String? _reason;
  bool _submitting = false;
  bool _loadingHistory = true;
  bool _refreshingHistory = false;
  String? _historyError;
  List<Map<String, dynamic>> _reports = const [];

  static const _reasons = <_ReportReason>[
    _ReportReason(
      value: 'bug',
      icon: Icons.build_outlined,
      title: 'Something is not working',
      hint: 'A screen, button or feature behaves incorrectly',
    ),
    _ReportReason(
      value: 'feature_request',
      icon: Icons.lightbulb_outline_rounded,
      title: 'Suggest an improvement',
      hint: 'Share an idea that would make TripSathi better',
    ),
    _ReportReason(
      value: 'general_feedback',
      icon: Icons.chat_bubble_outline_rounded,
      title: 'Share general feedback',
      hint: 'Tell us about your overall experience',
    ),
    _ReportReason(
      value: 'other',
      icon: Icons.more_horiz_rounded,
      title: 'Something else',
      hint: 'Use this if the options above do not fit',
    ),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    PushNotificationService.reportStatusRevision.addListener(
      _handleReportStatusNotification,
    );
    _loadHistory();
  }

  @override
  void dispose() {
    PushNotificationService.reportStatusRevision.removeListener(
      _handleReportStatusNotification,
    );
    WidgetsBinding.instance.removeObserver(this);
    _detailsController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadHistory(showLoading: false, showErrors: false);
    }
  }

  void _handleReportStatusNotification() {
    _loadHistory(showLoading: false, showErrors: false);
  }

  Future<void> _loadHistory({
    bool showLoading = true,
    bool showErrors = true,
  }) async {
    if (_refreshingHistory) return;
    _refreshingHistory = true;
    if (showLoading && mounted) {
      setState(() {
        _loadingHistory = true;
        _historyError = null;
      });
    }
    try {
      final response = await ApiService.getMyReports(limit: 20);
      final raw = response['data'];
      final reports = raw is List
          ? raw
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _reports = reports;
        _loadingHistory = false;
        _historyError = null;
      });
    } catch (error) {
      if (!mounted) return;
      if (showErrors) {
        setState(() {
          _loadingHistory = false;
          _historyError = ApiService.readableError(error);
        });
      }
    } finally {
      _refreshingHistory = false;
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final created = await ApiService.submitFeedback(
        reason: _reason!,
        description: _detailsController.text,
      );
      if (!mounted) return;
      setState(() {
        _reason = null;
        _detailsController.clear();
        _reports = [created, ..._reports];
      });
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            backgroundColor: _forest,
            content: Text('Report sent. You can follow its status below.'),
          ),
        );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFB42318),
            content: Text(ApiService.readableError(error)),
          ),
        );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _canvas,
        appBar: AppBar(
          backgroundColor: _canvas,
          title: const Text('Report an issue'),
        ),
        body: RefreshIndicator(
          color: _forest,
          onRefresh: () => _loadHistory(showLoading: false),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 36),
            children: [
              const _IntroCard(),
              const SizedBox(height: 24),
              const _SectionTitle(
                eyebrow: 'NEW REPORT',
                title: 'What can we help with?',
              ),
              const SizedBox(height: 12),
              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FormField<String>(
                      validator: (_) => _reason == null
                          ? 'Choose the option that best matches your report'
                          : null,
                      builder: (field) => Column(
                        children: [
                          Container(
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: field.hasError
                                    ? const Color(0xFFB42318)
                                    : _line,
                              ),
                            ),
                            child: Column(
                              children: [
                                for (var index = 0;
                                    index < _reasons.length;
                                    index++) ...[
                                  _ReasonTile(
                                    reason: _reasons[index],
                                    selected: _reason == _reasons[index].value,
                                    onTap: () {
                                      setState(() =>
                                          _reason = _reasons[index].value);
                                      field.didChange(_reason);
                                    },
                                  ),
                                  if (index < _reasons.length - 1)
                                    const Divider(
                                      height: 1,
                                      indent: 64,
                                      color: _line,
                                    ),
                                ],
                              ],
                            ),
                          ),
                          if (field.hasError)
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(13, 7, 0, 0),
                                child: Text(
                                  field.errorText!,
                                  style: const TextStyle(
                                    color: Color(0xFFB42318),
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      controller: _detailsController,
                      minLines: 5,
                      maxLines: 8,
                      maxLength: 500,
                      inputFormatters: [LengthLimitingTextInputFormatter(500)],
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        labelText: 'Tell us what happened',
                        alignLabelWithHint: true,
                        hintText:
                            'Include what you were trying to do and what happened instead.',
                        filled: true,
                        fillColor: Colors.white,
                      ),
                      validator: (value) {
                        final details = (value ?? '').trim();
                        if (details.isEmpty) return 'Add a few details';
                        if (details.length < 20) {
                          return 'Please write at least 20 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.lock_outline_rounded,
                            color: _muted, size: 16),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            'Your report is only visible to you and the TripSathi moderation team.',
                            style: TextStyle(
                              color: _muted.withValues(alpha: .95),
                              fontSize: 12,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: _submitting ? null : _submit,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(54),
                        backgroundColor: _forest,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(17),
                        ),
                      ),
                      child: _submitting
                          ? const SizedBox.square(
                              dimension: 22,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2.2,
                              ),
                            )
                          : const Text(
                              'Send report',
                              style: TextStyle(fontWeight: FontWeight.w800),
                            ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              const _SectionTitle(
                eyebrow: 'FOLLOW-UP',
                title: 'Your reports',
              ),
              const SizedBox(height: 12),
              _buildHistory(),
            ],
          ),
        ),
      );

  Widget _buildHistory() {
    if (_loadingHistory) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: CircularProgressIndicator(color: _forest, strokeWidth: 2.4),
        ),
      );
    }
    if (_historyError != null) {
      return _HistoryNotice(
        icon: Icons.cloud_off_outlined,
        title: 'Could not load your reports',
        body: _historyError!,
        action: TextButton(onPressed: _loadHistory, child: const Text('Retry')),
      );
    }
    if (_reports.isEmpty) {
      return const _HistoryNotice(
        icon: Icons.inbox_outlined,
        title: 'No reports yet',
        body: 'Reports you send will appear here with updates from our team.',
      );
    }
    return Column(
      children: [
        for (var index = 0; index < _reports.length; index++) ...[
          _ReportCard(report: _reports[index]),
          if (index < _reports.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _IntroCard extends StatelessWidget {
  const _IntroCard();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _forest,
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: Color(0x26FFFFFF),
                shape: BoxShape.circle,
              ),
              child: Padding(
                padding: EdgeInsets.all(11),
                child:
                    Icon(Icons.support_agent_rounded, color: _amber, size: 25),
              ),
            ),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Help us make the journey smoother',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      height: 1.25,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  SizedBox(height: 7),
                  Text(
                    'Send a clear description and our team will review it. For an immediate safety emergency, contact local emergency services.',
                    style: TextStyle(
                      color: Color(0xD9FFFFFF),
                      fontSize: 13,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.eyebrow, required this.title});
  final String eyebrow;
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              eyebrow,
              style: const TextStyle(
                color: _muted,
                fontSize: 10.5,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              title,
              style: const TextStyle(
                color: _ink,
                fontSize: 20,
                fontWeight: FontWeight.w900,
                letterSpacing: -.3,
              ),
            ),
          ],
        ),
      );
}

class _ReportReason {
  const _ReportReason({
    required this.value,
    required this.icon,
    required this.title,
    required this.hint,
  });
  final String value;
  final IconData icon;
  final String title;
  final String hint;
}

class _ReasonTile extends StatelessWidget {
  const _ReasonTile({
    required this.reason,
    required this.selected,
    required this.onTap,
  });
  final _ReportReason reason;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          color: selected ? _forestSoft : Colors.transparent,
          padding: const EdgeInsets.fromLTRB(14, 13, 12, 13),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: selected ? _forest : const Color(0xFFF1F2EE),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(reason.icon,
                    size: 20, color: selected ? Colors.white : _forest),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(reason.title,
                        style: const TextStyle(
                            color: _ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(reason.hint,
                        style: const TextStyle(
                            color: _muted, fontSize: 11.5, height: 1.3)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                selected
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: selected ? _forest : const Color(0xFFB4BBB7),
                size: 22,
              ),
            ],
          ),
        ),
      );
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report});
  final Map<String, dynamic> report;

  @override
  Widget build(BuildContext context) {
    final reason = (report['reason'] ?? 'other').toString();
    final status = (report['status'] ?? 'open').toString();
    final description = (report['description'] ?? '').toString();
    final resolution = (report['resolution'] ?? '').toString().trim();
    final id = (report['_id'] ?? '').toString();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _reasonLabel(reason),
                  style: const TextStyle(
                      color: _ink, fontSize: 15, fontWeight: FontWeight.w900),
                ),
              ),
              _StatusPill(status: status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            description,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: _muted, fontSize: 13, height: 1.45),
          ),
          if (resolution.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _forestSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Team response: $resolution',
                style: const TextStyle(color: _forest, fontSize: 12.5),
              ),
            ),
          ],
          const SizedBox(height: 11),
          Text(
            '${_formatDate(report['createdAt'])}${id.length >= 6 ? '  •  #${id.substring(id.length - 6).toUpperCase()}' : ''}',
            style: const TextStyle(
              color: _muted,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, color, background) = switch (status) {
      'investigating' => (
          'In review',
          const Color(0xFF9A6700),
          const Color(0xFFFFF3D6)
        ),
      'resolved' => (
          'Resolved',
          const Color(0xFF176B47),
          const Color(0xFFE2F4EA)
        ),
      'dismissed' => (
          'Closed',
          const Color(0xFF616B67),
          const Color(0xFFEEF0EE)
        ),
      _ => ('Received', const Color(0xFF285E91), const Color(0xFFE7F1FA)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(
            color: color, fontSize: 10.5, fontWeight: FontWeight.w900),
      ),
    );
  }
}

class _HistoryNotice extends StatelessWidget {
  const _HistoryNotice({
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(19),
          border: Border.all(color: _line),
        ),
        child: Column(
          children: [
            Icon(icon, color: _forest, size: 29),
            const SizedBox(height: 10),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: _ink, fontSize: 15, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(body,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 12.5)),
            if (action != null) action!,
          ],
        ),
      );
}

String _reasonLabel(String value) => switch (value) {
      'bug' => 'Something is not working',
      'feature_request' => 'Suggested improvement',
      'general_feedback' => 'General feedback',
      'harassment' => 'Harassment',
      'spam' => 'Spam',
      'inappropriate_content' => 'Inappropriate content',
      'safety_concern' => 'Safety concern',
      'fraud' => 'Fraud',
      _ => 'Other',
    };

String _formatDate(dynamic value) {
  final date = DateTime.tryParse((value ?? '').toString())?.toLocal();
  if (date == null) return 'Recently';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}
