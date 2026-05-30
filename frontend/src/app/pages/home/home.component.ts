import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { FormatContentPipe } from '../../shared/format-content.pipe';
import { Post } from '../../shared/post.types';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, FormatContentPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly apiBase = environment.apiUrl;

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

  repostTarget = signal<Post | null>(null);
  repostModalMode = signal<'menu' | 'quote' | null>(null);
  quoteContent = signal('');
  quoteImageUrl = signal('');
  quoteFile = signal<File | null>(null);
  quotePreviewUrl = signal<string | null>(null);
  quoteUploading = signal(false);
  quoting = signal(false);

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
      this.repostTarget.set(post);
      this.repostModalMode.set('menu');
      this.quoteContent.set('');
      this.quoteImageUrl.set('');
      this.quoteFile.set(null);
      this.quotePreviewUrl.set(null);
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

  onQuoteFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.quoteFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.quotePreviewUrl.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  removeQuoteFile(): void {
    this.quoteFile.set(null);
    this.quotePreviewUrl.set(null);
    this.quoteImageUrl.set('');
  }

  private uploadQuoteFile(): Promise<string | null> {
    const file = this.quoteFile();
    if (!file) return Promise.resolve(null);
    this.quoteUploading.set(true);
    const fd = new FormData();
    fd.append('file', file);
    return new Promise((resolve) => {
      this.http.post<{ url: string }>(`${this.apiBase}/upload/`, fd).subscribe({
        next: (res) => { this.quoteUploading.set(false); resolve(res.url); },
        error: () => { this.quoteUploading.set(false); resolve(null); },
      });
    });
  }

  async sendQuote(post: Post): Promise<void> {
    const content = this.quoteContent().trim();
    if (!content) return;
    this.quoting.set(true);
    const body: any = { content };

    if (this.quoteFile()) {
      const url = await this.uploadQuoteFile();
      if (url) body.image_url = url;
      else { this.quoting.set(false); return; }
    } else {
      const imageUrl = this.quoteImageUrl().trim();
      if (imageUrl) body.image_url = imageUrl;
    }

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
    this.quoteFile.set(null);
    this.quotePreviewUrl.set(null);
    this.quoteUploading.set(false);
    this.quoting.set(false);
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
