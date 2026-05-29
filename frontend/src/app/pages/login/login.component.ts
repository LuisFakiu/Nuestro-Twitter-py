import { AfterViewInit, Component, NgZone, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';

type Mode = 'login' | 'register';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements AfterViewInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);

  mode = signal<Mode>('login');
  loading = signal(false);
  error = signal<string | null>(null);
  info = signal<string | null>(null);

  loginForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  registerForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngAfterViewInit(): void {
    this.loadGoogleScript().then(() => this.renderGoogleButton());
  }

  private loadGoogleScript(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof google !== 'undefined' && google.accounts) {
        resolve();
        return;
      }
      const existing = document.getElementById('gsi-script');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.id = 'gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private renderGoogleButton(): void {
    if (typeof google === 'undefined' || !google.accounts) return;
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (resp: { credential: string }) => this.handleGoogleCredential(resp.credential),
    });
    const container = document.getElementById('googleBtn');
    if (container) {
      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 280,
      });
    }
  }

  private handleGoogleCredential(credential: string): void {
    this.zone.run(() => {
      this.loading.set(true);
      this.error.set(null);
      this.auth.googleLogin(credential).subscribe({
        next: () => this.router.navigate(['/']),
        error: (err) => {
          this.error.set(err?.error?.detail ?? 'Error al iniciar con Google');
          this.loading.set(false);
        },
      });
    });
  }

  setMode(m: Mode): void {
    this.mode.set(m);
    this.error.set(null);
    this.info.set(null);
  }

  submit(): void {
    if (this.mode() === 'login') this.doLogin();
    else this.doRegister();
  }

  private doLogin(): void {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { username, password } = this.loginForm.getRawValue();
    this.auth.login(username, password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'Credenciales inválidas');
        this.loading.set(false);
      },
    });
  }

  private doRegister(): void {
    if (this.registerForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.info.set(null);
    const { username, email, password } = this.registerForm.getRawValue();
    this.auth.register(username, email, password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(this.parseError(err));
        this.loading.set(false);
      },
    });
  }

  private parseError(err: any): string {
    const body = err?.error;
    if (!body) return 'Error de red';
    if (typeof body === 'string') return body;
    if (body.detail) return body.detail;
    const first = Object.entries(body)[0];
    if (first) {
      const [field, msgs] = first;
      const msg = Array.isArray(msgs) ? msgs[0] : String(msgs);
      return `${field}: ${msg}`;
    }
    return 'Error desconocido';
  }
}
