import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

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
