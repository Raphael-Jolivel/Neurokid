import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChildService } from '../../services/child/child-service';
import { NotificationService } from '../../services/notification/notification-service';

@Component({
  selector: 'app-history-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss'
})
export class HistoryPage implements OnInit {

  public loading: boolean = true;
  public children: any[] = [];
  public error: string = '';

  constructor(private childService: ChildService,
              private notification: NotificationService) {}

  ngOnInit(): void {
    this.childService.list().subscribe({
      next: (rows: any) => {
        this.children = Array.isArray(rows) ? rows : [];
        this.loading = false;
      },
      error: (err) => {
        const msg = err?.error?.error || 'Unable to load the list';
        this.error = msg;
        this.notification.error(msg);
        this.loading = false;
      }
    });
  }
}
