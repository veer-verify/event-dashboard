import { Component, OnInit, NgZone, inject, HostListener, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, GridOptions, themeQuartz } from 'ag-grid-community';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { CalendarComponent } from '../../../../shared/calendar/calendar.component';
import { IssuedItem } from '../../../../core/models/inventory.models';
import { InventoryService } from '../../../../core/services/inventory.service';
import { UnifiedFilterPanelComponent, FilterField } from '../../../../shared/unified-filter-panel/unified-filter-panel.component';

@Component({
  selector: 'app-inventory-issued-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, PaginationComponent, CalendarComponent, UnifiedFilterPanelComponent],
  templateUrl: './inventory-issued-tab.component.html',
  styleUrls: ['./inventory-issued-tab.component.css']
})
export class InventoryIssuedTabComponent implements OnInit, OnChanges {
  @Input() reloadTrigger: number = 0;
  @Input() selectedStore: any;
  searchText: string = '';
  fromDate?: string;
  toDate?: string;

  currentPage: number = 1;
  pageSize: number = 15;
  totalRecords: number = 0;

  isLoading: boolean = false;

  // Filter Props
  showFilterPanel: boolean = false;
  filterFields: FilterField[] = [];
  filterCriteria: any = {
    category: 'All',
    status: 'All'
  };

  categories: string[] = [];
  statuses: string[] = [];

  private gridApi!: GridApi;
  theme: any = themeQuartz;
  gridOptions: GridOptions = {
    suppressCellFocus: true,
    suppressRowHoverHighlight: false,
    headerHeight: 40,
    rowHeight: 45,
    animateRows: false,
    theme: this.theme,
    suppressColumnVirtualisation: true,
    defaultColDef: {
      sortable: true,
      filter: false,
      resizable: true,
      suppressMovable: true,
    },
    onFirstDataRendered: (params) => {
      params.api.sizeColumnsToFit();
    }
  };

  columnDefs: ColDef[] = [];
  issuedData: IssuedItem[] = [];

  @Output() viewStockSend = new EventEmitter<IssuedItem>();

