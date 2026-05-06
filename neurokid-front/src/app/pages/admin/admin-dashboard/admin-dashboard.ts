import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../services/admin/admin-service';
import { NotificationService } from '../../../services/notification/notification-service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html'
})
export class AdminDashboardPage implements OnInit {

  public loading = true;
  public stats: any = null;

  constructor(private admin: AdminService,
              private notification: NotificationService) {}

  ngOnInit(): void {
    this.admin.getOverview().subscribe({
      next: (data) => { this.stats = data; this.loading = false; },
      error: (err) => {
        this.notification.error(err?.error?.error || 'Loading error');
        this.loading = false;
      }
    });
  }
}
