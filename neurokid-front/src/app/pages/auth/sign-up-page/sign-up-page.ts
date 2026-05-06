import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth/auth-service';
import { NotificationService } from '../../../services/notification/notification-service';
import { User } from '../../../classes/user';

@Component({
  selector: 'app-sign-up-page',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './sign-up-page.html',
  styleUrl: './sign-up-page.scss'
})
export class SignUpPage {

  public user: User = new User();
  public error = '';

  constructor(private authService: AuthService,
              private router: Router,
              private notification: NotificationService) {}

  passwordsMatch(): boolean {
    return this.user.password === this.user.passwordConfirm;
  }

  sendFormData() {
    if (!this.passwordsMatch()) {
      this.error = 'The passwords do not match.';
      return;
    }

    const payload = {
      name:     this.user.name,
      age:      this.user.age,
      username: this.user.username,
      password: this.user.password
    };

    this.authService.signUp(payload).subscribe({
      next: () => {
        this.notification.success('Account created successfully');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        const msg = err?.error?.error || 'Failed to create the account';
        this.error = msg;
        this.notification.error(msg);
      }
    });
  }
}
