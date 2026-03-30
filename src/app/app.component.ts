import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { concatMap, filter, mergeMap, switchMap } from 'rxjs/operators';
import { HeaderComponent } from './shared/header/header.component';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { NotificationService } from 'src/app/shared/notification.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, ToastModule, ConfirmDialogModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  showHeader = false;

  constructor(private router: Router, private notificationService: NotificationService) { }

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.showHeader = event.urlAfterRedirects !== '/login';
      });
  }
}
