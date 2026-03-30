import { Component, OnInit, NgZone, inject, HostListener, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, GridOptions, themeQuartz } from 'ag-grid-community';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { CalendarComponent } from '../../../../shared/calendar/calendar.component';
import { PurchaseItem } from '../../../../core/models/inventory.models';
import { InventoryService } from '../../../../core/services/inventory.service';
import { UnifiedFilterPanelComponent, FilterField } from '../../../../shared/unified-filter-panel/unified-filter-panel.component';

@Component({
  selector: 'app-inventory-purchase-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, PaginationComponent, CalendarComponent, UnifiedFilterPanelComponent],
  templateUrl: './inventory-purchase-tab.component.html',
  styleUrls: ['./inventory-purchase-tab.component.css']
})
export class InventoryPurchaseTabComponent implements OnInit, OnChanges {
  searchText: string = '';
  startDate?: string;
  endDate?: string;

  currentPage: number = 1;
  pageSize: number = 15;
  totalRecords: number = 0;
  totalPages: number = 0;
  isLoading: boolean = false;

  // Filter Props
  showFilterPanel: boolean = false;
  filterFields: FilterField[] = [];
  filterCriteria: any = {
    purchaseType: 'All',
    status: 'All'
  };

  types: string[] = [];
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
  purchaseData: PurchaseItem[] = [];
  allFilteredData: PurchaseItem[] = [];

