import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChildService } from '../../services/child/child-service';
import { NotificationService } from '../../services/notification/notification-service';

@Component({
  selector: 'app-child-detail-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './child-detail-page.html',
  styleUrl: './child-detail-page.scss'
})
export class ChildDetailPage implements OnInit {

  public childId: number = 0;
  public loading: boolean = true;
  public error: string = '';
  public child: any = null;
  public sessions: any[] = [];

  constructor(private route: ActivatedRoute,
              private childService: ChildService,
              private notification: NotificationService) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.childId = idParam ? parseInt(idParam, 10) : 0;

    this.childService.history(this.childId).subscribe({
      next: (resp: any) => {
        this.child    = resp.child;
        this.sessions = Array.isArray(resp.sessions) ? resp.sessions : [];
        this.loading  = false;
      },
      error: (err) => {
        const msg = err?.error?.error || 'Unable to load the sessions';
        this.error = msg;
        this.notification.error(msg);
        this.loading = false;
      }
    });
  }

  levelClass(level: string): string {
    if (!level) return '';
    return 'level-badge level-' + level.replace(/\s+/g, '-');
  }
}
