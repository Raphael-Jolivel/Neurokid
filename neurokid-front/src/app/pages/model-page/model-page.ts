import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelService } from '../../services/model/model-service';
import { NotificationService } from '../../services/notification/notification-service';

@Component({
  selector: 'app-model-page',
  imports: [CommonModule],
  templateUrl: './model-page.html',
  styleUrl: './model-page.scss'
})
export class ModelPage implements OnInit {

  public loading: boolean = true;
  public retraining: boolean = false;
  public error: string = '';
  public info: any = null;

  // Listes pour template
  public featureKeys: string[] = [];
  public metricKeys: string[] = [];

  constructor(private modelService: ModelService,
              private notification: NotificationService) {}

  ngOnInit(): void {
    this.loadInfo();
  }

  loadInfo(): void {
    this.loading = true;
    this.modelService.info().subscribe({
      next: (resp: any) => {
        this.info = resp;
        this.featureKeys = resp?.model_features ? Object.keys(resp.model_features) : [];
        this.metricKeys  = resp?.model_metrics  ? Object.keys(resp.model_metrics)  : [];
        this.loading = false;
      },
      error: (err) => {
        const msg = err?.error?.error || 'Unable to load the model info';
        this.error = msg;
        this.notification.error(msg);
        this.loading = false;
      }
    });
  }

  retrain(): void {
    if (this.retraining) return;
    this.retraining = true;
    this.modelService.retrain().subscribe({
      next: (resp: any) => {
        this.notification.success('Model retrained');
        this.retraining = false;
        this.loadInfo();
      },
      error: (err) => {
        const msg = err?.error?.error || 'Retraining failed';
        this.notification.error(msg);
        this.retraining = false;
      }
    });
  }

  formatValue(v: any): string {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'number') return v.toFixed(4);
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }
}
