import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent),
    },
    {
        path: 'coming-soon',
        canActivate: [authGuard],
        loadComponent: () => import('./features/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    },
    {
        path: 'chef/onboarding',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/chef/onboarding-wizard.component').then((m) => m.OnboardingWizardComponent),
    },
    {
        path: 'chef',
        canActivate: [authGuard],
        loadComponent: () => import('./features/chef/chef-onboarding.component').then((m) => m.ChefOnboardingComponent),
    },
    {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
    },
    { path: '**', redirectTo: '' },
];
