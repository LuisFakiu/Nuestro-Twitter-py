import { Injectable, signal, inject } from '@angular/core';
import { AuthService } from './auth.service';

export type ThemeName = 'dark' | 'light' | 'amber' | 'ocean';

export interface ThemeOption {
  id: ThemeName;
  label: string;
  preview: {
    bg: string;
    neon: string;
    text: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private auth = inject(AuthService);
  currentTheme = signal<ThemeName>('dark');

  readonly themes: ThemeOption[] = [
    {
      id: 'dark',
      label: 'Oscuro',
      preview: { bg: '#000', neon: '#39ff14', text: '#d6ffd6' },
    },
    {
      id: 'light',
      label: 'Claro',
      preview: { bg: '#f8f8f4', neon: '#1a8a0a', text: '#1a1a1a' },
    },
    {
      id: 'amber',
      label: 'Ámbar',
      preview: { bg: '#1a0f00', neon: '#ff8c00', text: '#ffd700' },
    },
    {
      id: 'ocean',
      label: 'Océano',
      preview: { bg: '#0a1628', neon: '#4fc3f7', text: '#e0f0ff' },
    },
  ];

  constructor() {
    this.loadForUser(this.auth.username());
  }

  setTheme(name: ThemeName): void {
    this.currentTheme.set(name);
    const username = this.auth.username();
    if (username) {
      localStorage.setItem(`nandetuiter-theme-${username}`, name);
    }
    this.applyTheme(name);
  }

  setUser(username: string | null): void {
    this.loadForUser(username);
  }

  resetTheme(): void {
    this.currentTheme.set('dark');
    this.applyTheme('dark');
  }

  private loadForUser(username: string | null): void {
    const saved = username
      ? (localStorage.getItem(`nandetuiter-theme-${username}`) as ThemeName | null)
      : null;

    const theme = (saved && this.themes.some((t) => t.id === saved)) ? saved : 'dark';
    this.currentTheme.set(theme);
    this.applyTheme(theme);
  }

  private applyTheme(name: ThemeName): void {
    document.documentElement.className = `theme-${name}`;
  }
}
