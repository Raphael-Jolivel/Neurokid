import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SessionService } from '../../services/session/session-service';
import { NotificationService } from '../../services/notification/notification-service';

@Component({
  selector: 'app-report-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './report-page.html',
  styleUrl: './report-page.scss'
})
export class ReportPage implements OnInit {

  public sessionId: string = '';
  public loading: boolean = true;
  public error: string = '';
  public report: any = null;

  public domainList: { domain: string; average_score: number; level: string }[] = [];

  constructor(private route: ActivatedRoute,
              private router: Router,
              private sessionService: SessionService,
              private notification: NotificationService) {}

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.paramMap.get('id') || '';
    this.fetchReport();
  }

  fetchReport(): void {
    this.sessionService.getScore(this.sessionId).subscribe({
      next: (resp: any) => {
        this.report = resp;
        this.domainList = Object.keys(resp.domain_breakdown || {}).map(k => ({
          domain:        k,
          average_score: resp.domain_breakdown[k].average_score,
          level:         resp.domain_breakdown[k].level
        }));
        this.loading = false;
      },
      error: (err) => {
        const msg = err?.error?.error || 'Unable to load the report';
        this.error = msg;
        this.notification.error(msg);
        this.loading = false;
      }
    });
  }

  levelClass(level: string): string {
    if (!level) return 'level-Average';
    return 'level-badge level-' + level.replace(/\s+/g, '-');
  }

  difficultyClass(diff: string): string {
    return 'diff-' + diff;
  }

  difficultyLabel(diff: string): string {
    if (diff === 'easy')   return 'Easy';
    if (diff === 'medium') return 'Medium';
    if (diff === 'hard')   return 'Hard';
    return diff;
  }
}
