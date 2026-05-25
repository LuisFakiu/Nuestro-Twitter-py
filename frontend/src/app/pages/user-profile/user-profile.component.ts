import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';

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
}

interface Post {
  id: number;
  author_username: string;
  content: string;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
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
  imports: [DatePipe, RouterLink],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly apiBase = 'http://localhost:8000/api';

  profile = signal<PublicProfile | null>(null);
  posts = signal<Post[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  followLoading = signal(false);

  followModalMode = signal<FollowModalMode>(null);
  followList = signal<FollowUser[]>([]);
  followListLoading = signal(false);

  ngOnInit(): void {
    const username = this.route.snapshot.paramMap.get('username')!;
    this.loadProfile(username);
    this.loadPosts(username);
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

  toggleLike(post: Post): void {
    const method = post.is_liked ? 'DELETE' : 'POST';
    this.http.request(method, `${this.apiBase}/posts/${post.id}/like/`, { responseType: 'text' }).subscribe({
      next: () => {
        post.is_liked = !post.is_liked;
        post.likes_count += post.is_liked ? 1 : -1;
      },
    });
  }

  isOwnProfile(): boolean {
    return this.auth.username() === this.profile()?.username;
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
}
