import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MessagingService, Conversation } from '../../core/messaging.service';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './messaging.component.html',
  styleUrl: './messaging.component.scss',
})
export class MessagingComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') private msgContainer!: ElementRef;

  private msgs = inject(MessagingService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  conversations = this.msgs.conversations;
  messages = this.msgs.messages;
  connected = this.msgs.connected;
  activeConvId = this.msgs.activeConversationId;
  currentUsername = this.auth.username;

  loading = signal(true);
  chatLoading = signal(false);
  newMessage = signal('');
  private autoScrollEnabled = true;

  ngOnInit(): void {
    this.msgs.fetchConversations().subscribe({
      next: (convs) => {
        this.loading.set(false);
        const convId = this.route.snapshot.queryParamMap.get('conv');
        if (convId) {
          const conv = convs.find((c) => c.id === Number(convId));
          if (conv) this.selectConversation(conv);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  ngAfterViewChecked(): void {
    if (this.autoScrollEnabled) {
      this.scrollToBottom();
    }
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
        this.scrollToBottom();
      },
      error: () => this.chatLoading.set(false),
    });
  }

  private scrollToBottom(): void {
    try {
      const el = this.msgContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch {}
  }

  send(): void {
    const content = this.newMessage().trim();
    if (!content) return;

    this.msgs.sendViaWebSocket(content);
    this.newMessage.set('');
    this.autoScrollEnabled = true;
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

  onScroll(): void {
    const el = this.msgContainer?.nativeElement;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    this.autoScrollEnabled = atBottom;
  }

  trackById(_: number, item: any): number {
    return item.id;
  }
}
