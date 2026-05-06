import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class ChildService {

  constructor(private http: HttpClient) {}

  /** GET /children */
  list(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/children`);
  }

  /** GET /children/<id>/history */
  history(childId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/children/${childId}/history`);
  }
}
