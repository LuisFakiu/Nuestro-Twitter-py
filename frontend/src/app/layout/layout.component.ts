import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { MessagingService } from '../core/messaging.service';
import { NotificationService } from '../core/notification.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private msgs = inject(MessagingService);
  private notif = inject(NotificationService);

  username = this.auth.username;
  avatarUrl = computed(() => this.auth.user()?.avatar_url ?? null);
  unreadCount = this.notif.unreadCount;
  messageUnreadCount = this.msgs.totalUnread;

  ngOnInit(): void {
    this.notif.fetchUnreadCount();
    this.msgs.fetchConversations().subscribe();
    setInterval(() => this.notif.fetchUnreadCount(), 30000);
    setInterval(() => this.msgs.fetchConversations().subscribe(), 30000);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
