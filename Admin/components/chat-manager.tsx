'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface ChatConversation {
  _id: string;
  type: 'person_to_person' | 'group' | 'campaign_group';
  name?: string;
  members: Array<{ _id: string; name: string; profilePhoto: string }>;
  createdBy: { _id: string; name: string };
  groupImageUrl?: string;
  lastMessageAt: string;
  isActive: boolean;
  campaignId?: string;
}

interface ChatMessage {
  _id: string;
  content: string;
  senderId: { _id: string; name: string; profilePhoto: string };
  messageType: string;
  isDeleted: boolean;
  readBy: string[];
  createdAt: string;
}

export default function ChatManager() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalConversations, setTotalConversations] = useState(0);
  const [messageSearch, setMessageSearch] = useState('');
  const itemsPerPage = 20;

  useEffect(() => {
    fetchConversations();
  }, [page]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation._id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `/api/chat/conversations?page=${page}&limit=${itemsPerPage}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      setConversations(data.data || []);
      setTotalConversations(data.total || 0);
    } catch (err) {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatGroupId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/chat/messages/${chatGroupId}?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setMessages(data.data || []);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const searchMessages = async () => {
    if (!selectedConversation) {
      return;
    }

    if (!messageSearch.trim()) {
      fetchMessages(selectedConversation._id);
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `/api/chat/messages/${selectedConversation._id}/search?query=${encodeURIComponent(messageSearch)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      setMessages(data.data || []);
    } catch (err) {
      setError('Search failed');
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'person_to_person':
        return 'bg-blue-100 text-blue-800';
      case 'group':
        return 'bg-green-100 text-green-800';
      case 'campaign_group':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConversationTitle = (conv: ChatConversation) => {
    if (conv.type === 'person_to_person') {
      const otherMember = conv.members.find((m) => m._id !== conv.createdBy._id);
      return otherMember?.name || 'Unknown';
    }
    return conv.name || `Group (${conv.members.length} members)`;
  };

  if (error) {
    return <div className="text-red-600 p-4">{error}</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Conversations List */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold">Messages</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No conversations</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv._id}
                onClick={() => {
                  setSelectedConversation(conv);
                  setMessages([]);
                }}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${
                  selectedConversation?._id === conv._id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{getConversationTitle(conv)}</h3>
                    <p className="text-xs text-gray-500">
                      {conv.members.length} {conv.type === 'person_to_person' ? 'member' : 'members'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getTypeColor(conv.type)}`}>
                    {conv.type === 'person_to_person' ? 'DM' : conv.type === 'group' ? 'Group' : 'Campaign'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-600">
                    {new Date(conv.lastMessageAt).toLocaleDateString()}
                  </span>
                  {!conv.isActive && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Inactive</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalConversations > 0 && (
          <div className="p-4 border-t space-y-2">
            <div className="text-xs text-gray-600">
              Page {page} of {Math.ceil(totalConversations / itemsPerPage)}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex-1 px-2 py-1 bg-gray-200 rounded disabled:opacity-50 text-sm"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * itemsPerPage >= totalConversations}
                className="flex-1 px-2 py-1 bg-gray-200 rounded disabled:opacity-50 text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Messages View */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b p-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{getConversationTitle(selectedConversation)}</h2>
              <p className="text-sm text-gray-500">
                {selectedConversation.type === 'person_to_person'
                  ? 'Direct Message'
                  : selectedConversation.type === 'group'
                    ? 'Group Chat'
                    : 'Campaign Chat'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded text-sm font-semibold ${getTypeColor(selectedConversation.type)}`}>
              {selectedConversation.type === 'person_to_person'
                ? 'DM'
                : selectedConversation.type === 'group'
                  ? 'Group'
                  : 'Campaign'}
            </span>
          </div>

          {/* Search Messages */}
          <div className="bg-white border-b p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                placeholder="Search messages..."
                className="flex-1 px-3 py-2 border rounded text-sm"
                onKeyPress={(e) => e.key === 'Enter' && searchMessages()}
              />
              <button
                onClick={searchMessages}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No messages</div>
            ) : (
              messages.map((msg) => (
                <div key={msg._id} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-start space-x-3">
                    {msg.senderId.profilePhoto && (
                      <div className="relative w-8 h-8">
                        <Image
                          src={msg.senderId.profilePhoto}
                          alt={msg.senderId.name}
                          fill
                          className="rounded-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{msg.senderId.name}</h4>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${msg.isDeleted ? 'text-gray-400 italic' : ''}`}>
                        {msg.content}
                      </p>
                      {msg.messageType !== 'text' && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded mt-2 inline-block">
                          {msg.messageType}
                        </span>
                      )}
                      {msg.readBy.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Read by {msg.readBy.length} {msg.readBy.length === 1 ? 'person' : 'people'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Conversation Info */}
          <div className="bg-white border-t p-4">
            <h3 className="font-semibold text-sm mb-3">Members ({selectedConversation.members.length})</h3>
            <div className="flex flex-wrap gap-2">
              {selectedConversation.members.map((member) => (
                <div key={member._id} className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-full">
                  {member.profilePhoto && (
                    <div className="relative w-6 h-6">
                      <Image
                        src={member.profilePhoto}
                        alt={member.name}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-sm">{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p>Select a conversation to view messages</p>
        </div>
      )}
    </div>
  );
}
