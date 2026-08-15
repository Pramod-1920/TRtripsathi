import 'dart:async';

import 'package:flutter/material.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';

class ChatInboxScreen extends StatefulWidget {
  const ChatInboxScreen({super.key});

  @override
  State<ChatInboxScreen> createState() => _ChatInboxScreenState();
}

class _ChatInboxScreenState extends State<ChatInboxScreen> {
  List<Map<String, dynamic>> _conversations = const [];
  String _currentUserId = '';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_loading) setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.getChatConversations(),
        ApiService.getProfile(),
      ]);
      final response = results[0];
      final profile = results[1];
      final raw = response['data'];
      if (!mounted) return;
      setState(() {
        _conversations = raw is List
            ? raw
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList()
            : const [];
        _currentUserId = _idOf(profile);
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = ApiService.readableError(error);
      });
    }
  }

  Future<void> _openConversation(Map<String, dynamic> conversation) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChatConversationScreen(
          conversation: conversation,
          currentUserId: _currentUserId,
        ),
      ),
    );
    if (mounted) await _load();
  }

  Future<void> _startConversation() async {
    final conversation = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => TravelerPickerScreen(currentUserId: _currentUserId),
      ),
    );
    if (!mounted || conversation == null) return;
    await _openConversation(conversation);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF6F7F3),
        appBar: AppBar(
          title: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Messages'),
              Text(
                'Your travel conversations',
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'New conversation',
              onPressed: _loading ? null : _startConversation,
              icon: const Icon(Icons.edit_square),
            ),
            IconButton(
              tooltip: 'Refresh conversations',
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded),
            ),
            const SizedBox(width: 5),
          ],
        ),
        body: _loading
            ? const _ChatInboxSkeleton()
            : _error != null
                ? _ChatError(message: _error!, onRetry: _load)
                : _conversations.isEmpty
                    ? _EmptyInbox(onStart: _startConversation)
                    : RefreshIndicator(
                        color: AppColors.navy,
                        onRefresh: _load,
                        child: ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 28),
                          itemCount: _conversations.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 9),
                          itemBuilder: (context, index) {
                            final conversation = _conversations[index];
                            return _ConversationTile(
                              conversation: conversation,
                              currentUserId: _currentUserId,
                              onTap: () => _openConversation(conversation),
                            );
                          },
                        ),
                      ),
      );
}

class TravelerPickerScreen extends StatefulWidget {
  const TravelerPickerScreen({super.key, required this.currentUserId});
  final String currentUserId;

  @override
  State<TravelerPickerScreen> createState() => _TravelerPickerScreenState();
}

class _TravelerPickerScreenState extends State<TravelerPickerScreen> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _travelers = const [];
  Timer? _debounce;
  int _searchRequest = 0;
  bool _loading = true;
  String? _startingId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onQueryChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _search);
  }

  Future<void> _search() async {
    final request = ++_searchRequest;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ApiService.searchChatTravelers(
        _searchController.text,
      );
      final raw = response['items'];
      if (!mounted || request != _searchRequest) return;
      setState(() {
        _travelers = raw is List
            ? raw
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .where((item) => _idOf(item) != widget.currentUserId)
                .toList()
            : const [];
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _searchRequest) return;
      setState(() {
        _loading = false;
        _error = ApiService.readableError(error);
      });
    }
  }

  Future<void> _start(Map<String, dynamic> traveler) async {
    final id = _idOf(traveler);
    if (id.isEmpty || _startingId != null) return;
    setState(() => _startingId = id);
    try {
      final conversation = await ApiService.startPrivateChat(id);
      if (mounted) Navigator.of(context).pop(conversation);
    } catch (error) {
      if (!mounted) return;
      setState(() => _startingId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiService.readableError(error))),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF6F7F3),
        appBar: AppBar(title: const Text('New conversation')),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
              child: TextField(
                controller: _searchController,
                autofocus: true,
                textInputAction: TextInputAction.search,
                onChanged: _onQueryChanged,
                onSubmitted: (_) => _search(),
                decoration: const InputDecoration(
                  hintText: 'Search travelers by name or location',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.navy),
                    )
                  : _error != null
                      ? _ChatError(message: _error!, onRetry: _search)
                      : _travelers.isEmpty
                          ? const _ChatEmptyState(
                              icon: Icons.person_search_outlined,
                              title: 'No travelers found',
                              message: 'Try another name or location.',
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(14, 8, 14, 24),
                              itemCount: _travelers.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final traveler = _travelers[index];
                                final id = _idOf(traveler);
                                final name = _personName(traveler);
                                final location = [
                                  traveler['location'],
                                  traveler['district'],
                                ]
                                    .map((value) =>
                                        (value ?? '').toString().trim())
                                    .where((value) => value.isNotEmpty)
                                    .toSet()
                                    .join(', ');
                                return Card(
                                  elevation: 0,
                                  color: Colors.white,
                                  child: ListTile(
                                    onTap: () => _start(traveler),
                                    leading: _ChatAvatar(
                                      name: name,
                                      imageUrl: (traveler['profilePhoto'] ?? '')
                                          .toString(),
                                      size: 46,
                                    ),
                                    title: Text(
                                      name.isEmpty ? 'Traveler' : name,
                                      style: const TextStyle(
                                        color: AppColors.navy,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    subtitle: location.isEmpty
                                        ? const Text('TripSathi traveler')
                                        : Text(location),
                                    trailing: _startingId == id
                                        ? const SizedBox.square(
                                            dimension: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : const Icon(Icons.chat_outlined),
                                  ),
                                );
                              },
                            ),
            ),
          ],
        ),
      );
}