  @Input() reloadTrigger: number = 0;
  @Output() viewPurchase = new EventEmitter<PurchaseItem>();
  @Output() loadingChange = new EventEmitter<boolean>();

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
      { field: 'purchase_id', headerName: 'ID', width: 70, minWidth: 65, maxWidth: 80, suppressSizeToFit: true },
      { field: 'invoiceDate', headerName: 'DATE', width: 100, minWidth: 90, maxWidth: 110, suppressSizeToFit: true },
      { field: 'invoiceNumber', headerName: 'INVOICE NO.', flex: 0.9, minWidth: 115 },
      {
        field: 'purchaseFrom',
        headerName: 'PURCHASE FROM',
        flex: 1.8,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams) => {
          const span = document.createElement('span');
          span.innerText = params.value;
          span.style.overflow = 'hidden';
          span.style.textOverflow = 'ellipsis';
          span.style.whiteSpace = 'nowrap';
          span.style.display = 'block';
          span.style.width = '100%';
          return span;
        }
      },
      {
        field: 'deliveredToName',
        headerName: 'DELIVERED TO',
        flex: 1.4,
        minWidth: 150,
        cellRenderer: (params: ICellRendererParams) => {
          const span = document.createElement('span');
          span.innerText = params.value;
          span.style.overflow = 'hidden';
          span.style.textOverflow = 'ellipsis';
          span.style.whiteSpace = 'nowrap';
          span.style.display = 'block';
          span.style.width = '100%';
          return span;
        }
      },
      { field: 'purchaseType', headerName: 'TYPE', width: 85, minWidth: 80, maxWidth: 95, suppressSizeToFit: true },
      { field: 'totalItems', headerName: 'ITEMS', width: 65, minWidth: 60, maxWidth: 75, suppressSizeToFit: true },
      {
        field: 'status',
        headerName: 'STATUS',
        width: 95,
        minWidth: 90,
        maxWidth: 105,
        suppressSizeToFit: true,
        cellRenderer: (params: ICellRendererParams) => {
          const span = document.createElement('span');
          span.innerText = params.value;
          span.style.fontWeight = '500';

          if (params.data && params.data.statusColor) {
            span.style.color = params.data.statusColor;
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
        cellClass: 'inventory-purchase-action-cell',
        cellRenderer: (params: ICellRendererParams) => {
          const container = document.createElement('div');
          container.className = 'inventory-purchase-action';

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'inventory-purchase-action-btn';
          button.title = 'View details';
          button.setAttribute('aria-label', 'View details');

          const infoImg = document.createElement('img');
          infoImg.src = 'assets/icons/information-icon.svg';
          infoImg.alt = 'View details';
          infoImg.draggable = false;
          infoImg.className = 'inventory-purchase-action-icon';

          button.addEventListener('mousedown', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
          });
          button.addEventListener('click', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            this.ngZone.run(() => {
              this.viewPurchase.emit(params.data);
            });
          });

          button.appendChild(infoImg);
          container.appendChild(button);
          return container;
        },
      }
    ];
  }

  ngOnInit() {
    // Initial load triggered by CalendarComponent's dateRangeSelected emission on init
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['reloadTrigger'] && !changes['reloadTrigger'].firstChange) {
      this.fetchPurchaseData();
    }
    if (changes['selectedStore'] && !changes['selectedStore'].firstChange) {
      this.currentPage = 1;
      this.fetchPurchaseData();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this.allFilteredData.length > 0) {
      setTimeout(() => this.gridApi.sizeColumnsToFit(), 0);
    }
  }

  onDateRangeChange(payload: any) {
    if (payload?.startDate && payload?.endDate) {
      const start = new Date(payload.startDate);
      const end = new Date(payload.endDate);
      const today = new Date();

      const fmt = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      // Start of the selected start date (midnight local time)
      const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
      this.startDate = fmt(startMidnight);

      // If end date is today → use current time; otherwise end-of-day
      const isEndToday = end.getFullYear() === today.getFullYear() &&
        end.getMonth() === today.getMonth() &&
        end.getDate() === today.getDate();

      if (isEndToday) {
        this.endDate = fmt(today);
      } else {
        const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
        this.endDate = fmt(endOfDay);
      }
    } else {
      this.startDate = undefined;
      this.endDate = undefined;
    }
    this.currentPage = 1;
    this.fetchPurchaseData();
  }

  onSearchChange() {
    this.currentPage = 1;
    this.filterData();
  }

  filterData() {
    let filtered = [...this.purchaseData];

    // Search
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      filtered = filtered.filter((item: any) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(q)
        )
      );
    }

    // Local Filters
    filtered = filtered.filter(item => {
      if (this.filterCriteria.purchaseType !== 'All' && item.purchaseType !== this.filterCriteria.purchaseType) return false;
      if (this.filterCriteria.status !== 'All' && item.status !== this.filterCriteria.status) return false;
      return true;
    });

    this.allFilteredData = filtered;

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.allFilteredData);
    }
  }

  populateFilterOptions() {
    const uniqueTypes = new Set<string>();
    const uniqueStatuses = new Set<string>();

    this.purchaseData.forEach(item => {
      if (item.purchaseType) uniqueTypes.add(item.purchaseType);
      if (item.status) uniqueStatuses.add(item.status);
    });

    this.types = Array.from(uniqueTypes).sort();
    this.statuses = Array.from(uniqueStatuses).sort();

    this.setupFilterFields();
  }

  setupFilterFields() {
    this.filterFields = [
      {
        key: 'purchaseType',
        label: 'Select Type',
        type: 'dropdown',
        options: [{ label: 'All', value: 'All' }, ...this.types.map(t => ({ label: t, value: t }))]
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
      purchaseType: 'All',
      status: 'All'
    };
    this.filterData();
  }

  onFilterApply(criteria: any) {
    this.filterCriteria = { ...criteria };
    this.filterData();
    this.showFilterPanel = false;
  }

  onFilterCriteriaChange(criteria: any) {
    this.filterCriteria = { ...criteria };
    this.filterData();
  }

  @Input() selectedStore: any;

  fetchPurchaseData() {
    this.setLoading(true);
    const params: any = {
      pageNo: this.currentPage,
      pageSize: this.pageSize,
      startDate: this.startDate,
      endDate: this.endDate
    };

    if (this.selectedStore && this.selectedStore.code && this.selectedStore.code !== 'all') {
      params.storeId = this.selectedStore.code;
    }

    this.inventoryService.getPurchaseList(params).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.purchaseData = res.data;
          this.totalRecords = res.pagination ? res.pagination.totalRecords : this.purchaseData.length;
          this.totalPages = res.pagination ? res.pagination.totalPages : 1;

          this.populateFilterOptions();
          this.filterData();
        } else {
          console.warn("API responded successfully but data is not present:", res);
        }
        this.setLoading(false);
      },
      error: (err) => {
        console.error("Error fetching purchase data", err);
        this.setLoading(false);
      }
    });
  }

  get paginatedData() {
    return this.allFilteredData; // Grid is fed this array directly for server-side pagination simulation
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.fetchPurchaseData();
  }

  onPageSizeChange(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.fetchPurchaseData();
  }

  private setLoading(status: boolean) {
    this.isLoading = status;
    this.loadingChange.emit(status);
  }
}
