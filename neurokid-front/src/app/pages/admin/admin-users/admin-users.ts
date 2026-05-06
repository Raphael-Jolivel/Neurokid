import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, AdminUser } from '../../../services/admin/admin-service';
import { NotificationService } from '../../../services/notification/notification-service';

@Component({
  selector: 'app-admin-users',
  imports: [CommonModule],
  templateUrl: './admin-users.html'
})
export class AdminUsersPage implements OnInit {

  public loading = true;
  public users: AdminUser[] = [];

  constructor(private admin: AdminService,
              private notification: NotificationService) {}

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading = true;
    this.admin.listUsers().subscribe({
      next: (rows) => { this.users = rows || []; this.loading = false; },
      error: (err) => {
        this.notification.error(err?.error?.error || 'Loading error');
        this.loading = false;
      }
    });
  }

  anonymize(u: AdminUser): void {
    if (u.role === 'admin') return;
    const ok = confirm(
      `Anonymize the account "${u.username}"?\n\n` +
      `Name and username will be erased, but sessions and answers\n` +
      `will be kept (useful for training the AI model).`
    );
    if (!ok) return;

    this.admin.anonymizeUser(u.id).subscribe({
      next: () => {
        this.notification.success('Account anonymized');
        this.reload();
      },
      error: (err) => this.notification.error(err?.error?.error || 'Error')
    });
  }
}