class ChatConversationScreen extends StatefulWidget {
  const ChatConversationScreen({
    super.key,
    required this.conversation,
    required this.currentUserId,
  });

  final Map<String, dynamic> conversation;
  final String currentUserId;

  @override
  State<ChatConversationScreen> createState() => _ChatConversationScreenState();
}

class _ChatConversationScreenState extends State<ChatConversationScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = const [];
  bool _loading = true;
  bool _refreshing = false;
  bool _sending = false;
  String? _error;
  Timer? _refreshTimer;

  String get _chatId => _idOf(widget.conversation);

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_loading && !_sending) _loadMessages(showLoader: false);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages({bool showLoader = true}) async {
    if (_refreshing) return;
    if (_chatId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'This conversation is unavailable.';
      });
      return;
    }
    _refreshing = true;
    if (showLoader) setState(() => _loading = true);
    try {
      final response = await ApiService.getChatMessages(_chatId);
      final raw = response['data'];
      final messages = raw is List
          ? raw
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _messages = messages;
        _loading = false;
        _error = null;
      });
      final unreadIds = messages
          .where((message) => !_isMine(message))
          .where((message) => !_hasRead(message))
          .map(_idOf)
          .where((id) => id.isNotEmpty)
          .toList();
      ApiService.markChatMessagesRead(unreadIds).catchError((_) {});
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = ApiService.readableError(error);
      });
    } finally {
      _refreshing = false;
    }
  }

  bool _isMine(Map<String, dynamic> message) =>
      _idOf(message['senderId']) == widget.currentUserId;

  bool _hasRead(Map<String, dynamic> message) {
    final readers = message['readBy'];
    return readers is List &&
        readers.any((reader) => _idOf(reader) == widget.currentUserId);
  }

  Future<void> _send() async {
    final content = _messageController.text.trim();
    if (content.isEmpty || _sending) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => _sending = true);
    try {
      final sent = await ApiService.sendChatMessage(_chatId, content);
      if (!mounted) return;
      _messageController.clear();
      setState(() => _messages = [sent, ..._messages]);
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiService.readableError(error))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = _conversationName(
      widget.conversation,
      widget.currentUserId,
    );
    final image = _conversationImage(
      widget.conversation,
      widget.currentUserId,
    );
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7F3),
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            _ChatAvatar(name: title, imageUrl: image, size: 38),
            const SizedBox(width: 10),
            Expanded(
              child: Text(title, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh messages',
            onPressed: _loading ? null : () => _loadMessages(showLoader: false),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.navy),
                  )
                : _error != null
                    ? _ChatError(
                        message: _error!,
                        onRetry: _loadMessages,
                      )
                    : _messages.isEmpty
                        ? const _EmptyConversation()
                        : RefreshIndicator(
                            color: AppColors.navy,
                            onRefresh: () => _loadMessages(showLoader: false),
                            child: ListView.builder(
                              controller: _scrollController,
                              reverse: true,
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding:
                                  const EdgeInsets.fromLTRB(14, 18, 14, 12),
                              itemCount: _messages.length,
                              itemBuilder: (context, index) => _MessageBubble(
                                message: _messages[index],
                                mine: _isMine(_messages[index]),
                              ),
                            ),
                          ),
          ),
          _MessageComposer(
            controller: _messageController,
            sending: _sending,
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.conversation,
    required this.currentUserId,
    required this.onTap,
  });

  final Map<String, dynamic> conversation;
  final String currentUserId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = _conversationName(conversation, currentUserId);
    final type = (conversation['type'] ?? '').toString();
    final lastMessage = conversation['lastMessage'];
    final preview = lastMessage is Map
        ? (lastMessage['content'] ?? '').toString().trim()
        : '';
    final unreadCount = int.tryParse(
          (conversation['unreadCount'] ?? 0).toString(),
        ) ??
        0;
    final date = _chatTime(conversation['lastMessageAt'] ??
        conversation['updatedAt'] ??
        conversation['createdAt']);
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              _ChatAvatar(
                name: name,
                imageUrl: _conversationImage(conversation, currentUserId),
                size: 52,
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      preview.isNotEmpty
                          ? preview
                          : type == 'person_to_person'
                              ? 'Private conversation'
                              : type == 'campaign_group'
                                  ? 'Campaign group'
                                  : 'Group conversation',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color:
                            unreadCount > 0 ? AppColors.navy : AppColors.muted,
                        fontWeight: unreadCount > 0
                            ? FontWeight.w700
                            : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    date,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 9),
                  if (unreadCount > 0)
                    Container(
                      constraints: const BoxConstraints(minWidth: 22),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: const BoxDecoration(
                        color: AppColors.navy,
                        borderRadius: BorderRadius.all(Radius.circular(99)),
                      ),
                      child: Text(
                        unreadCount > 99 ? '99+' : '$unreadCount',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    )
                  else
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.muted,
                      size: 20,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.mine});
  final Map<String, dynamic> message;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final content = (message['content'] ?? '').toString();
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * .78,
        ),
        margin: const EdgeInsets.only(bottom: 9),
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
        decoration: BoxDecoration(
          color: mine ? AppColors.navy : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(mine ? 18 : 5),
            bottomRight: Radius.circular(mine ? 5 : 18),
          ),
          border: mine ? null : Border.all(color: AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              content,
              style: TextStyle(
                color: mine ? Colors.white : AppColors.navy,
                fontSize: 14.5,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _chatTime(message['createdAt']),
              style: TextStyle(
                color: mine ? Colors.white60 : AppColors.muted,
                fontSize: 9.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageComposer extends StatelessWidget {
  const _MessageComposer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) => SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  enabled: !sending,
                  minLines: 1,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'Write a message…',
                    prefixIcon: Icon(Icons.chat_bubble_outline_rounded),
                  ),
                  onSubmitted: (_) => onSend(),
                ),
              ),
              const SizedBox(width: 9),
              IconButton.filled(
                tooltip: 'Send message',
                onPressed: sending ? null : onSend,
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.navy,
                  foregroundColor: Colors.white,
                  fixedSize: const Size(48, 48),
                ),
                icon: sending
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 20),
              ),
            ],
          ),
        ),
      );
}

