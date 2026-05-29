import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { FormatContentPipe } from '../../shared/format-content.pipe';
import { Post } from '../../shared/post.types';

interface AppConfig {
  site_name: string;
  post_max_chars: number;
  posts_per_page: number;
}

interface PaginatedPosts {
  count: number;
  next: string | null;
  previous: string | null;
  results: Post[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormatContentPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly apiBase = 'http://localhost:8000/api';

  config = signal<AppConfig | null>(null);
  posts = signal<Post[]>([]);
  page = signal(1);
  pageSize = signal(20);
  total = signal(0);
  totalPages = signal(1);
  hasNext = signal(false);
  hasPrev = signal(false);
  loading = signal(true);
  error = signal<string | null>(null);
  maintenance = signal(false);

  deleteTarget = signal<Post | null>(null);
  deleting = signal(false);

  ngOnInit(): void {
    this.http.get<AppConfig>(`${this.apiBase}/config/`).subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        this.pageSize.set(cfg.posts_per_page);
        this.loadPage(1);
      },
      error: () => this.loadPage(1),
    });
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.maintenance.set(false);
    this.http
      .get<PaginatedPosts>(`${this.apiBase}/posts/?page=${page}`)
      .subscribe({
        next: (res) => {
          this.posts.set(res.results);
          this.total.set(res.count);
          this.page.set(page);
          this.hasNext.set(!!res.next);
          this.hasPrev.set(!!res.previous);
          this.totalPages.set(Math.max(1, Math.ceil(res.count / this.pageSize())));
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          if (err.error?.maintenance || err.status === 503) {
            this.maintenance.set(true);
          } else {
            this.error.set(err.message ?? 'No se pudo cargar /api/posts/');
          }
          this.loading.set(false);
        },
      });
  }

  next(): void {
    if (this.hasNext()) this.loadPage(this.page() + 1);
  }

  prev(): void {
    if (this.hasPrev()) this.loadPage(this.page() - 1);
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
    if (post.is_reposted) {
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

  askDelete(post: Post): void {
    this.deleteTarget.set(post);
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

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
      error: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
      },
    });
  }

  isOwnPost(post: Post): boolean {
    return this.auth.user()?.id === post.author;
  }
}
