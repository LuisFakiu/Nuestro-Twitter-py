import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { FormatContentPipe } from '../../shared/format-content.pipe';
import { Post } from '../../shared/post.types';
import { environment } from '../../../environments/environment';

interface PublicProfile {
  username: string;
  bio: string;
  avatar_url: string;
  location: string;
  date_joined: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
  is_blocked: boolean;
}

interface FollowUser {
  username: string;
  avatar_url: string;
  bio: string;
}

type FollowModalMode = 'followers' | 'following' | null;

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [DatePipe, RouterLink, FormatContentPipe],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly apiBase = environment.apiUrl;

  profile = signal<PublicProfile | null>(null);
  posts = signal<Post[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  followLoading = signal(false);

  followModalMode = signal<FollowModalMode>(null);
  followList = signal<FollowUser[]>([]);
  followListLoading = signal(false);

  actionTarget = signal<{ user: FollowUser; action: 'remove' | 'unfollow' } | null>(null);
  actionLoading = signal(false);

  deleteTarget = signal<Post | null>(null);
  deleting = signal(false);

  repostDeleteTarget = signal<Post | null>(null);
  repostDeleting = signal(false);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const username = params.get('username');
      if (!username) return;
      this.profile.set(null);
      this.posts.set([]);
      this.error.set(null);
      this.loading.set(true);
      this.loadProfile(username);
      this.loadPosts(username);
    });
  }

  private loadProfile(username: string): void {
    this.http.get<PublicProfile>(`${this.apiBase}/users/${username}/`).subscribe({
      next: (p) => this.profile.set(p),
      error: () => this.error.set('Usuario no encontrado'),
    });
  }

  private loadPosts(username: string): void {
    this.http.get<any>(`${this.apiBase}/users/${username}/posts/`).subscribe({
      next: (res) => this.posts.set(res.results || []),
      error: () => {},
      complete: () => this.loading.set(false),
    });
  }

  toggleFollow(): void {
    const p = this.profile();
    if (!p) return;
    this.followLoading.set(true);
    const method = p.is_following ? 'DELETE' : 'POST';
    this.http.request(method, `${this.apiBase}/users/${p.username}/follow/`, { responseType: 'text' }).subscribe({
      next: () => {
        this.profile.set({ ...p, is_following: !p.is_following });
        this.followLoading.set(false);
      },
      error: () => (this.followLoading.set(false)),
    });
  }

  blockUser(): void {
    const p = this.profile();
    if (!p) return;
    const method = p.is_blocked ? 'DELETE' : 'POST';
    const url = p.is_blocked
      ? `${this.apiBase}/users/${p.username}/unblock/`
      : `${this.apiBase}/users/${p.username}/block/`;
    this.http.request(method, url, { responseType: 'text' }).subscribe({
      next: () => {
        this.profile.set({ ...p, is_blocked: !p.is_blocked });
      },
      error: () => {},
    });
  }

  toggleLike(post: Post): void {
    const method = post.is_liked ? 'DELETE' : 'POST';
    this.http.request(method, `${this.apiBase}/posts/${post.id}/like/`, { responseType: 'text' }).subscribe({
      next: () => {
        this.posts.update(list => list.map(p =>
          p.id === post.id
            ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
            : p
        ));
      },
    });
  }

  toggleRepost(post: Post): void {
    if (post.is_repost) {
      this.repostDeleteTarget.set(post);
    } else if (post.is_reposted) {
      this.http.delete(`${this.apiBase}/posts/${post.id}/repost/`, { responseType: 'json' }).subscribe({
        next: () => {
          this.posts.update(list => list.map(p =>
            p.id === post.id ? { ...p, is_reposted: false, repost_count: p.repost_count - 1 } : p
          ));
        },
      });
    } else {
      this.http.post(`${this.apiBase}/posts/${post.id}/repost/`, {}, { responseType: 'json' }).subscribe({
        next: () => {
          this.posts.update(list => list.map(p =>
            p.id === post.id ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 } : p
          ));
        },
      });
    }
  }

  askDeleteRepost(post: Post): void { this.repostDeleteTarget.set(post); }
  cancelDeleteRepost(): void { if (this.repostDeleting()) return; this.repostDeleteTarget.set(null); }
  confirmDeleteRepost(): void {
    const post = this.repostDeleteTarget();
    if (!post) return;
    this.repostDeleting.set(true);
    this.http.delete(`${this.apiBase}/posts/${post.id}/`, { responseType: 'text' }).subscribe({
      next: () => {
        this.posts.update(list => list.filter(p => p.id !== post.id));
        this.repostDeleting.set(false);
        this.repostDeleteTarget.set(null);
      },
      error: () => { this.repostDeleting.set(false); this.repostDeleteTarget.set(null); },
    });
  }

  askDelete(post: Post): void { this.deleteTarget.set(post); }
  cancelDelete(): void { if (this.deleting()) return; this.deleteTarget.set(null); }
  confirmDelete(): void {
    const post = this.deleteTarget();
    if (!post) return;
    this.deleting.set(true);
    this.http.delete(`${this.apiBase}/posts/${post.id}/`, { responseType: 'text' }).subscribe({
      next: () => {
        this.posts.update((list) => list.filter((p) => p.id !== post.id));
        this.deleting.set(false);
        this.deleteTarget.set(null);
      },
      error: () => { this.deleting.set(false); this.deleteTarget.set(null); },
    });
  }

  isOwnProfile(): boolean {
    return this.auth.username() === this.profile()?.username;
  }

  isOwnPost(post: Post): boolean {
    return this.auth.user()?.id === post.author;
  }

  openFollowModal(mode: 'followers' | 'following'): void {
    const p = this.profile();
    if (!p) return;
    this.followModalMode.set(mode);
    this.followList.set([]);
    this.followListLoading.set(true);
    this.http.get<any>(`${this.apiBase}/users/${p.username}/${mode}/`).subscribe({
      next: (res) => {
        this.followList.set(res.results || res || []);
        this.followListLoading.set(false);
      },
      error: () => this.followListLoading.set(false),
    });
  }

  closeFollowModal(): void {
    this.followModalMode.set(null);
    this.followList.set([]);
  }

  askAction(user: FollowUser, action: 'remove' | 'unfollow'): void {
    this.actionTarget.set({ user, action });
  }

  cancelAction(): void {
    if (this.actionLoading()) return;
    this.actionTarget.set(null);
  }

  confirmAction(): void {
    const target = this.actionTarget();
    if (!target) return;
    const url =
      target.action === 'remove'
        ? `${this.apiBase}/users/${target.user.username}/remove-follower/`
        : `${this.apiBase}/users/${target.user.username}/follow/`;
    this.actionLoading.set(true);
    this.http.request('DELETE', url, { responseType: 'text' }).subscribe({
      next: () => {
        this.followList.update((list) => list.filter((u) => u.username !== target.user.username));
        const p = this.profile();
        if (p) {
          if (target.action === 'remove') {
            this.profile.set({ ...p, followers_count: Math.max(0, p.followers_count - 1) });
          } else {
            this.profile.set({ ...p, following_count: Math.max(0, p.following_count - 1) });
          }
        }
        this.actionLoading.set(false);
        this.actionTarget.set(null);
      },
      error: () => {
        this.actionLoading.set(false);
        this.actionTarget.set(null);
      },
    });
  }
}
