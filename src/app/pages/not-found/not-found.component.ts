import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class NotFoundComponent {
  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }
}
    