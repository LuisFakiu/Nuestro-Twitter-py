import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface BlockedUser {
  id: number;
  blocked: number;
  blocked_username: string;
  blocked_avatar: string;
  created_at: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  private readonly apiBase = environment.apiUrl;

  isPrivate = signal(false);
  togglingPrivacy = signal(false);

  passwordForm = this.fb.nonNullable.group({
    old_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
  });
  changingPassword = signal(false);
  passwordError = signal<string | null>(null);
  passwordSuccess = signal(false);

  deleting = signal(false);
  deleteConfirm = signal('');
  deleteError = signal<string | null>(null);

  blockedUsers = signal<BlockedUser[]>([]);
  loadingBlocked = signal(true);
  unblockingId = signal<number | null>(null);

  ngOnInit(): void {
    this.http.get<any>(`${this.apiBase}/me/`).subscribe({
      next: (user) => this.isPrivate.set(user.is_private),
    });
    this.loadBlockedUsers();
  }

  togglePrivacy(): void {
    this.togglingPrivacy.set(true);
    this.http.post(`${this.apiBase}/me/privacy/`, {}).subscribe({
      next: (res: any) => {
        this.isPrivate.set(res.is_private);
        this.togglingPrivacy.set(false);
      },
      error: () => this.togglingPrivacy.set(false),
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;
    this.changingPassword.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(false);
    this.http.post(`${this.apiBase}/me/change-password/`, this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.passwordSuccess.set(true);
        this.changingPassword.set(false);
        this.passwordForm.reset();
      },
      error: (err: HttpErrorResponse) => {
        const data = err.error;
        this.passwordError.set(
          data?.old_password?.[0] || data?.new_password?.[0] || 'Error al cambiar la contraseña'
        );
        this.changingPassword.set(false);
      },
    });
  }

  deleteAccount(): void {
    if (this.deleteConfirm() !== 'CONFIRMAR') return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.http.delete(`${this.apiBase}/me/delete-account/`).subscribe({
      next: () => {
        this.auth.logout();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.deleteError.set('Error al eliminar la cuenta');
        this.deleting.set(false);
      },
    });
  }

  unblockUser(userId: number): void {
    const user = this.blockedUsers().find((u) => u.blocked === userId);
    if (!user) return;
    this.unblockingId.set(userId);
    this.http.delete(`${this.apiBase}/users/${user.blocked_username}/unblock/`).subscribe({
      next: () => {
        this.blockedUsers.update((list) => list.filter((u) => u.blocked !== userId));
        this.unblockingId.set(null);
      },
      error: () => this.unblockingId.set(null),
    });
  }

  private loadBlockedUsers(): void {
    this.loadingBlocked.set(true);
    this.http.get<BlockedUser[]>(`${this.apiBase}/me/blocked/`).subscribe({
      next: (res) => {
        this.blockedUsers.set(Array.isArray(res) ? res : (res as any).results || []);
        this.loadingBlocked.set(false);
      },
      error: () => this.loadingBlocked.set(false),
    });
  }
}
