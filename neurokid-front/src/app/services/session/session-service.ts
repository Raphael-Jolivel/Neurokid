import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class SessionService {

  constructor(private http: HttpClient) {}

  /** POST /session/start */
  start(child_id: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/session/start`, { child_id });
  }

  /** GET /session/<id>/question */
  nextQuestion(sessionId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/session/${sessionId}/question`);
  }

  /** POST /session/<id>/answer */
  submitAnswer(sessionId: string, payload: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/session/${sessionId}/answer`, payload);
  }

  /** GET /session/<id>/score */
  getScore(sessionId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/session/${sessionId}/score`);
  }

  /** GET /session/<id>/status */
  getStatus(sessionId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/session/${sessionId}/status`);
  }
}
