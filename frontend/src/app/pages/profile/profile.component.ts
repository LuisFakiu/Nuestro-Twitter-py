import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { JsonPipe } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, JsonPipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly apiBase = environment.apiUrl;

  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  success = signal(false);
  avatarFile = signal<File | null>(null);
  avatarPreview = signal<string | null>(null);
  avatarUploading = signal(false);

  form = this.fb.nonNullable.group({
    bio: [''],
    location: [''],
    avatar_url: [''],
  });

  ngOnInit(): void {
    this.http.get<any>(`${this.apiBase}/me/`).subscribe({
      next: (user) => {
        this.form.patchValue({
          bio: user.bio || '',
          location: user.location || '',
          avatar_url: user.avatar_url || '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el perfil');
        this.loading.set(false);
      },
    });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.avatarFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.avatarFile.set(null);
    this.avatarPreview.set(null);
  }

  private uploadAvatar(): Promise<string | null> {
    const file = this.avatarFile();
    if (!file) return Promise.resolve(null);
    this.avatarUploading.set(true);
    const fd = new FormData();
    fd.append('file', file);
    return new Promise((resolve) => {
      this.http.post<{ url: string }>(`${this.apiBase}/upload/`, fd).subscribe({
        next: (res) => { this.avatarUploading.set(false); resolve(res.url); },
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.error || 'Error al subir avatar');
          this.avatarUploading.set(false); resolve(null);
        },
      });
    });
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const values = this.form.getRawValue();
    if (this.avatarFile()) {
      const url = await this.uploadAvatar();
      if (url) values.avatar_url = url;
      else { this.saving.set(false); return; }
    }

    this.http.patch(`${this.apiBase}/me/`, values).subscribe({
      next: () => {
        this.success.set(true);
        this.saving.set(false);
        this.avatarFile.set(null);
        this.avatarPreview.set(null);
        this.auth.fetchMe().subscribe();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.bio?.[0] || 'Error al guardar');
        this.saving.set(false);
      },
    });
  }
}
