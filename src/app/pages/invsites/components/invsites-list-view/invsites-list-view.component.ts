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
      { ...textCol('id', 'ID', 70, 0.45), width: 70, maxWidth: 80, suppressSizeToFit: true },
      textCol('name', 'PRODUCT / ITEM', 240, 2.4),
      { ...textCol('type', 'TYPE', 85, 0.65), width: 90, maxWidth: 100, suppressSizeToFit: true },
      textCol('make', 'MAKE', 105, 0.8),
      textCol('model', 'MODEL', 170, 1.4),
      { ...textCol('delivered', 'DELIVERED', 75, 0.45), width: 80, maxWidth: 90, suppressSizeToFit: true },
      { ...textCol('returned', 'RETURN', 75, 0.45), width: 80, maxWidth: 90, suppressSizeToFit: true },
      {
        headerName: 'MORE',
        width: 75,
        minWidth: 70,
        maxWidth: 85,
        flex: 0.45,
        suppressSizeToFit: true,
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

          const img = document.createElement('img');
          img.src = 'assets/icons/information-icon.svg';
          img.alt = 'View details';
          img.className = 'invsites-more-icon';

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

          button.appendChild(img);
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
