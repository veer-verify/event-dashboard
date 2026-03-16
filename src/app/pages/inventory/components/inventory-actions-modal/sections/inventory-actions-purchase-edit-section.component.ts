import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputSwitchModule } from 'primeng/inputswitch';
import { FileUploadComponent } from '../../../../../shared/file-upload/file-upload.component';
import { InventoryActionsModalComponent } from '../inventory-actions-modal.component';

@Component({
  selector: 'app-inventory-actions-purchase-edit-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DropdownModule,
    CalendarModule,
    InputSwitchModule,
    FileUploadComponent
  ],
  templateUrl: './inventory-actions-purchase-edit-section.component.html',
  styleUrls: ['../inventory-actions-modal.component.css']
})
export class InventoryActionsPurchaseEditSectionComponent {
  @Input({ required: true }) ctx!: InventoryActionsModalComponent;
}