class _ChatAvatar extends StatelessWidget {
  const _ChatAvatar({
    required this.name,
    required this.imageUrl,
    required this.size,
  });
  final String name;
  final String imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: size / 2,
        backgroundColor: AppColors.gold.withValues(alpha: .22),
        backgroundImage: imageUrl.isEmpty ? null : NetworkImage(imageUrl),
        child: imageUrl.isEmpty
            ? Text(
                name.isEmpty ? '?' : name[0].toUpperCase(),
                style: const TextStyle(
                  color: AppColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              )
            : null,
      );
}

class _EmptyInbox extends StatelessWidget {
  const _EmptyInbox({required this.onStart});
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _ChatEmptyState(
              icon: Icons.forum_outlined,
              title: 'No conversations yet',
              message:
                  'Find a traveler and start planning your next adventure.',
            ),
            FilledButton.icon(
              onPressed: onStart,
              icon: const Icon(Icons.add_comment_outlined),
              label: const Text('Start a chat'),
            ),
          ],
        ),
      );
}

class _EmptyConversation extends StatelessWidget {
  const _EmptyConversation();

  @override
  Widget build(BuildContext context) => const _ChatEmptyState(
        icon: Icons.waving_hand_outlined,
        title: 'Start the conversation',
        message: 'Send the first message and plan something memorable.',
      );
}

