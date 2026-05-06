import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, AdminSession } from '../../../services/admin/admin-service';
import { NotificationService } from '../../../services/notification/notification-service';

@Component({
  selector: 'app-admin-sessions',
  imports: [CommonModule],
  templateUrl: './admin-sessions.html'
})
export class AdminSessionsPage implements OnInit {

  public loading = true;
  public sessions: AdminSession[] = [];

  constructor(private admin: AdminService,
              private notification: NotificationService) {}

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading = true;
    this.admin.listSessions().subscribe({
      next: (rows) => { this.sessions = rows || []; this.loading = false; },
      error: (err) => {
        this.notification.error(err?.error?.error || 'Loading error');
        this.loading = false;
      }
    });
  }

  remove(s: AdminSession): void {
    const ok = confirm(
      `Delete session ${s.id.substring(0, 8)} from ${s.child_username || 'deleted account'}?\n\n` +
      `All associated answers will be deleted.`
    );
    if (!ok) return;

    this.admin.deleteSession(s.id).subscribe({
      next: () => {
        this.notification.success('Session deleted');
        this.reload();
      },
      error: (err) => this.notification.error(err?.error?.error || 'Error')
    });
  }
}
