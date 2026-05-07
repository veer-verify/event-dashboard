// copy-cell-renderer.component.ts
import { Component, OnDestroy } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-copy-cell-renderer',
  standalone: true, 
  imports: [CommonModule],  
  template: `
    <div class="copy-cell" 
         (mouseenter)="showTooltip = true" 
         (mouseleave)="showTooltip = false"
         (click)="copyToClipboard()"
         [attr.title]="showTooltip ? 'Click to copy' : ''"
         style="cursor: pointer; position: relative; display: inline-block; padding: 2px 4px; border-radius: 3px; width: 100%;">
      {{ displayValue }}
      <span *ngIf="showTooltip && !copied" 
            style="position: absolute; background: #333; color: white; padding: 4px 8px; 
                   border-radius: 4px; font-size: 12px; bottom: 100%; left: 50%; 
                   transform: translateX(-50%); white-space: nowrap; z-index: 1000;
                   margin-bottom: 5px; pointer-events: none;">
        Click to copy
        <span style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
                     border-width: 5px; border-style: solid; border-color: #333 transparent transparent transparent;"></span>
      </span>
      <span *ngIf="copied" 
            style="position: absolute; background: #4CAF50; color: white; padding: 4px 8px; 
                   border-radius: 4px; font-size: 12px; bottom: 100%; left: 50%; 
                   transform: translateX(-50%); white-space: nowrap; z-index: 1000;
                   margin-bottom: 5px; animation: fadeOut 1s forwards; pointer-events: none;">
        Copied!
        <span style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
                     border-width: 5px; border-style: solid; border-color: #4CAF50 transparent transparent transparent;"></span>
      </span>
    </div>
  `,
  styles: [`
    .copy-cell {
      transition: background-color 0.2s;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .copy-cell:hover {
      background-color: #f0f0f0;
    }
    @keyframes fadeOut {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
  `]
})
export class CopyCellRendererComponent implements ICellRendererAngularComp, OnDestroy {
  displayValue: any;
  private rawValue: any;
  showTooltip = false;
  copied = false;
  private timeoutId: any;

  agInit(params: ICellRendererParams): void {
    this.rawValue = params.value;
    this.displayValue = params.valueFormatted ? params.valueFormatted : 
                       (params.value && params.value !== '-' ? params.value : '-');
  }

  refresh(params: ICellRendererParams): boolean {
    this.rawValue = params.value;
    this.displayValue = params.valueFormatted ? params.valueFormatted : 
                       (params.value && params.value !== '-' ? params.value : '-');
    return true;
  }

  copyToClipboard(): void {
    // Use raw value for copying, not the formatted display value
    const valueToCopy = this.rawValue;
    
    if (valueToCopy && valueToCopy !== '-') {
      navigator.clipboard.writeText(valueToCopy.toString()).then(() => {
        this.copied = true;
        
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
        }
        
        this.timeoutId = setTimeout(() => {
          this.copied = false;
          this.timeoutId = null;
        }, 1000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
}