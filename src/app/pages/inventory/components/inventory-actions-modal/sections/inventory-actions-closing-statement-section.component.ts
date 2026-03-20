import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryActionsModalComponent } from '../inventory-actions-modal.component';

@Component({
  selector: 'app-inventory-actions-closing-statement-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory-actions-closing-statement-section.component.html',
  styleUrls: ['../inventory-actions-modal.component.css']
})
export class InventoryActionsClosingStatementSectionComponent {
  @Input({ required: true }) ctx!: InventoryActionsModalComponent;
}

