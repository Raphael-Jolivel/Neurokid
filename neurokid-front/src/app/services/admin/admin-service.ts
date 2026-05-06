import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth-service';

export interface AdminQuestion {
  id?: number;
  domain: 'Memory' | 'Logic & Reasoning' | 'Attention & Focus';
  difficulty: 'easy' | 'medium' | 'hard';
  question_text: string;
  answer_key: string[];
  eval_type: 'contains' | 'sequence';
  source?: 'seed' | 'admin' | 'ai';
  created_at?: string;
}

export interface AdminUser {
  id: number;
  name: string;
  age: number | null;
  username: string;
  role: 'child' | 'admin';
  created_at: string;
  sessions_count: number;
}

export interface AdminSession {
  id: string;
  child_id: number;
  child_username: string;
  child_name: string;
  status: 'in_progress' | 'complete';
  overall_score: number | null;
  overall_level: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface GeneratedQuestion {
  domain: string;
  question_text: string;
  answer_key: string[];
  eval_type: 'contains' | 'sequence';
  suggested_difficulty: 'easy' | 'medium' | 'hard';
  source: 'ai';
}

const OPENAI_KEY_STORAGE = 'openai_api_key';

@Injectable({ providedIn: 'root' })
export class AdminService {

  constructor(private http: HttpClient, private auth: AuthService) {}

  /** Construit les headers (X-User-Id obligatoire, X-OpenAI-Key = cle Gemini optionnelle). */
  private headers(includeOpenAIKey = false): HttpHeaders {
    let h = new HttpHeaders().set('X-User-Id', String(this.auth.getChildId() ?? ''));
    if (includeOpenAIKey) {
      const k = this.getOpenAIKey();
      if (k) h = h.set('X-OpenAI-Key', k);
    }
    return h;
  }

  // -------- Cle API LLM (Gemini par defaut) : stockage dans le navigateur uniquement --------
  setOpenAIKey(k: string): void {
    if (k) localStorage.setItem(OPENAI_KEY_STORAGE, k);
    else   localStorage.removeItem(OPENAI_KEY_STORAGE);
  }
  getOpenAIKey(): string {
    return localStorage.getItem(OPENAI_KEY_STORAGE) || '';
  }
  hasOpenAIKey(): boolean {
    return !!localStorage.getItem(OPENAI_KEY_STORAGE);
  }
  clearOpenAIKey(): void {
    localStorage.removeItem(OPENAI_KEY_STORAGE);
  }

  // -------- Vue d'ensemble --------
  getOverview(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/admin/overview`, { headers: this.headers() });
  }

  // -------- Utilisateurs --------
  listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${environment.apiUrl}/admin/users`, { headers: this.headers() });
  }

  anonymizeUser(userId: number): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/admin/users/${userId}/anonymize`,
      {},
      { headers: this.headers() }
    );
  }

  // -------- Sessions --------
  listSessions(): Observable<AdminSession[]> {
    return this.http.get<AdminSession[]>(`${environment.apiUrl}/admin/sessions`, { headers: this.headers() });
  }

  deleteSession(sid: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/admin/sessions/${sid}`, { headers: this.headers() });
  }

  // -------- Questions (CRUD) --------
  listQuestions(filters: { domain?: string; difficulty?: string } = {}): Observable<AdminQuestion[]> {
    const qs = new URLSearchParams();
    if (filters.domain)     qs.set('domain', filters.domain);
    if (filters.difficulty) qs.set('difficulty', filters.difficulty);
    const url = `${environment.apiUrl}/admin/questions${qs.toString() ? '?' + qs.toString() : ''}`;
    return this.http.get<AdminQuestion[]>(url, { headers: this.headers() });
  }

  createQuestion(q: AdminQuestion): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/questions`, q, { headers: this.headers() });
  }

  updateQuestion(id: number, q: AdminQuestion): Observable<any> {
    return this.http.put(`${environment.apiUrl}/admin/questions/${id}`, q, { headers: this.headers() });
  }

  deleteQuestion(id: number): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/admin/questions/${id}`, { headers: this.headers() });
  }

  // -------- Génération IA --------
  generateQuestion(domain: string): Observable<GeneratedQuestion> {
    return this.http.post<GeneratedQuestion>(
      `${environment.apiUrl}/admin/questions/generate`,
      { domain },
      { headers: this.headers(true) }
    );
  }
}
