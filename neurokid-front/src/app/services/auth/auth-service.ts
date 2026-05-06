import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private http: HttpClient) {}

  /** POST /register */
  signUp(payload: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/register`, payload);
  }

  /** POST /login */
  login(payload: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/login`, payload).pipe(
      tap((data: any) => {
        if (data && data.child_id) {
          localStorage.setItem('child_id', String(data.child_id));
          localStorage.setItem('child_name', data.name || '');
          localStorage.setItem('child_age',  data.age != null ? String(data.age) : '');
          localStorage.setItem('username',   data.username || '');
          localStorage.setItem('role',       data.role || 'child');
        }
      })
    );
  }

  /** POST /forgotten-password */
  forgottenPassword(username: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/forgotten-password`, { username });
  }

  /** POST /forgotten-password/reset */
  resetPassword(reset_token: string, new_password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/forgotten-password/reset`, { reset_token, new_password });
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('child_id');
  }

  getRole(): 'child' | 'admin' | null {
    const v = localStorage.getItem('role');
    return v === 'admin' || v === 'child' ? v : null;
  }

  isAdmin(): boolean {
    return this.getRole() === 'admin';
  }

  getChildId(): number | null {
    const v = localStorage.getItem('child_id');
    return v ? parseInt(v, 10) : null;
  }

  getChildName(): string {
    return localStorage.getItem('child_name') || '';
  }

  getChildAge(): number | null {
    const v = localStorage.getItem('child_age');
    return v ? parseInt(v, 10) : null;
  }

  logout(): void {
    localStorage.removeItem('child_id');
    localStorage.removeItem('child_name');
    localStorage.removeItem('child_age');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
  }
}
