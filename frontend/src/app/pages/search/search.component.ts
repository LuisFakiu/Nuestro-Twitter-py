import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { FormatContentPipe } from '../../shared/format-content.pipe';
import { Post } from '../../shared/post.types';
import { environment } from '../../../environments/environment';

type Tab = 'posts' | 'hashtags' | 'users';

interface Hashtag {
  id: number;
  name: string;
  post_count: number;
}

interface User {
  username: string;
  bio: string;
  avatar_url: string;
  location: string;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, FormatContentPipe],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  private readonly apiBase = environment.apiUrl;

  query = signal('');
  activeTab = signal<Tab>('posts');
  searching = signal(false);
  searched = signal(false);

  posts = signal<Post[]>([]);
  hashtags = signal<Hashtag[]>([]);
  users = signal<User[]>([]);

  deleteTarget = signal<Post | null>(null);
  deleting = signal(false);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const q = params['q'] || '';
      const tab = params['tab'] as Tab | undefined;
      if (q) {
        this.query.set(q);
        if (tab && ['posts', 'hashtags', 'users'].includes(tab)) {
          this.activeTab.set(tab);
        }
        this.search();
      }
    });
  }

  onQueryChange(value: string): void {
    this.query.set(value);
  }

  onKeyupEnter(): void {
    if (this.query().trim()) this.search();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  search(): void {
    const q = this.query().trim();
    if (!q) return;
    this.searching.set(true);
    this.searched.set(true);

    this.router.navigate([], {
      queryParams: { q, tab: this.activeTab() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    this.http
      .get<any>(`${this.apiBase}/search/?q=${encodeURIComponent(q)}`)
      .subscribe({
        next: (res) => this.posts.set(res.results || res || []),
        error: () => this.posts.set([]),
      });

    this.http
      .get<any>(`${this.apiBase}/hashtags/search/?q=${encodeURIComponent(q)}`)
      .subscribe({
        next: (res) => this.hashtags.set(res.results || res || []),
        error: () => this.hashtags.set([]),
      });

    this.http
      .get<any>(`${this.apiBase}/users/?q=${encodeURIComponent(q)}`)
      .subscribe({
        next: (res) => this.users.set(res.results || res || []),
        error: () => this.users.set([]),
        complete: () => this.searching.set(false),
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

  isOwnPost(post: Post): boolean {
    return this.auth.user()?.id === post.author;
  }
}
