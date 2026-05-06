import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth/auth-service';
import { NotificationService } from '../../../services/notification/notification-service';

@Component({
  selector: 'app-reset-password-page',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss'
})
export class ResetPasswordPage {

  public step: 1 | 2 = 1;

  public username   = '';
  public token      = '';
  public newPassword       = '';
  public confirmPassword   = '';
  public error      = '';

  constructor(private authService: AuthService,
              private router: Router,
              private notification: NotificationService) {}

  requestToken() {
    this.error = '';
    this.authService.forgottenPassword(this.username).subscribe({
      next: (resp: any) => {
        const tokenInfo = resp?.reset_token ? ' (token: ' + resp.reset_token + ')' : '';
        this.notification.success('Token generated' + tokenInfo);
        if (resp?.reset_token) {
          this.token = resp.reset_token;
        }
        this.step = 2;
      },
      error: (err) => {
        const msg = err?.error?.error || 'User not found';
        this.error = msg;
        this.notification.error(msg);
      }
    });
  }

  applyReset() {
    this.error = '';
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'The passwords do not match.';
      return;
    }
    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.notification.success('Password reset successfully');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        const msg = err?.error?.error || 'Invalid or expired token';
        this.error = msg;
        this.notification.error(msg);
      }
    });
  }
}
