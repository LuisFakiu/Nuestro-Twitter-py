import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  bio: string;
  avatar_url: string;
  date_joined: string;
}

interface Tokens {
  access: string;
  refresh: string;
}

interface AuthResponse {
  user: CurrentUser;
  tokens: Tokens;
}

const ACCESS_KEY = 'auth.access';
const REFRESH_KEY = 'auth.refresh';
const USER_KEY = 'auth.user';

function loadStoredUser(): CurrentUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<CurrentUser | null>(loadStoredUser());
  readonly user = this._user.asReadonly();
  readonly username = computed(() => this._user()?.username ?? null);
  readonly isLoggedIn = computed(() => this._user() !== null);

  constructor(private http: HttpClient) {}

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register/`, { username, email, password })
      .pipe(tap((res) => this.persist(res)));
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login/`, { username, password })
      .pipe(tap((res) => this.persist(res)));
  }

  googleLogin(credential: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/google/`, { credential })
      .pipe(tap((res) => this.persist(res)));
  }

  fetchMe(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${environment.apiUrl}/me/`).pipe(
      tap((user) => {
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        this._user.set(user);
      }),
    );
  }

  logout(): void {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
    this._user.set(null);
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS_KEY);
  }

  private persist(res: AuthResponse): void {
    sessionStorage.setItem(ACCESS_KEY, res.tokens.access);
    sessionStorage.setItem(REFRESH_KEY, res.tokens.refresh);
    sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._user.set(res.user);
  }
}
