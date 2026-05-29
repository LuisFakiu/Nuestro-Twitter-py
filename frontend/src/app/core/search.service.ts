import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SuggestedUser {
  username: string;
  avatar_url: string | null;
  bio: string;
  is_following: boolean;
}

export interface SuggestedHashtag {
  id: number;
  name: string;
  post_count: number;
}

interface PaginatedResponse<T> {
  count?: number;
  results?: T[];
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private http: HttpClient) {}

  searchUsers(query: string): Observable<SuggestedUser[]> {
    return this.http.get<PaginatedResponse<SuggestedUser[]> | SuggestedUser[]>(`${environment.apiUrl}/users/?q=${encodeURIComponent(query)}`).pipe(
      map((response: any) => {
        console.log('[SearchService] searchUsers response:', response);
        if (Array.isArray(response)) {
          return response;
        }
        if (response && response.results && Array.isArray(response.results)) {
          return response.results;
        }
        return [];
      })
    );
  }

  searchHashtags(query: string): Observable<SuggestedHashtag[]> {
    return this.http.get<any>(`${environment.apiUrl}/hashtags/search/?q=${encodeURIComponent(query)}`).pipe(
      map((response: any) => {
        console.log('[SearchService] searchHashtags response:', response);
        if (Array.isArray(response)) {
          return response;
        }
        if (response && response.results && Array.isArray(response.results)) {
          return response.results;
        }
        return [];
      })
    );
  }
}
