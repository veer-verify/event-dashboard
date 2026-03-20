import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SiteInventoryItemDetailsData } from '../../../../core/models/inventory.models';

@Component({
  selector: 'app-inventory-site-item-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory-site-item-details-modal.component.html',
  styleUrls: ['./inventory-site-item-details-modal.component.css']
})
export class InventorySiteItemDetailsModalComponent {
  @Input() visible: boolean = false;
  @Input() title: string = '';
  @Input() itemData: SiteInventoryItemDetailsData | null = null;
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.onClose();
    }
  }
}
