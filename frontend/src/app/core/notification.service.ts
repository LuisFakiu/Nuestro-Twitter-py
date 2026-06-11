import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface Notification {
  id: number;
  actor_username: string;
  actor_avatar: string;
  verb: string;
  target_post: number | null;
  is_read: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiBase = environment.apiUrl;
  private readonly _unreadCount = signal(0);
  readonly unreadCount = this._unreadCount.asReadonly();

  constructor(private http: HttpClient, private auth: AuthService) {}

  fetchUnreadCount(): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.get<{ count: number }>(`${this.apiBase}/notifications/unread-count/`).subscribe({
      next: (res) => this._unreadCount.set(res.count),
    });
  }

  getNotifications(): Observable<Notification[]> {
    return this.http.get<any>(`${this.apiBase}/notifications/`).pipe(
      map((res) => {
        const list: Notification[] = res.results || res;
        const unread = list.filter((n) => !n.is_read).length;
        this._unreadCount.set(unread);
        return list;
      }),
    );
  }

  markAllRead(): Observable<any> {
    return this.http.post(`${this.apiBase}/notifications/mark-all-read/`, {}).pipe(
      tap(() => this._unreadCount.set(0)),
    );
  }

  acceptFollowRequest(username: string): Observable<any> {
    return this.http.post(`${this.apiBase}/users/${username}/handle-follow-request/`, {}, { responseType: 'text' });
  }

  rejectFollowRequest(username: string): Observable<any> {
    return this.http.delete(`${this.apiBase}/users/${username}/handle-follow-request/`, { responseType: 'text' });
  }
}
