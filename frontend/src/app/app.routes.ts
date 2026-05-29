import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './layout/layout.component';
import { authGuard, publicGuard } from './core/auth.guard';
import { PostDetailComponent } from './pages/post-detail/post-detail.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';
import { ComposerComponent } from './pages/composer/composer.component';
import { SearchComponent } from './pages/search/search.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: HomeComponent },
      { path: 'post/:id', component: PostDetailComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'users/:username', component: UserProfileComponent },
      { path: 'composer', component: ComposerComponent },
      { path: 'search', component: SearchComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
