import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth/auth-service';
import { SessionService } from '../../services/session/session-service';
import { NotificationService } from '../../services/notification/notification-service';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage {

  public childName: string = '';
  public childAge:  number | null = null;

  constructor(public  authService: AuthService,
              private sessionService: SessionService,
              private router: Router,
              private notification: NotificationService) {
    this.childName = authService.getChildName();
    this.childAge  = authService.getChildAge();
  }

  startQuiz() {
    const childId = this.authService.getChildId();
    if (childId === null) {
      this.notification.error('No child logged in');
      return;
    }
    this.sessionService.start(childId).subscribe({
      next: (resp: any) => {
        const sid = resp?.session_id;
        if (sid) {
          this.router.navigate(['/quiz', sid]);
        } else {
          this.notification.error('Unable to start the session');
        }
      },
      error: (err) => {
        const msg = err?.error?.error || 'Failed to start the session';
        this.notification.error(msg);
      }
    });
  }
}
