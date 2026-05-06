import { Routes } from '@angular/router';
import { SignInPage }        from './pages/auth/sign-in-page/sign-in-page';
import { SignUpPage }        from './pages/auth/sign-up-page/sign-up-page';
import { ResetPasswordPage } from './pages/auth/reset-password-page/reset-password-page';
import { HomePage }          from './pages/home-page/home-page';
import { QuizPage }          from './pages/quiz-page/quiz-page';
import { ReportPage }        from './pages/report-page/report-page';
import { HistoryPage }       from './pages/history-page/history-page';
import { ChildDetailPage }   from './pages/child-detail-page/child-detail-page';
import { ModelPage }         from './pages/model-page/model-page';

import { AdminDashboardPage } from './pages/admin/admin-dashboard/admin-dashboard';
import { AdminUsersPage }     from './pages/admin/admin-users/admin-users';
import { AdminSessionsPage }  from './pages/admin/admin-sessions/admin-sessions';
import { AdminQuestionsPage } from './pages/admin/admin-questions/admin-questions';
import { AdminGeneratePage }  from './pages/admin/admin-generate/admin-generate';

import { authGuard }  from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
  { path: 'login',          component: SignInPage },
  { path: 'register',       component: SignUpPage },
  { path: 'reset-password', component: ResetPasswordPage },

  { path: '',               component: HomePage,        canActivate: [authGuard] },
  { path: 'quiz/:id',       component: QuizPage,        canActivate: [authGuard] },
  { path: 'report/:id',     component: ReportPage,      canActivate: [authGuard] },
  { path: 'history',        component: HistoryPage,     canActivate: [authGuard] },
  { path: 'child/:id',      component: ChildDetailPage, canActivate: [authGuard] },
  { path: 'model',          component: ModelPage,       canActivate: [authGuard] },

  { path: 'admin',           component: AdminDashboardPage, canActivate: [adminGuard] },
  { path: 'admin/users',     component: AdminUsersPage,     canActivate: [adminGuard] },
  { path: 'admin/sessions',  component: AdminSessionsPage,  canActivate: [adminGuard] },
  { path: 'admin/questions', component: AdminQuestionsPage, canActivate: [adminGuard] },
  { path: 'admin/generate',  component: AdminGeneratePage,  canActivate: [adminGuard] },

  { path: '**', redirectTo: '' }
];