class _ChatEmptyState extends StatelessWidget {
  const _ChatEmptyState({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(38),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 78,
                height: 78,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: .18),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: AppColors.navy, size: 34),
              ),
              const SizedBox(height: 18),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.navy,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.4),
              ),
            ],
          ),
        ),
      );
}

class _ChatError extends StatelessWidget {
  const _ChatError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined,
                  color: AppColors.muted, size: 42),
              const SizedBox(height: 13),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 15),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
}

class _ChatInboxSkeleton extends StatelessWidget {
  const _ChatInboxSkeleton();

  @override
  Widget build(BuildContext context) => ListView.separated(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 28),
        itemCount: 6,
        separatorBuilder: (_, __) => const SizedBox(height: 9),
        itemBuilder: (_, __) => Container(
          height: 80,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Row(
            children: [
              CircleAvatar(backgroundColor: Color(0xFFE4E7E1), radius: 26),
              SizedBox(width: 13),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ChatSkeletonBar(width: 140, height: 13),
                    SizedBox(height: 9),
                    _ChatSkeletonBar(width: 205, height: 9),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}

class _ChatSkeletonBar extends StatelessWidget {
  const _ChatSkeletonBar({required this.width, required this.height});
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFFE4E7E1),
          borderRadius: BorderRadius.circular(99),
        ),
      );
}

String _idOf(dynamic value) {
  if (value is Map) return (value['_id'] ?? value['id'] ?? '').toString();
  return (value ?? '').toString();
}

Map<String, dynamic>? _otherMember(
  Map<String, dynamic> conversation,
  String currentUserId,
) {
  final members = conversation['members'];
  if (members is! List) return null;
  for (final member in members.whereType<Map>()) {
    if (_idOf(member) != currentUserId) {
      return Map<String, dynamic>.from(member);
    }
  }
  return null;
}

String _personName(dynamic value) {
  if (value is! Map) return '';
  final direct = value['name'];
  if (direct is String && direct.trim().isNotEmpty) return direct.trim();
  if (direct is Map) {
    final nested = [direct['first'], direct['last']]
        .map((part) => (part ?? '').toString().trim())
        .where((part) => part.isNotEmpty)
        .join(' ');
    if (nested.isNotEmpty) return nested;
  }
  return [value['firstName'], value['lastName']]
      .map((part) => (part ?? '').toString().trim())
      .where((part) => part.isNotEmpty)
      .join(' ');
}

String _conversationName(
  Map<String, dynamic> conversation,
  String currentUserId,
) {
  final named = (conversation['name'] ?? '').toString().trim();
  if (named.isNotEmpty) return named;
  final other = _otherMember(conversation, currentUserId);
  final person = _personName(other);
  return person.isEmpty ? 'Traveler' : person;
}

String _conversationImage(
  Map<String, dynamic> conversation,
  String currentUserId,
) {
  final groupImage = (conversation['groupImageUrl'] ?? '').toString().trim();
  if (groupImage.isNotEmpty) return groupImage;
  final other = _otherMember(conversation, currentUserId);
  return (other?['profilePhoto'] ?? '').toString().trim();
}

String _chatTime(dynamic raw) {
  final date = DateTime.tryParse((raw ?? '').toString())?.toLocal();
  if (date == null) return '';
  final now = DateTime.now();
  if (date.year == now.year && date.month == now.month && date.day == now.day) {
    final hour = date.hour % 12 == 0 ? 12 : date.hour % 12;
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute ${date.hour >= 12 ? 'PM' : 'AM'}';
  }
  if (now.difference(date).inDays < 7) {
    return const [
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun'
    ][date.weekday - 1];
  }
  return '${date.day}/${date.month}/${date.year.toString().substring(2)}';
}
