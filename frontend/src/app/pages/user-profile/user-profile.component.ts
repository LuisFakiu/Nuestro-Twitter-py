import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { FormatContentPipe } from '../../shared/format-content.pipe';
import { Post } from '../../shared/post.types';
import { environment } from '../../../environments/environment';

interface PublicProfile {
  username: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  is_private?: boolean;
  date_joined?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  is_following?: boolean;
  is_pending_follow?: boolean;
  is_blocked?: boolean;
  is_blocked_by?: boolean;
}

interface FollowUser {
  username: string;
  avatar_url: string;
  bio: string;
}

interface FollowRequestUser {
  id: number;
  username: string;
  avatar_url: string;
  bio: string;
  created_at: string;
}

type FollowModalMode = 'followers' | 'following' | null;

type ProfileTab = 'posts' | 'reposts' | 'comments' | 'likes';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [DatePipe, RouterLink, FormsModule, FormatContentPipe],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  private readonly apiBase = environment.apiUrl;

  profile = signal<PublicProfile | null>(null);
  posts = signal<Post[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  followLoading = signal(false);
  activeTab = signal<ProfileTab>('posts');

  followModalMode = signal<FollowModalMode>(null);
  followList = signal<FollowUser[]>([]);
  followListLoading = signal(false);

  actionTarget = signal<{ user: FollowUser; action: 'remove' | 'unfollow' } | null>(null);
  actionLoading = signal(false);

  requestsModalOpen = signal(false);
  pendingRequests = signal<FollowRequestUser[]>([]);
  requestsLoading = signal(false);

  deleteTarget = signal<Post | null>(null);
  deleting = signal(false);

  repostDeleteTarget = signal<Post | null>(null);
  repostDeleting = signal(false);

  repostTarget = signal<Post | null>(null);
  repostModalMode = signal<'menu' | 'quote' | null>(null);
  quoteContent = signal('');
  quoteImageUrl = signal('');
  quoting = signal(false);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const username = params.get('username');
      if (!username) return;
      this.profile.set(null);
      this.posts.set([]);
      this.error.set(null);
      this.loading.set(true);
      this.activeTab.set('posts');
      this.loadProfile(username);
      this.loadPosts(username, 'posts');
    });
  }

  private loadProfile(username: string): void {
    this.http.get<PublicProfile>(`${this.apiBase}/users/${username}/`).subscribe({
      next: (p) => this.profile.set(p),
      error: () => this.error.set('Usuario no encontrado'),
    });
  }

  private loadPosts(username: string, tab: ProfileTab): void {
    this.loading.set(true);
    this.http.get<any>(`${this.apiBase}/users/${username}/posts/?tab=${tab}`).subscribe({
      next: (res) => this.posts.set(res.results || []),
      error: () => {},
      complete: () => this.loading.set(false),
    });
  }

  switchTab(tab: ProfileTab): void {
    const username = this.profile()?.username;
    if (!username || tab === this.activeTab()) return;
    this.activeTab.set(tab);
    this.loadPosts(username, tab);
  }

  goToPost(post: Post, event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button, a, .post__foot, .shared-post, .confirm-backdrop, .follow-modal-backdrop, .confirm-modal-backdrop')) {
      return;
    }
    if (post.is_comment && post.parent_id) {
      this.router.navigate(['/post', post.parent_id]);
    } else if ((post.is_repost || post.is_quote) && post.shared_post) {
      this.router.navigate(['/post', post.shared_post.id]);
    } else {
      this.router.navigate(['/post', post.id]);
    }
  }

  toggleFollow(): void {
    const p = this.profile();
    if (!p) return;
    this.followLoading.set(true);
    const isFollowing = !!p.is_following;
    const isPending = !!p.is_pending_follow;
    const method = isFollowing || isPending ? 'DELETE' : 'POST';
    this.http.request(method, `${this.apiBase}/users/${p.username}/follow/`, { responseType: 'text' }).subscribe({
      next: () => {
        if (method === 'POST') {
          this.profile.set({
            ...p,
            is_pending_follow: !!p.is_private,
            is_following: !p.is_private,
            followers_count: p.followers_count! + (p.is_private ? 0 : 1),
          });
        } else {
          this.profile.set({
            ...p,
            is_following: false,
            is_pending_follow: false,
            followers_count: Math.max(0, p.followers_count! - (isFollowing ? 1 : 0)),
          });
        }
        this.followLoading.set(false);
      },
      error: () => (this.followLoading.set(false)),
    });
  }

  blockUser(): void {
    const p = this.profile();
    if (!p) return;
    this.followLoading.set(true);
    const method = p.is_blocked ? 'DELETE' : 'POST';
    const url = p.is_blocked
      ? `${this.apiBase}/users/${p.username}/unblock/`
      : `${this.apiBase}/users/${p.username}/block/`;
    this.http.request(method, url, { responseType: 'text' }).subscribe({
      next: () => {
        this.followLoading.set(false);
        this.loadProfile(p.username);
      },
      error: () => { this.followLoading.set(false); },
    });
  }

  toggleLike(post: Post): void {
    const method = post.is_liked ? 'DELETE' : 'POST';
    this.http.request(method, `${this.apiBase}/posts/${post.id}/like/`, { responseType: 'text' }).subscribe({
      next: () => {
        if (method === 'DELETE' && this.activeTab() === 'likes' && this.isOwnProfile()) {
          this.posts.update(list => list.filter(p => p.id !== post.id));
        } else {
          this.posts.update(list => list.map(p =>
            p.id === post.id
              ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
              : p
          ));
        }
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
      this.repostTarget.set(post);
      this.repostModalMode.set('menu');
      this.quoteContent.set('');
      this.quoteImageUrl.set('');
    }
  }

  simpleRepost(post: Post): void {
    this.http.post(`${this.apiBase}/posts/${post.id}/repost/`, {}, { responseType: 'json' }).subscribe({
      next: () => {
        this.posts.update(list => list.map(p =>
          p.id === post.id ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 } : p
        ));
        this.closeRepostModal();
      },
    });
  }

  sendQuote(post: Post): void {
    const content = this.quoteContent().trim();
    const imageUrl = this.quoteImageUrl().trim();
    if (!content) return;
    this.quoting.set(true);
    const body: any = { content };
    if (imageUrl) body.image_url = imageUrl;
    this.http.post(`${this.apiBase}/posts/${post.id}/repost/`, body, { responseType: 'json' }).subscribe({
      next: () => {
        this.posts.update(list => list.map(p =>
          p.id === post.id ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 } : p
        ));
        this.closeQuoteComposer();
        this.quoting.set(false);
      },
      error: () => this.quoting.set(false),
    });
  }

  closeRepostModal(): void {
    this.repostTarget.set(null);
    this.repostModalMode.set(null);
  }

  closeQuoteComposer(): void {
    this.closeRepostModal();
    this.quoteContent.set('');
    this.quoteImageUrl.set('');
    this.quoting.set(false);
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

  emptyMessage(): string {
    switch (this.activeTab()) {
      case 'reposts': return 'sin reposts todavía.';
      case 'comments': return 'sin comentarios todavía.';
      case 'likes': return 'sin likes todavía.';
      default: return 'sin posts todavía.';
    }
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

  openRequestsModal(): void {
    this.requestsModalOpen.set(true);
    this.pendingRequests.set([]);
    this.requestsLoading.set(true);
    this.http.get<FollowRequestUser[]>(`${this.apiBase}/me/follow-requests/`).subscribe({
      next: (res) => this.pendingRequests.set(res || []),
      error: () => {},
      complete: () => this.requestsLoading.set(false),
    });
  }

  closeRequestsModal(): void {
    this.requestsModalOpen.set(false);
    this.pendingRequests.set([]);
  }

  acceptRequest(req: FollowRequestUser): void {
    this.http.post(`${this.apiBase}/users/${req.username}/handle-follow-request/`, {}, { responseType: 'text' }).subscribe({
      next: () => {
        this.pendingRequests.update(list => list.filter(r => r.id !== req.id));
        this.profile.update(p => p ? { ...p, followers_count: (p.followers_count ?? 0) + 1 } : p);
      },
    });
  }

  rejectRequest(req: FollowRequestUser): void {
    this.http.delete(`${this.apiBase}/users/${req.username}/handle-follow-request/`, { responseType: 'text' }).subscribe({
      next: () => {
        this.pendingRequests.update(list => list.filter(r => r.id !== req.id));
      },
    });
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
            this.profile.set({ ...p, followers_count: Math.max(0, (p.followers_count ?? 0) - 1) });
          } else {
            this.profile.set({ ...p, following_count: Math.max(0, (p.following_count ?? 0) - 1) });
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
