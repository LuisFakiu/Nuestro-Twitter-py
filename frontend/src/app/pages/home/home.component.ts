import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';

interface AppConfig {
  site_name: string;
  post_max_chars: number;
  posts_per_page: number;
}

interface Post {
  id: number;
  author_username: string;
  content: string;
  created_at: string;
  likes_count: number;
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
  imports: [CommonModule, DatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private http = inject(HttpClient);

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
}
