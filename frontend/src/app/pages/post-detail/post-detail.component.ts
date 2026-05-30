import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { FormatContentPipe } from '../../shared/format-content.pipe';
import { Post } from '../../shared/post.types';
import { SearchService, SuggestedHashtag, SuggestedUser } from '../../core/search.service';
import { environment } from '../../../environments/environment';
import { ReplyThreadComponent } from './reply-thread/reply-thread.component';

type SuggestionType = 'user' | 'hashtag' | null;

interface ActiveSuggestion {
  type: SuggestionType;
  query: string;
  startIndex: number;
  endIndex: number;
}

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, FormsModule, FormatContentPipe, ReplyThreadComponent],
  templateUrl: './post-detail.component.html',
  styleUrl: './post-detail.component.scss',
})
export class PostDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private location = inject(Location);
  private searchService = inject(SearchService);
  private debounceTimer: any = null;

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

  currentUserId = computed(() => this.auth.user()?.id);

  textareaRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('replyTextarea');

  suggestedUsers: SuggestedUser[] = [];
  suggestedHashtags: SuggestedHashtag[] = [];
  selectedIndex = 0;
  showSuggestions = false;
  activeSuggestion: ActiveSuggestion | null = null;

  childrenMap = computed(() => {
    const map = new Map<number, Post[]>();
    for (const r of this.replies()) {
      const pid = r.parent_id ?? 0;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(r);
    }
    return map;
  });

  rootReplies = computed(() => this.childrenMap().get(this.post()?.id ?? 0) ?? []);

  repostTarget = signal<Post | null>(null);
  repostModalMode = signal<'menu' | 'quote' | null>(null);
  quoteContent = signal('');
  quoteImageUrl = signal('');
  quoting = signal(false);

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
    if (post.is_reposted) {
      this.http.delete(`${this.apiBase}/posts/${post.id}/repost/`, { responseType: 'json' }).subscribe({
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
      this.repostTarget.set(post);
      this.repostModalMode.set('menu');
      this.quoteContent.set('');
      this.quoteImageUrl.set('');
    }
  }

  simpleRepost(post: Post): void {
    this.http.post(`${this.apiBase}/posts/${post.id}/repost/`, {}, { responseType: 'json' }).subscribe({
      next: () => {
        this.replies.update(list => list.map(p =>
          p.id === post.id ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 } : p
        ));
        this.post.update(p => p && p.id === post.id
          ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 }
          : p
        );
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
        this.replies.update(list => list.map(p =>
          p.id === post.id ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 } : p
        ));
        this.post.update(p => p && p.id === post.id
          ? { ...p, is_reposted: true, repost_count: p.repost_count + 1 }
          : p
        );
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
        this.post.update(p => p ? { ...p, reply_count: p.reply_count + 1 } : p);
        this.loadReplies(this.post()!.id);
      },
      error: () => this.replying.set(false),
    });
  }

  reloadReplies(): void {
    if (this.post()) {
      this.post.update(p => p ? { ...p, reply_count: p.reply_count + 1 } : p);
      this.loadReplies(this.post()!.id);
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.reply-suggestions') && !target.closest('.reply-textarea')) {
      this.closeSuggestions();
    }
  }

  onInput(): void {
    const textarea = this.textareaRef()?.nativeElement;
    if (!textarea) return;
    const content = this.replyText();
    const cursorPos = textarea.selectionStart;
    const detected = this.detectTrigger(content, cursorPos);

    if (detected.type && detected.query.length >= 1) {
      this.activeSuggestion = {
        type: detected.type,
        query: detected.query,
        startIndex: detected.startIndex,
        endIndex: detected.endIndex,
      };
      this.doSearch(detected.type, detected.query);
    } else {
      this.closeSuggestions();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.showSuggestions) return;
    const total = this.suggestedUsers.length + this.suggestedHashtags.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % total;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + total) % total;
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.selectCurrent();
    } else if (event.key === 'Escape') {
      this.closeSuggestions();
    }
  }

  private detectTrigger(content: string, cursorPos: number): { type: SuggestionType; query: string; startIndex: number; endIndex: number } {
    const beforeCursor = content.slice(0, cursorPos);
    let lastAtIndex = -1;
    let lastHashtagIndex = -1;

    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = beforeCursor[i];
      if (char === ' ' || char === '\n') break;
      if (char === '@') { lastAtIndex = i; break; }
      if (char === '#') { lastHashtagIndex = i; break; }
    }

    if (lastAtIndex !== -1) {
      const match = beforeCursor.slice(lastAtIndex, cursorPos);
      const query = match.slice(1);
      if (query.length >= 1 && /^\w+$/.test(query)) {
        return { type: 'user', query, startIndex: lastAtIndex, endIndex: cursorPos };
      }
    }

    if (lastHashtagIndex !== -1) {
      const match = beforeCursor.slice(lastHashtagIndex, cursorPos);
      const query = match.slice(1);
      if (query.length >= 1 && /^\w+$/.test(query)) {
        return { type: 'hashtag', query, startIndex: lastHashtagIndex, endIndex: cursorPos };
      }
    }

    return { type: null, query: '', startIndex: 0, endIndex: 0 };
  }

  private doSearch(type: SuggestionType, query: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (type === 'user') {
        this.searchService.searchUsers(query).subscribe({
          next: (results) => {
            this.suggestedUsers = results;
            this.suggestedHashtags = [];
            this.selectedIndex = 0;
            this.showSuggestions = results.length > 0;
          },
        });
      } else if (type === 'hashtag') {
        this.searchService.searchHashtags(query).subscribe({
          next: (results) => {
            this.suggestedHashtags = results;
            this.suggestedUsers = [];
            this.selectedIndex = 0;
            this.showSuggestions = results.length > 0;
          },
        });
      }
    }, 200);
  }

  selectSuggestion(type: 'user' | 'hashtag', item: SuggestedUser | SuggestedHashtag, index: number): void {
    this.selectedIndex = index;
    this.selectCurrent();
  }

  private selectCurrent(): void {
    if (!this.activeSuggestion) return;
    const idx = this.selectedIndex;
    let replacement: string | null = null;

    if (this.activeSuggestion.type === 'user' && this.suggestedUsers[idx]) {
      replacement = `@${this.suggestedUsers[idx].username} `;
    } else if (this.activeSuggestion.type === 'hashtag' && this.suggestedHashtags[idx]) {
      replacement = `#${this.suggestedHashtags[idx].name} `;
    }

    if (replacement) {
      const content = this.replyText();
      const newContent =
        content.slice(0, this.activeSuggestion.startIndex) +
        replacement +
        content.slice(this.activeSuggestion.endIndex);
      this.replyText.set(newContent);

      setTimeout(() => {
        const textarea = this.textareaRef()?.nativeElement;
        if (textarea) {
          const pos = this.activeSuggestion!.startIndex + replacement.length;
          textarea.focus();
          textarea.setSelectionRange(pos, pos);
        }
      }, 0);
    }
    this.closeSuggestions();
  }

  closeSuggestions(): void {
    this.showSuggestions = false;
    this.suggestedUsers = [];
    this.suggestedHashtags = [];
    this.activeSuggestion = null;
    this.selectedIndex = 0;
  }

  truncateBio(bio: string): string {
    if (!bio) return '';
    return bio.length <= 50 ? bio : bio.slice(0, 50) + '…';
  }

  askDelete(post: Post): void { this.deleteTarget.set(post); }
  cancelDelete(): void { if (!this.deleting()) this.deleteTarget.set(null); }
  confirmDelete(): void {
    const post = this.deleteTarget();
    if (!post) return;
    this.deleting.set(true);
    this.http.delete(`${this.apiBase}/posts/${post.id}/`, { responseType: 'text' }).subscribe({
      next: () => {
        const idsToRemove = this.collectDescendantIds(post.id);
        idsToRemove.add(post.id);
        const removedCount = idsToRemove.size;
        this.post.update(p => p ? { ...p, reply_count: Math.max(0, p.reply_count - removedCount) } : p);
        const parentId = post.parent_id;
        if (parentId) {
          this.replies.update(list => list.map(p =>
            p.id === parentId ? { ...p, reply_count: Math.max(0, p.reply_count - removedCount) } : p
          ));
        }
        this.replies.update((list) => list.filter((p) => !idsToRemove.has(p.id)));
        if (post.id === this.post()?.id) this.post.set(null);
        this.deleting.set(false);
        this.deleteTarget.set(null);
      },
      error: () => { this.deleting.set(false); this.deleteTarget.set(null); },
    });
  }

  private collectDescendantIds(postId: number): Set<number> {
    const ids = new Set<number>();
    const collect = (pid: number) => {
      const children = this.childrenMap().get(pid) ?? [];
      for (const child of children) {
        ids.add(child.id);
        collect(child.id);
      }
    };
    collect(postId);
    return ids;
  }

  isOwnPost(post: Post): boolean {
    return this.auth.user()?.id === post.author;
  }

  goBack(): void {
    this.location.back();
  }
}
