import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ClosedEventsComponent } from "./closed-events/closed-events.component";
import { PendingEventsComponent } from "./pending-events/pending-events.component";

type EventsTab = "CLOSED" | "PENDING";

@Component({
  selector: "app-events",
  standalone: true,
  imports: [CommonModule, ClosedEventsComponent, PendingEventsComponent],
  templateUrl: "./events.component.html",
})
export class EventsComponent implements OnInit {
  selectedFilter: EventsTab = "CLOSED";

  ngOnInit() {
    const saved = localStorage.getItem('selectedEventsTab');
    if (saved === 'CLOSED' || saved === 'PENDING') {
      this.selectedFilter = saved as EventsTab;
    }
  }

  setFilter(filter: EventsTab): void {
    this.selectedFilter = filter;
    localStorage.setItem('selectedEventsTab', filter);
  }
}