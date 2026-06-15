import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

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
    { path: '**', redirectTo: '' },
];
