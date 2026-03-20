import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, NgZone, inject, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions, GridReadyEvent, ICellRendererParams, themeQuartz } from 'ag-grid-community';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { SiteInventoryNormalItem } from '../../../../core/models/inventory.models';

@Component({
  selector: 'app-invsites-list-view',
  standalone: true,
  imports: [CommonModule, AgGridModule, PaginationComponent],
  templateUrl: './invsites-list-view.component.html',
  styleUrls: ['./invsites-list-view.component.css']
})
export class InvsitesListViewComponent implements OnInit, OnChanges {
  @Input() tableData: SiteInventoryNormalItem[] = [];
  @Output() viewDetails = new EventEmitter<any>();

  private gridApi!: GridApi;
  theme: any = themeQuartz;
  currentPage: number = 1;
  pageSize: number = 10;

  gridOptions: GridOptions = {
    suppressCellFocus: true,
    suppressRowHoverHighlight: false,
    headerHeight: 45,
    rowHeight: 45,
    animateRows: false,
    theme: this.theme,
    suppressColumnVirtualisation: true,
    onFirstDataRendered: (params) => {
      params.api.sizeColumnsToFit();
    }
  };

  defaultColDef: ColDef = {
    resizable: true,
    suppressMovable: true,
    sortable: true,
    filter: false,
  };

  columnDefs: ColDef[] = [];

  private ngZone = inject(NgZone);

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (this.gridApi) {
      setTimeout(() => {
        this.gridApi.sizeColumnsToFit();
      }, 100);
    }
  }

  constructor() {
    const textCol = (
      field: keyof SiteInventoryNormalItem,
      headerName: string,
      minWidth: number,
      flex: number
    ): ColDef => ({
      field,
      headerName,
      minWidth,
      flex,
      tooltipValueGetter: (params) => params.value != null ? String(params.value) : '',
      cellClass: 'invsites-ellipsis-cell'
    });

    this.columnDefs = [
      textCol('id', 'ID', 90, 0.8),
      textCol('name', 'PRODUCT / ITEM', 200, 2),
      textCol('type', 'TYPE', 100, 1),
      textCol('make', 'MAKE', 120, 1),
      textCol('model', 'MODEL', 150, 1.5),
      textCol('delivered', 'DELIVERED', 100, 1),
      textCol('returned', 'RETURN', 100, 1),
      {
        headerName: 'MORE',
        minWidth: 80,
        flex: 0.6,
        sortable: false,
        suppressMovable: true,
        cellClass: 'invsites-more-cell',
        cellRenderer: (params: ICellRendererParams) => {
          const container = document.createElement('div');
          container.className = 'invsites-more-action';

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'invsites-more-btn';
          button.title = 'View details';
          button.setAttribute('aria-label', 'View details');
          button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 15.2a1.2 1.2 0 1 1 1.2-1.2 1.2 1.2 0 0 1-1.2 1.2Zm1.4-4.7v.4h-2.3v-.7c0-2.1 2.6-2.2 2.6-4a1.7 1.7 0 0 0-1.9-1.6 2.1 2.1 0 0 0-2 1.3l-2-.9A4.2 4.2 0 0 1 12 4.8c2.5 0 4.3 1.4 4.3 3.5 0 2.7-2.9 3.1-2.9 4.2Z"></path>
            </svg>
          `;

          const emitDetails = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            this.ngZone.run(() => {
              this.viewDetails.emit(params.data);
            });
          };

          button.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
          button.addEventListener('click', emitDetails);

          container.appendChild(button);
          return container;
        }
      }
    ];
  }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tableData']) {
      this.currentPage = 1;
      this.updateGridData();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
    this.updateGridData();
  }

  updateGridData() {
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.paginatedData);
    }
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.pageSize;
    const filtered = this.tableData || [];
    return filtered.slice(start, start + this.pageSize);
  }

  get totalItems() {
    return (this.tableData || []).length;
  }

  onPageSizeChange(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.updateGridData();
  }
}
