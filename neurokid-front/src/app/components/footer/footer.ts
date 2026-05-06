import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth/auth-service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class Footer {

  currentYear = new Date().getFullYear();
  appName     = 'NeuroKid';

  constructor(public authService: AuthService, private router: Router) {}

  onClickLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
