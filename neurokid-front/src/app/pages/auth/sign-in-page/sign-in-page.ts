import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth/auth-service';
import { NotificationService } from '../../../services/notification/notification-service';

@Component({
  selector: 'app-sign-in-page',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './sign-in-page.html',
  styleUrl: './sign-in-page.scss'
})
export class SignInPage {

  public credentials = { username: '', password: '' };
  public error = '';

  constructor(private authService: AuthService,
              private router: Router,
              private notification: NotificationService) {}

  sendFormData() {
    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.notification.success('Logged in successfully');
        // Admins land on their dedicated dashboard.
        const dest = this.authService.isAdmin() ? '/admin' : '/';
        this.router.navigate([dest]);
      },
      error: (err) => {
        const msg = err?.error?.error || 'Invalid credentials';
        this.error = msg;
        this.notification.error(msg);
      }
    });
  }
}
