import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { FormatContentPipe } from '../../shared/format-content.pipe';
import { Post } from '../../shared/post.types';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, FormsModule, FormatContentPipe],
  templateUrl: './post-detail.component.html',
  styleUrl: './post-detail.component.scss',
})
export class PostDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly apiBase = environment.apiUrl;

  post = signal<Post | null>(null);
  replies = signal<Post[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  replyText = signal('');
  replyImageUrl = signal('');
  replying = signal(false);

  deleteTarget = signal<Post | null>(null);
  deleting = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(+id);
  }

  private load(id: number): void {
    this.loading.set(true);
    this.http.get<Post>(`${this.apiBase}/posts/${id}/detail/`).subscribe({
      next: (post) => {
        this.post.set(post);
        this.loadReplies(id);
      },
      error: () => {
        this.error.set('Post no encontrado');
        this.loading.set(false);
      },
    });
  }

  private loadReplies(id: number): void {
    this.http.get<any>(`${this.apiBase}/posts/${id}/replies/`).subscribe({
      next: (res) => {
        this.replies.set(res.results || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleLike(post: Post): void {
    const method = post.is_liked ? 'DELETE' : 'POST';
    this.http.request(method, `${this.apiBase}/posts/${post.id}/like/`, { responseType: 'text' }).subscribe({
      next: () => {
        this.post.update(p => p && p.id === post.id
          ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
          : p
        );
        this.replies.update(list => list.map(p =>
          p.id === post.id
            ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
            : p
        ));
      },
    });
  }

  toggleRepost(post: Post): void {
    const url = `${this.apiBase}/posts/${post.id}/repost/`;
    if (post.is_reposted) {
      this.http.delete(url, { responseType: 'json' }).subscribe({
        next: () => {
          this.replies.update(list => list.map(p =>
            p.id === post.id ? { ...p, is_reposted: false, repost_count: p.repost_count - 1 } : p
          ));
          this.post.update(p => p && p.id === post.id
            ? { ...p, is_reposted: false, repost_count: Math.max(0, p.repost_count - 1) }
            : p
          );
        },
      });
    } else {
      this.http.post(url, {}, { responseType: 'json' }).subscribe({
        next: () => {
          this.replies.update(list => list.map(p =>
            p.id === post.id ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 } : p
          ));
          this.post.update(p => p && p.id === post.id
            ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 }
            : p
          );
        },
      });
    }
  }

  sendReply(): void {
    const text = this.replyText().trim();
    if (!text) return;
    this.replying.set(true);
    const body: any = { content: text };
    if (this.replyImageUrl().trim()) body.image_url = this.replyImageUrl().trim();
    this.http.post(`${this.apiBase}/posts/${this.post()!.id}/replies/`, body).subscribe({
      next: () => {
        this.replyText.set('');
        this.replyImageUrl.set('');
        this.replying.set(false);
        this.loadReplies(this.post()!.id);
      },
      error: () => this.replying.set(false),
    });
  }

  askDelete(post: Post): void { this.deleteTarget.set(post); }
  cancelDelete(): void { if (!this.deleting()) this.deleteTarget.set(null); }
  confirmDelete(): void {
    const post = this.deleteTarget();
    if (!post) return;
    this.deleting.set(true);
    this.http.delete(`${this.apiBase}/posts/${post.id}/`, { responseType: 'text' }).subscribe({
      next: () => {
        this.replies.update((list) => list.filter((p) => p.id !== post.id));
        if (post.id === this.post()?.id) this.post.set(null);
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
