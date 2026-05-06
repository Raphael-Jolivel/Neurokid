import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class ModelService {

  constructor(private http: HttpClient) {}

  /** GET /model/info */
  info(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/model/info`);
  }

  /** POST /model/retrain */
  retrain(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/model/retrain`, {});
  }
}
