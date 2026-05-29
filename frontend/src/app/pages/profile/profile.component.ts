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

  save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);
    this.http.patch(`${this.apiBase}/me/`, this.form.getRawValue()).subscribe({
      next: () => {
        this.success.set(true);
        this.saving.set(false);
        this.auth.fetchMe().subscribe();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.bio?.[0] || 'Error al guardar');
        this.saving.set(false);
      },
    });
  }
}
