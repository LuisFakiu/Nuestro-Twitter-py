import { Component, ElementRef, HostListener, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { FormatContentPipe } from '../../../shared/format-content.pipe';
import { Post } from '../../../shared/post.types';
import { SearchService, SuggestedHashtag, SuggestedUser } from '../../../core/search.service';
import { environment } from '../../../../environments/environment';

type SuggestionType = 'user' | 'hashtag' | null;

interface ActiveSuggestion {
  type: SuggestionType;
  query: string;
  startIndex: number;
  endIndex: number;
}

@Component({
  selector: 'app-reply-thread',
  standalone: true,
  imports: [DatePipe, RouterLink, FormsModule, FormatContentPipe],
  templateUrl: './reply-thread.component.html',
  styleUrl: './reply-thread.component.scss',
})
export class ReplyThreadComponent {
  private http = inject(HttpClient);
  private searchService = inject(SearchService);
  private debounceTimer: any = null;

  reply = input.required<Post>();
  childrenMap = input<Map<number, Post[]>>(new Map());
  currentUserId = input<number | undefined>(undefined);
  isOwnPost = computed(() => this.currentUserId() !== undefined && this.currentUserId() === this.reply().author);

  toggleLike = output<Post>();
  toggleRepost = output<Post>();
  askDelete = output<Post>();
  replySubmitted = output<void>();

  textareaRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('replyTextarea');

  isExpanded = signal(true);
  showReplyForm = signal(false);
  replyText = signal('');
  replyImageUrl = signal('');
  replying = signal(false);

  suggestedUsers: SuggestedUser[] = [];
  suggestedHashtags: SuggestedHashtag[] = [];
  selectedIndex = 0;
  showSuggestions = false;
  activeSuggestion: ActiveSuggestion | null = null;

  get children(): Post[] {
    return this.childrenMap().get(this.reply().id) ?? [];
  }

  toggleExpand(): void {
    this.isExpanded.update(v => !v);
  }

  openReply(): void {
    this.showReplyForm.set(true);
    setTimeout(() => this.textareaRef()?.nativeElement?.focus(), 0);
  }

  cancelReply(): void {
    this.showReplyForm.set(false);
    this.replyText.set('');
    this.replyImageUrl.set('');
    this.closeSuggestions();
  }

  sendReply(): void {
    const text = this.replyText().trim();
    if (!text) return;
    this.replying.set(true);
    const body: any = { content: text };
    if (this.replyImageUrl().trim()) body.image_url = this.replyImageUrl().trim();
    this.http.post(`${environment.apiUrl}/posts/${this.reply().id}/replies/`, body).subscribe({
      next: () => {
        this.cancelReply();
        this.replying.set(false);
        this.isExpanded.set(true);
        this.replySubmitted.emit();
      },
      error: () => this.replying.set(false),
    });
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
}
