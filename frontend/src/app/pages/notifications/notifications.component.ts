import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService, Notification } from '../../core/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private notif = inject(NotificationService);

  notifications = signal<Notification[]>([]);
  loading = signal(true);
  actionLoading = signal<Record<number, boolean>>({});

  ngOnInit(): void {
    this.notif.getNotifications().subscribe({
      next: (res) => {
        this.notifications.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  markAllRead(): void {
    this.notif.markAllRead().subscribe(() => {
      this.notifications.update((list) =>
        list.map((n) => ({ ...n, is_read: true }))
      );
    });
  }

  acceptRequest(n: Notification): void {
    this.actionLoading.update((l) => ({ ...l, [n.id]: true }));
    this.notif.acceptFollowRequest(n.actor_username).subscribe({
      next: () => this.notifications.update((list) => list.filter((x) => x.id !== n.id)),
      error: () => this.actionLoading.update((l) => ({ ...l, [n.id]: false })),
      complete: () => this.actionLoading.update((l) => ({ ...l, [n.id]: false })),
    });
  }

  rejectRequest(n: Notification): void {
    this.actionLoading.update((l) => ({ ...l, [n.id]: true }));
    this.notif.rejectFollowRequest(n.actor_username).subscribe({
      next: () => this.notifications.update((list) => list.filter((x) => x.id !== n.id)),
      error: () => this.actionLoading.update((l) => ({ ...l, [n.id]: false })),
      complete: () => this.actionLoading.update((l) => ({ ...l, [n.id]: false })),
    });
  }

  verbLabel(verb: string): string {
    const labels: Record<string, string> = {
      like: 'le gustó tu post',
      follow: 'empezó a seguirte',
      follow_request: 'quiere seguirte',
      mention: 'te mencionó en un post',
      reply: 'respondió a tu post',
      repost: 'reposteó tu post',
    };
    return labels[verb] || verb;
  }
}
