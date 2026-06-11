import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MessagingService, Conversation } from '../../core/messaging.service';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './messaging.component.html',
  styleUrl: './messaging.component.scss',
})
export class MessagingComponent implements OnInit, OnDestroy {
  private msgs = inject(MessagingService);
  private auth = inject(AuthService);

  conversations = this.msgs.conversations;
  messages = this.msgs.messages;
  connected = this.msgs.connected;
  activeConvId = this.msgs.activeConversationId;
  currentUsername = this.auth.username;

  loading = signal(true);
  chatLoading = signal(false);
  newMessage = signal('');

  ngOnInit(): void {
    this.msgs.fetchConversations().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.msgs.disconnectWebSocket();
  }

  selectConversation(conv: Conversation): void {
    this.chatLoading.set(true);
    this.msgs.fetchMessages(conv.id).subscribe({
      next: () => {
        this.chatLoading.set(false);
        this.msgs.markAsRead(conv.id).subscribe();
        this.msgs.connectWebSocket(conv.id);
        this.updateUnreadCount(conv.id, 0);
      },
      error: () => this.chatLoading.set(false),
    });
  }

  send(): void {
    const content = this.newMessage().trim();
    if (!content) return;

    this.msgs.sendViaWebSocket(content);
    this.newMessage.set('');
  }

  otherParticipant(conv: Conversation): string {
    const user = conv.participants.find(
      (p) => p.username !== this.auth.username()
    );
    return user?.username ?? 'Desconocido';
  }

  otherAvatar(conv: Conversation): string {
    const user = conv.participants.find(
      (p) => p.username !== this.auth.username()
    );
    return user?.avatar_url ?? '';
  }

  private updateUnreadCount(convId: number, count: number): void {
    this.conversations.update((list) =>
      list.map((c) => (c.id === convId ? { ...c, unread_count: count } : c))
    );
  }

  trackById(_: number, item: any): number {
    return item.id;
  }
}
