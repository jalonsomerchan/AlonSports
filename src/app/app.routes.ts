import { Routes } from '@angular/router';
import { ActivitiesPage, ActivityPage, AppShell, DashboardPage, ImportPage, LiveActivitiesPage, LiveActivityPage, LiveDashboardPage, LiveSegmentsPage, LoginPage, SegmentDetailPage, SegmentEditorPage, SegmentsPage, SettingsPage, SharePage } from './app';
import { ProgressPage } from './progress';
import { StatisticsPage } from './statistics';
import { ComparePage } from './compare';
import { MorePage, RouteDetailPage, RoutesPage } from './more';
import { LabelsPage } from './labels';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'app', component: AppShell, canActivate: [authGuard], children: [
    { path: 'dashboard', component: LiveDashboardPage },
    { path: 'progress', component: ProgressPage },
    { path: 'activities', component: LiveActivitiesPage },
    { path: 'activity/:id/share', component: SharePage },
    { path: 'statistics', component: StatisticsPage },
    { path: 'compare', component: ComparePage },
    { path: 'more', component: MorePage },
    { path: 'routes/:id', component: RouteDetailPage },
    { path: 'routes', component: RoutesPage },
    { path: 'labels', component: LabelsPage },
    { path: 'activity/:id/:section', component: LiveActivityPage },
    { path: 'activity/:id', redirectTo: 'activity/:id/overview', pathMatch: 'full' },
    { path: 'segments/new', component: SegmentEditorPage },
    { path: 'segments/:id', component: SegmentDetailPage },
    { path: 'segments', component: LiveSegmentsPage },
    { path: 'import', component: ImportPage },
    { path: 'settings', component: SettingsPage },
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  ] },
  { path: '', component: LoginPage, pathMatch: 'full' },
  { path: '**', redirectTo: 'app/dashboard' },
];