  private ngZone = inject(NgZone);
  private inventoryService = inject(InventoryService);

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (this.gridApi) {
      setTimeout(() => {
        this.gridApi.sizeColumnsToFit();
      }, 100);
    }
  }

  constructor() {
    this.columnDefs = [
      { field: 'id', headerName: 'ID', width: 70, minWidth: 65, maxWidth: 80, suppressSizeToFit: true },
      { field: 'issueDate', headerName: 'DATE', width: 100, minWidth: 90, maxWidth: 110, suppressSizeToFit: true },
      {
        field: 'issuedFrom',
        headerName: 'ISSUED FROM',
        flex: 1.1,
        minWidth: 120,
        cellRenderer: (params: ICellRendererParams) => {
          const span = document.createElement('span');
          span.innerText = params.value ?? '';
          span.style.overflow = 'hidden';
          span.style.textOverflow = 'ellipsis';
          span.style.whiteSpace = 'nowrap';
          span.style.display = 'block';
          span.style.width = '100%';
          return span;
        }
      },
      {
        field: 'issuedTo',
        headerName: 'ISSUED TO',
        flex: 1.7,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams) => {
          const span = document.createElement('span');
          span.innerText = params.value ?? '';
          span.style.overflow = 'hidden';
          span.style.textOverflow = 'ellipsis';
          span.style.whiteSpace = 'nowrap';
          span.style.display = 'block';
          span.style.width = '100%';
          return span;
        }
      },
      {
        field: 'category',
        headerName: 'CATEGORY',
        flex: 0.85,
        minWidth: 95,
        cellRenderer: (params: ICellRendererParams) => {
          const span = document.createElement('span');
          span.innerText = params.value ?? '';
          span.style.overflow = 'hidden';
          span.style.textOverflow = 'ellipsis';
          span.style.whiteSpace = 'nowrap';
          span.style.display = 'block';
          span.style.width = '100%';
          return span;
        }
      },
      { field: 'transportation', headerName: 'TRANSPORT', width: 95, minWidth: 90, maxWidth: 105, suppressSizeToFit: true },
      { field: 'billing', headerName: 'BILLING', width: 90, minWidth: 85, maxWidth: 100, suppressSizeToFit: true },
      {
        field: 'status',
        headerName: 'STATUS',
        width: 95,
        minWidth: 90,
        maxWidth: 105,
        suppressSizeToFit: true,
        cellRenderer: (params: ICellRendererParams) => {
          const span = document.createElement('span');
          span.innerText = params.value ?? '';
          span.style.fontWeight = '500';

          const lowerStatus = params.value ? params.value.toLowerCase() : '';
          if (lowerStatus === 'delivered' || lowerStatus === 'working') {
            span.style.color = '#53BF8B';
          } else if (lowerStatus === 'issued') {
            span.style.color = '#000000';
          } else if (lowerStatus === 'in_transit' || lowerStatus === 'in transit') {
            span.style.color = '#F44336';
          } else if (lowerStatus === 'returned') {
            span.style.color = '#53BF8B';
          } else if (lowerStatus === 'pre-ordered') {
            span.style.color = '#FF9800';
          } else if (lowerStatus === 'scrap') {
            span.style.color = '#333333';
          } else {
            span.style.color = '#333';
          }
          return span;
        }
      },
      {
        headerName: 'ACTION',
        field: 'action',
        width: 75,
        minWidth: 70,
        maxWidth: 85,
        suppressSizeToFit: true,
        cellClass: 'inventory-issued-action-cell',
        cellRenderer: (params: ICellRendererParams) => {
          const container = document.createElement('div');
          container.className = 'inventory-issued-action';

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'inventory-issued-action-btn';
          button.title = 'View details';
          button.setAttribute('aria-label', 'View details');

          const img = document.createElement('img');
          img.src = 'assets/icons/information-icon.svg';
          img.alt = 'View details';
          img.draggable = false;
          img.className = 'inventory-issued-action-icon';

          button.addEventListener('mousedown', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
          });
          button.addEventListener('click', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            this.ngZone.run(() => {
              this.viewStockSend.emit(params.data);
            });
          });

          button.appendChild(img);
          container.appendChild(button);
          return container;
        }
      }
    ];
  }

  ngOnInit() {
    // Initial load is triggered by the CalendarComponent's dateRangeSelected emission on init
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['reloadTrigger'] && !changes['reloadTrigger'].firstChange) {
      this.loadIssuedList();
    }
    if (changes['selectedStore'] && !changes['selectedStore'].firstChange) {
      this.currentPage = 1;
      this.loadIssuedList();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    setTimeout(() => this.gridApi.sizeColumnsToFit(), 0);
  }

  onDateRangeChange(payload: any) {
    if (payload && payload.startDate && payload.endDate) {
      const start = new Date(payload.startDate);
      const end = new Date(payload.endDate);

      const fmtDate = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };

      this.fromDate = fmtDate(start);
      this.toDate = fmtDate(end);
    } else {
      this.fromDate = undefined;
      this.toDate = undefined;
    }
    this.currentPage = 1;
    this.loadIssuedList();
  }

  onSearchChange() {
    this.currentPage = 1;
    this.loadIssuedList();
  }

  applyLocalFilters() {
    let filtered = [...this.issuedData];

    // Local Filters
    filtered = filtered.filter(item => {
      if (this.filterCriteria.category !== 'All' && item.category !== this.filterCriteria.category) return false;
      if (this.filterCriteria.status !== 'All' && item.status !== this.filterCriteria.status) return false;
      return true;
    });

    if (this.gridApi) {
      this.gridApi.setGridOption("rowData", filtered);
    }
  }

  populateFilterOptions() {
    const uniqueCategories = new Set<string>();
    const uniqueStatuses = new Set<string>();

    this.issuedData.forEach(item => {
      if (item.category) uniqueCategories.add(item.category);
      if (item.status) uniqueStatuses.add(item.status);
    });

    this.categories = Array.from(uniqueCategories).sort();
    this.statuses = Array.from(uniqueStatuses).sort();

    this.setupFilterFields();
  }

  setupFilterFields() {
    this.filterFields = [
      {
        key: 'category',
        label: 'Select Category',
        type: 'dropdown',
        options: [{ label: 'All', value: 'All' }, ...this.categories.map(c => ({ label: c, value: c }))]
      },
      {
        key: 'status',
        label: 'Select Status',
        type: 'dropdown',
        options: [{ label: 'All', value: 'All' }, ...this.statuses.map(s => ({ label: s, value: s }))]
      }
    ];
  }

  toggleFilterPanel() {
    this.showFilterPanel = !this.showFilterPanel;
  }

  onFilterClose() {
    this.showFilterPanel = false;
  }

  onFilterReset() {
    this.filterCriteria = {
      category: 'All',
      status: 'All'
    };
    this.applyLocalFilters();
  }

  onFilterApply(criteria: any) {
    this.filterCriteria = { ...criteria };
    this.applyLocalFilters();
    this.showFilterPanel = false;
  }

  onFilterCriteriaChange(criteria: any) {
    this.filterCriteria = { ...criteria };
    this.applyLocalFilters();
  }

  loadIssuedList() {
    this.isLoading = true;
    const params: any = {
      pageNo: this.currentPage,
      pageSize: this.pageSize,
    };
    if (this.searchText) params.search = this.searchText;
    if (this.fromDate) params.fromDate = this.fromDate;
    if (this.toDate) params.toDate = this.toDate;
 
    if (this.selectedStore && this.selectedStore.code && this.selectedStore.code !== 'all') {
      params.storeId = this.selectedStore.code;
    }

    this.inventoryService.getIssuedList(params).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.issuedData = response.data;
          this.totalRecords = response.pagination?.totalRecords ?? 0;
          this.populateFilterOptions();
          this.applyLocalFilters();
        } else {
          this.issuedData = [];
          this.totalRecords = 0;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load issued list:', err);
        this.issuedData = [];
        this.totalRecords = 0;
        this.isLoading = false;
      }
    });
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadIssuedList();
  }

  onPageSizeChange(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadIssuedList();
  }
}
