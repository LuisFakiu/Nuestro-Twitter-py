import { Component, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { SearchService, SuggestedHashtag, SuggestedUser } from '../../core/search.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';

type SuggestionType = 'user' | 'hashtag' | null;

interface ActiveSuggestion {
  type: SuggestionType;
  query: string;
  startIndex: number;
  endIndex: number;
}

@Component({
  selector: 'app-composer',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './composer.component.html',
  styleUrl: './composer.component.scss',
})
export class ComposerComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private searchService = inject(SearchService);

  private readonly apiBase = environment.apiUrl;
  private debounceTimer: any = null;

  @ViewChild('textareaRef') textareaRef!: ElementRef<HTMLTextAreaElement>;

  saving = signal(false);
  error = signal<string | null>(null);

  suggestedUsers: SuggestedUser[] = [];
  suggestedHashtags: SuggestedHashtag[] = [];
  selectedIndex = 0;
  showSuggestions = false;
  activeSuggestion: ActiveSuggestion | null = null;

  form = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(280)]],
    image_url: [''],
  });
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  previewUrl = signal<string | null>(null);

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.composer__suggestions') && !target.closest('textarea')) {
      this.closeSuggestions();
    }
  }

  onInput(): void {
    const textarea = this.textareaRef?.nativeElement;
    if (!textarea) {
      console.log('[AUTOCOMPLETE] No hay textarea ref');
      return;
    }

    const content = this.form.controls.content.value;
    const cursorPos = textarea.selectionStart;

    console.log('[AUTOCOMPLETE] Input:', JSON.stringify(content), 'cursor:', cursorPos);

    const detected = this.detectTrigger(content, cursorPos);

    console.log('[AUTOCOMPLETE] Detectado:', detected);

    if (detected.type && detected.query.length >= 2) {
      console.log('[AUTOCOMPLETE] CONDICION CUMPLIDA: type=', detected.type, 'query=', detected.query);
      
      this.activeSuggestion = {
        type: detected.type,
        query: detected.query,
        startIndex: detected.startIndex,
        endIndex: detected.endIndex,
      };

      this.doSearch(detected.type, detected.query);
    } else {
      console.log('[AUTOCOMPLETE] Condicion NO cumplida, cerrando sugerencias');
      this.closeSuggestions();
    }
  }

  private doSearch(type: SuggestionType, query: string): void {
    console.log('[AUTOCOMPLETE] doSearch: type=', type, 'query=', query);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      console.log('[AUTOCOMPLETE] EJECUTANDO BUSQUEDA despues de debounce');

      if (type === 'user') {
        this.searchService.searchUsers(query).subscribe({
          next: (results) => {
            console.log('[AUTOCOMPLETE] USUARIOS RECIBIDOS:', results.length, results);
            this.suggestedUsers = results;
            this.suggestedHashtags = [];
            this.selectedIndex = 0;
            this.showSuggestions = this.suggestedUsers.length > 0;
            console.log('[AUTOCOMPLETE] showSuggestions =', this.showSuggestions);
          },
          error: (err) => {
            console.error('[AUTOCOMPLETE] ERROR en busqueda de usuarios:', err);
          }
        });
      } else if (type === 'hashtag') {
        this.searchService.searchHashtags(query).subscribe({
          next: (results) => {
            console.log('[AUTOCOMPLETE] HASHTAGS RECIBIDOS:', results.length, results);
            this.suggestedHashtags = results;
            this.suggestedUsers = [];
            this.selectedIndex = 0;
            this.showSuggestions = this.suggestedHashtags.length > 0;
            console.log('[AUTOCOMPLETE] showSuggestions =', this.showSuggestions);
          },
          error: (err) => {
            console.error('[AUTOCOMPLETE] ERROR en busqueda de hashtags:', err);
          }
        });
      }
    }, 200);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.showSuggestions) return;

    const totalItems = this.suggestedUsers.length + this.suggestedHashtags.length;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % totalItems;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + totalItems) % totalItems;
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.selectCurrentSuggestion();
    } else if (event.key === 'Escape') {
      this.closeSuggestions();
    }
  }

  private detectTrigger(content: string, cursorPos: number): {
    type: SuggestionType;
    query: string;
    startIndex: number;
    endIndex: number;
  } {
    const beforeCursor = content.slice(0, cursorPos);
    console.log('[AUTOCOMPLETE] beforeCursor:', JSON.stringify(beforeCursor));

    let lastAtIndex = -1;
    let lastHashtagIndex = -1;

    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = beforeCursor[i];
      console.log('[AUTOCOMPLETE] revisando char en', i, ':', JSON.stringify(char));
      
      if (char === ' ' || char === '\n') {
        console.log('[AUTOCOMPLETE] Encontre espacio/newline, rompiendo');
        break;
      }
      if (char === '@') {
        console.log('[AUTOCOMPLETE] Encontre @ en posicion', i);
        lastAtIndex = i;
        break;
      }
      if (char === '#') {
        console.log('[AUTOCOMPLETE] Encontre # en posicion', i);
        lastHashtagIndex = i;
        break;
      }
    }

    console.log('[AUTOCOMPLETE] lastAtIndex=', lastAtIndex, 'lastHashtagIndex=', lastHashtagIndex);

    if (lastAtIndex !== -1) {
      const match = beforeCursor.slice(lastAtIndex, cursorPos);
      const query = match.slice(1);
      console.log('[AUTOCOMPLETE] match=', JSON.stringify(match), 'query=', JSON.stringify(query));
      
      if (query.length >= 1 && this.isWordChars(query)) {
        console.log('[AUTOCOMPLETE] Retornando USER suggestion');
        return {
          type: 'user',
          query,
          startIndex: lastAtIndex,
          endIndex: cursorPos,
        };
      }
    }

    if (lastHashtagIndex !== -1) {
      const match = beforeCursor.slice(lastHashtagIndex, cursorPos);
      const query = match.slice(1);
      console.log('[AUTOCOMPLETE] hashtag match=', JSON.stringify(match), 'query=', JSON.stringify(query));
      
      if (query.length >= 1 && this.isWordChars(query)) {
        console.log('[AUTOCOMPLETE] Retornando HASHTAG suggestion');
        return {
          type: 'hashtag',
          query,
          startIndex: lastHashtagIndex,
          endIndex: cursorPos,
        };
      }
    }

    console.log('[AUTOCOMPLETE] Retornando NULL');
    return { type: null, query: '', startIndex: 0, endIndex: 0 };
  }

  private isWordChars(str: string): boolean {
    const result = /^[\w]+$/.test(str);
    console.log('[AUTOCOMPLETE] isWordChars(', JSON.stringify(str), ') =', result);
    return result;
  }

  selectSuggestion(type: 'user' | 'hashtag', item: SuggestedUser | SuggestedHashtag, index: number): void {
    this.selectedIndex = index;
    this.selectCurrentSuggestion();
  }

  private selectCurrentSuggestion(): void {
    if (!this.activeSuggestion) return;

    const idx = this.selectedIndex;

    let replacement: string | null = null;

    if (this.activeSuggestion.type === 'user' && this.suggestedUsers[idx]) {
      replacement = `@${this.suggestedUsers[idx].username} `;
    } else if (this.activeSuggestion.type === 'hashtag' && this.suggestedHashtags[idx]) {
      replacement = `#${this.suggestedHashtags[idx].name} `;
    }

    if (replacement) {
      const content = this.form.controls.content.value;
      const newContent =
        content.slice(0, this.activeSuggestion.startIndex) +
        replacement +
        content.slice(this.activeSuggestion.endIndex);

      this.form.controls.content.setValue(newContent);

      setTimeout(() => {
        const textarea = this.textareaRef?.nativeElement;
        if (textarea) {
          const newCursorPos = this.activeSuggestion!.startIndex + replacement.length;
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }

    this.closeSuggestions();
  }

  private closeSuggestions(): void {
    console.log('[AUTOCOMPLETE] closeSuggestions()');
    this.showSuggestions = false;
    this.suggestedUsers = [];
    this.suggestedHashtags = [];
    this.activeSuggestion = null;
    this.selectedIndex = 0;
  }

  truncateBio(bio: string): string {
    if (!bio) return '';
    if (bio.length <= 50) return bio;
    return bio.slice(0, 50) + '…';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFile.set(file);

    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.form.controls.image_url.setValue('');
  }

  private uploadFile(): Promise<string | null> {
    const file = this.selectedFile();
    if (!file) return Promise.resolve(null);

    this.uploading.set(true);
    const fd = new FormData();
    fd.append('file', file);

    return new Promise((resolve) => {
      this.http.post<{ url: string }>(`${this.apiBase}/upload/`, fd).subscribe({
        next: (res) => {
          this.uploading.set(false);
          resolve(res.url);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.error || 'Error al subir imagen');
          this.uploading.set(false);
          resolve(null);
        },
      });
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);

    const body: Record<string, any> = { content: this.form.controls.content.value };

    if (this.selectedFile()) {
      const url = await this.uploadFile();
      if (url) body['image_url'] = url;
      else { this.saving.set(false); return; }
    } else {
      const img = this.form.controls.image_url.value?.trim();
      if (img) body['image_url'] = img;
    }

    this.http.post(`${this.apiBase}/posts/`, body).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.content?.[0] || 'Error al crear post');
        this.saving.set(false);
      },
    });
  }
}
