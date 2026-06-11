import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface Participant {
  id: number;
  username: string;
  avatar_url: string;
}

export interface MessageData {
  id: number;
  sender: Participant;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  participants: Participant[];
  last_message: MessageData | null;
  unread_count: number;
  is_pinned: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly apiBase = environment.apiUrl;
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;

  readonly conversations = signal<Conversation[]>([]);
  readonly messages = signal<MessageData[]>([]);
  readonly connected = signal(false);
  readonly activeConversationId = signal<number | null>(null);
  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + c.unread_count, 0)
  );

  constructor(private http: HttpClient, private auth: AuthService) {}

  fetchConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiBase}/messages/conversations/`).pipe(
      map((list) => {
        this.conversations.set(list);
        return list;
      })
    );
  }

  getOrCreateConversation(userId: number): Observable<Conversation> {
    return this.http.post<Conversation>(
      `${this.apiBase}/messages/conversations/get-or-create/`,
      { user_id: userId }
    );
  }

  fetchMessages(conversationId: number): Observable<MessageData[]> {
    return this.http
      .get<MessageData[]>(
        `${this.apiBase}/messages/conversations/${conversationId}/`
      )
      .pipe(
        map((list) => {
          this.messages.set(list);
          return list;
        })
      );
  }

  sendMessage(conversationId: number, content: string): Observable<MessageData> {
    return this.http.post<MessageData>(
      `${this.apiBase}/messages/conversations/${conversationId}/`,
      { content }
    );
  }

  markAsRead(conversationId: number): Observable<any> {
    return this.http.post(
      `${this.apiBase}/messages/conversations/${conversationId}/read/`,
      {}
    );
  }

  pinConversation(conversationId: number): Observable<any> {
    return this.http.post(
      `${this.apiBase}/messages/conversations/${conversationId}/pin/`,
      {}
    );
  }

  unpinConversation(conversationId: number): Observable<any> {
    return this.http.post(
      `${this.apiBase}/messages/conversations/${conversationId}/unpin/`,
      {}
    );
  }

  hideConversation(conversationId: number): Observable<any> {
    return this.http.post(
      `${this.apiBase}/messages/conversations/${conversationId}/hide/`,
      {}
    );
  }

  connectWebSocket(conversationId: number): void {
    this.disconnectWebSocket();
    this.activeConversationId.set(conversationId);

    const token = this.auth.getAccessToken();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = environment.apiUrl.replace(/^https?:\/\//, '').replace(/\/api$/, '');
    const url = `${protocol}://${host}/ws/chat/${conversationId}/?token=${token}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected.set(true);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        this.messages.update((msgs) => [...msgs, data]);
        this.fetchConversations().subscribe();
      }
    };

    this.ws.onclose = () => {
      this.connected.set(false);
      this.ws = null;
    };

    this.ws.onerror = () => {
      this.connected.set(false);
    };
  }

  sendViaWebSocket(content: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ content }));
    }
  }

  disconnectWebSocket(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected.set(false);
    this.activeConversationId.set(null);
  }
}
