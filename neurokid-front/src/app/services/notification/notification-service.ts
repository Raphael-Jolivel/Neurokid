import { Injectable } from '@angular/core';

declare const UIkit: any;

@Injectable({ providedIn: 'root' })
export class NotificationService {

  success(message: string) {
    UIkit.notification({ message, status: 'success', pos: 'top-right', timeout: 3000 });
  }

  error(message: string) {
    UIkit.notification({ message, status: 'danger', pos: 'top-right', timeout: 4000 });
  }

  info(message: string) {
    UIkit.notification({ message, status: 'primary', pos: 'top-right', timeout: 3000 });
  }
}
