import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ItemsService } from '../../../../core/services/items.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { MetadataService } from '../../../../core/services/metadata.service';
import {
  ItemForIssue, ProductForIssue, MetadataResponse, MetadataItem, ReturnableStockItem, ReturnableStockProduct, AddReturnPayload, AddReturnItemPayload, AddReturnProductPayload, ReturnableStockResponse,
  ReturnDetailsData, ClosingStatementResponse, ClosingStatementDetail
} from '../../../../core/models/inventory.models';
import { OverlayOptions, MessageService } from 'primeng/api';
import { FileUploadComponent } from '../../../../shared/file-upload/file-upload.component';
import { ImagePipe } from '../../../../shared/image.pipe';
import { AuthService } from '../../../../login/login.service';
import { PurchaseItem } from '../../../../core/models/purchase.models';
import { InventoryActionsPurchaseEditSectionComponent } from './sections/inventory-actions-purchase-edit-section.component';
import { InventoryActionsClosingStatementSectionComponent } from './sections/inventory-actions-closing-statement-section.component';

export interface ViewPurchaseItem extends PurchaseItem {
  id?: number;
  purchaseItemId?: number;
  allPurchaseItemIds?: number[];
  actionQty?: number;
  serialNo?: string;
  newSerialNumber?: string;
  barcodeNo?: string;
  newBarcode?: string;
  newStatus?: string;
  returnReason?: string;
  rate?: number;
  gst?: number;
  code?: string;
  totalPrice?: number | string;
  isModified?: boolean;
  originalStatus?: string;
  originalReturnReason?: string;
  serialNumberFlag?: string;
  barcodeFlag?: string;
  serial_number_flag?: string;
  barcode_flag?: string;
  requiresSerial?: boolean;
  requiresBarcode?: boolean;
}

@Component({
  selector: 'app-inventory-actions-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DropdownModule,
    CalendarModule,
    InputSwitchModule,
    FileUploadComponent,
    ImagePipe,
    InventoryActionsPurchaseEditSectionComponent,
    InventoryActionsClosingStatementSectionComponent
  ],
  templateUrl: './inventory-actions-modal.component.html',
  styleUrls: ['./inventory-actions-modal.component.css']
})
export class InventoryActionsModalComponent implements OnInit, OnChanges {
  customOverlayOptions: OverlayOptions = {
    styleClass: 'dropdown-zindex-fix'
  };
  @Input() mode: 'add-purchase' | 'view-purchase' | 'stock-send' | 'view-stock-send' | 'stock-return' | 'closing-statement' | 'update-purchase' | 'view-return' = 'add-purchase';
  @Input() data: any = {};
  @Input() isLoading: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<any>();
  @Output() openCreateItem = new EventEmitter<void>();
  @Output() openAddItemModel = new EventEmitter<void>();

  // Modal overlay click logic is below

  onOverlayClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('custom-modal-overlay')) {
      this.close.emit();
    }
  }

  isEditing: boolean = false;
  maxDate: Date = new Date();

  // PURCHASE FORM STATE
  addPurchaseForm!: FormGroup;
  isDeliveredSubmit: boolean = false;
  hasMissingSerials: boolean = false;
  hasMissingBarcodes: boolean = false;

  get isPreorderUpdate(): boolean {
    const s = String(this.data?.status || this.data?.purchase?.status || '').toUpperCase().replace(/[_\s-]/g, '');
    return this.mode === 'update-purchase' && (s === 'PREORDER' || s === 'PREORDERED');
  }

  get isDeliveredUpdate(): boolean {
    const s = String(this.data?.status || this.data?.purchase?.status || '').toUpperCase().replace(/[_\s-]/g, '');
    return this.mode === 'update-purchase' && s === 'DELIVERED';
  }

  countries: string[] = ['India', 'USA', 'UK'];
  stores: string[] = [];
  onlinePlatforms: string[] = [];
  vendorNames: string[] = [];
  allPlatformsAndVendors: string[] = [...this.vendorNames, ...this.onlinePlatforms];

  newItem: any = {
    itemName: null,
    qty: null,
    cost: null,
    gst: null,
    total: null,
    link: '',
    serialNumberFlag: 'T',
    barcodeFlag: 'T',
    serialDetails: [{ serialNo: '', barcodeNo: '' }]
  };

  // VIEW PURCHASE STATE
  viewPurchaseItems: ViewPurchaseItem[] = [];
  isBulkEditingStatus: boolean = false;
  isPreorderSubmitAttempted: boolean = false;
  isReturnSubmitAttempted: boolean = false;
  isItemEntryAttempted: boolean = false;
  isProductEntryAttempted: boolean = false;
  isReturnItemEntryAttempted: boolean = false;
  isReturnProductEntryAttempted: boolean = false;
  newItemSubmitAttempted: boolean = false;
  statusOptions: any[] = [
    { label: 'Pre-order', value: 'PREORDER' },
    { label: 'Delivered', value: 'DELIVERED' },
    { label: 'Returned', value: 'RETURNED' }
  ];

  get isPreorderInvoice(): boolean {
    const status = String(this.data?.purchase?.status || this.data?.status || this.data?.purchase?.invoiceType || this.data?.invoiceType || '').toUpperCase().replace(/[_\s-]/g, '');
    return status === 'PREORDER' || status === 'PREORDERED';
  }

  // STOCK SEND MODE STATE
  stockSend: any = {
    sendFrom: 'Store',
    site: null,
    category: null
  };

  transportation: any = {
    platform: 'Fedex',
    trackingId: '',
    shipmentDate: null,
    deliveredDate: null
  };

  newStockItem: any = {
    name: null,
    qty: null,
    billingStatus: null
  };
  addedStockItems: any[] = [];

  newStockProduct: any = {
    name: null,
    qty: null,
    billingStatus: null,
    productStatus: 'SALE'
  };
  addedStockProducts: any[] = [];

  // View Modes Data
  viewReturnData: ReturnDetailsData | null = null;
  isEditingReturnStatus: boolean = false;

  // DROPDOWN LISTS
  sendFromOptions: any[] = [];
  siteOptions: any[] = [];
  returnFromOptions: any[] = [];
  categoryOptions: any[] = [];
  billingStatuses: { label: string; value: any }[] = [];
  shippingPlatforms: { label: string; value: any }[] = [];
  returnToOptions: { label: string; value: any }[] = [];
  issueStatusOptions: any[] = [
    { label: 'Issued', value: 'ISSUED' },
    { label: 'Delivered', value: 'DELIVERED' }
  ];

  returnStatusOptions: any[] = [
    { label: 'In Transit', value: 'IN_TRANSIT' },
    { label: 'Returned', value: 'RETURNED' }
  ];

  productStatusOptions: any[] = [
    { label: 'Sale', value: 'SALE' },
    { label: 'Lease', value: 'LEASE' }
  ];

  stockReturn: any = {
    returnFrom: 'Select',
    returnTo: 'Store'
  };

  newReturnItem: any = {
    name: null,
    qty: null,
    condition: null
  };

  newReturnProduct: any = {
    name: null,
    qty: null,
    condition: null
  };

  addedReturnItems: any[] = [];

  returnConditions: string[] = ['USED', 'SCRAP'];

  // File Upload State
  invoiceFile: any = null;
  otherFiles: any[] = [];

  // ITEMS LIST from API (typed via ItemForIssue)
  itemsList: ItemForIssue[] = [];

  // PRODUCTS LIST from API (typed via ProductForIssue)
  productsList: ProductForIssue[] = [];

  // RETURNABLE LISTS from API (for Stock Return)
  returnableItemsList: ReturnableStockItem[] = [];
  returnableProductsList: ReturnableStockProduct[] = [];

  // --- REACTIVE FORMS ---
  stockSendForm!: FormGroup;
  stockReturnForm!: FormGroup;

  constructor(
    private itemsService: ItemsService,
    private inventoryService: InventoryService,
    private metadataService: MetadataService,
    private fb: FormBuilder,
    private authService: AuthService,
    private messageService: MessageService
  ) { }

  currentUser = this.authService.getStoredUser();
  userId = this.currentUser?.UserId || 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.addPurchaseForm) {
      if (this.mode === 'add-purchase' || this.mode === 'update-purchase') {
        this.patchForms();
      }
    }
    if (changes['data'] && this.mode === 'view-purchase') {
      this.initViewItems();
    }
    if (changes['data'] && this.mode === 'view-return') {
      this.fetchReturnDetails();
    }
  }

  ngOnInit() {
    this.initForms();
    this.isEditing = (this.mode === 'add-purchase' || this.mode === 'update-purchase' || this.mode === 'stock-send' || this.mode === 'stock-return');
    this.isEditingIssueStatus = false;
    this.isEditingReturnStatus = false;

    // Initialize defaults if not present
    if (!this.data.type) {
      this.data.type = 'Online';
    }

    // Load Items/Products
    if (this.mode === 'stock-send') {
      this.loadStockSendItemsDropdown();
      this.loadProductsDropdown();
    } else if (this.mode === 'stock-return') {
      // Stock return uses getReturnableStock called on returnFrom change
    } else if (this.mode === 'add-purchase' || this.mode === 'update-purchase') {
      this.loadPurchaseItemsDropdown();
    }

    if (this.mode === 'stock-send' || this.mode === 'stock-return') {
      this.loadStockSendDropdowns();
    }

    this.patchForms();

    if (this.mode === 'stock-send') {
      if (!this.data.items) this.data.items = [{}];
    }

    if (this.mode === 'stock-send') {
      this.addedStockItems = [];
      this.addedStockProducts = [];
    }

    if (this.mode === 'closing-statement') {
      this.fetchClosingStatement();
    }
    if (this.mode === 'view-stock-send') {
      this.initViewStockSendData();
    }
    if (this.mode === 'view-purchase') {
      this.initViewItems();
    }

  }

  private fetchReturnDetails() {
    if (this.data && this.data.id) {
      this.inventoryService.getReturnDetails(this.data.id).subscribe({
        next: (res) => {
          if (res.statusCode === 200 && res.data) {
            this.viewReturnData = res.data;
            if (this.viewReturnData.header.returnDate) {
              const dateStr = this.viewReturnData.header.returnDate;
              let parsedDate: Date | null = null;
              if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
              } else {
                // Try standard parsing for "14 Mar, 2026" etc.
                const d = new Date(dateStr.replace(',', ''));
                if (!isNaN(d.getTime())) {
                  parsedDate = d;
                }
              }
              this.viewReturnData.header.returnDateObj = parsedDate || undefined;
            }
            this.isEditingReturnStatus = false;
          }
        },
        error: (err) => {
          console.error('Error fetching return details', err);
        }
      });
    }
  }

  // --------------------------------------------------------------------------------
  // INITIALIZERS
  // --------------------------------------------------------------------------------
  initForms() {
    this.addPurchaseForm = this.fb.group({
      purchaseForCountry: ['India', Validators.required],
      purchaseForStore: [null, Validators.required],
      invoiceNo: [''],
      invoiceDate: [null],
      vendorName: [''],
      purchaseVia: [null, Validators.required],
      platform: [null, Validators.required],
      isPreorder: [false],
      purchaseItems: this.fb.array([])
    });

    this.addPurchaseForm.get('purchaseForCountry')?.valueChanges.pipe(distinctUntilChanged()).subscribe(country => {
      this.loadPurchaseSources(country);
    });

    if (this.mode === 'add-purchase' || this.mode === 'update-purchase' || this.mode === 'view-purchase') {
      // Manual call removed here as patchForms or initial value will trigger the subscription if needed, 
      // but wait, patchForms emits events. Let's keep it safe. 
      // Actually, patchForms is called in ngOnInit after initForms.
    }

    this.stockSendForm = this.fb.group({
      sendFrom: ['Store', Validators.required],
      site: [null, Validators.required],
      category: [null, Validators.required],
      billingStatus: [null, Validators.required],
      status: [null, Validators.required],
      transportationPlatform: [null, Validators.required],
      trackingId: ['', Validators.required],
      shipmentDate: [null, Validators.required],
      deliveredDate: [null],
      stockSendItems: this.fb.array([]),
      stockSendProducts: this.fb.array([])
    }, { validators: this.dateRangeValidator });

    this.stockSendForm.get('status')?.valueChanges.subscribe(val => {
      const deliveredDate = this.stockSendForm.get('deliveredDate');
      if (val === 'DELIVERED') {
        deliveredDate?.setValidators([Validators.required]);
        if (!deliveredDate?.value) {
          // If status is DELIVERED, but no date, maybe set current date as default? 
          // User didn't explicitly ask for default, but let's keep it clean.
        }
      } else {
        deliveredDate?.clearValidators();
        deliveredDate?.setValue(null, { emitEvent: false });
      }
      deliveredDate?.updateValueAndValidity();
    });

    this.stockSendForm.get('deliveredDate')?.valueChanges.subscribe(date => {
      if (date && this.stockSendForm.get('status')?.value !== 'DELIVERED') {
        this.stockSendForm.get('status')?.setValue('DELIVERED', { emitEvent: true });
      }
    });

    this.stockSendForm.get('sendFrom')?.valueChanges.subscribe(storeId => {
      this.onSendFromChange(storeId);
    });

    this.stockReturnForm = this.fb.group({
      returnFrom: ['Select', Validators.required],
      returnTo: ['Store', Validators.required],
      status: [null, Validators.required],
      returnDate: [null],
      remarks: [''],
      stockReturnItems: this.fb.array([]),
      stockReturnProducts: this.fb.array([])
    });

    this.stockReturnForm.get('status')?.valueChanges.subscribe(val => {
      const returnDate = this.stockReturnForm.get('returnDate');
      if (val === 'RETURNED') {
        returnDate?.setValidators([Validators.required]);
      } else {
        returnDate?.clearValidators();
      }
      returnDate?.updateValueAndValidity();
    });

    if (this.mode === 'stock-return') {
      this.stockReturnForm.get('returnFrom')?.valueChanges.subscribe(returnFromId => {
        if (returnFromId && returnFromId !== 'Select') {
          // Find selected site's country to filter Return To stores
          const selectedSite = this.returnFromOptions.find(o => o.value === returnFromId);
          this.loadReturnToOptions(selectedSite?.country);

          this.loadReturnableStock(returnFromId);
        } else {
          this.loadReturnToOptions(); // Reset to all stores
          this.returnableItemsList = [];
          this.returnableProductsList = [];
        }
      });
    }
  }

  loadReturnableStock(returnFromId: number) {
    this.inventoryService.getReturnableStock(returnFromId).subscribe({
      next: (res: any) => {
        if (res?.status === 'Success' && res?.data) {
          this.returnableItemsList = res.data.items || [];
          this.returnableProductsList = res.data.products || [];
        }
      },
      error: (err: any) => {
        this.returnableItemsList = [];
        this.returnableProductsList = [];
      }
    });
  }

  loadStockSendDropdowns() {
    if (this.mode === 'stock-send') {
      // Load Inv_Category
      this.metadataService.getDropdownByTypeName('Inv_Category').subscribe({
        next: (res: MetadataResponse[]) => {
          const metadataArray: MetadataItem[] = res?.[0]?.metadata || [];
          this.categoryOptions = metadataArray.map((item: MetadataItem) => ({
            label: item.value,
            value: item.keyId
          }));
        },
        error: (err: any) => console.error('Failed to load categories', err)
      });

      // Load Inv_ShippingFlatform for Transportation dropdown
      this.metadataService.getDropdownByTypeName('Inv_ShippingFlatform').subscribe({
        next: (res: MetadataResponse[]) => {
          const metadataArray: MetadataItem[] = res?.[0]?.metadata || [];
          this.shippingPlatforms = metadataArray.map((item: MetadataItem) => ({
            label: item.value,
            value: item.keyId
          }));

          // Fallback: If transportationPlatform is missing but we have the string, find it
          if (this.mode === 'view-stock-send' && this.viewStockSendData && !this.viewStockSendData.transportationPlatform && this.viewStockSendData.transportation) {
            const match = this.shippingPlatforms.find(p => p.label.toLowerCase() === this.viewStockSendData.transportation.toLowerCase());
            if (match) {
              this.viewStockSendData.transportationPlatform = match.value;
            }
          }
        },
        error: (err: any) => console.error('Failed to load shipping platforms', err)
      });

      // Load Inv_BillingStatus for Item/Product Billing Status dropdowns
      this.metadataService.getDropdownByTypeName('Inv_BillingStatus').subscribe({
        next: (res: MetadataResponse[]) => {
          const metadataArray: MetadataItem[] = res?.[0]?.metadata || [];
          this.billingStatuses = metadataArray.map((item: MetadataItem) => ({
            label: item.value,
            value: item.keyId
          }));
        },
        error: (err: any) => console.error('Failed to load billing statuses', err)
      });
    }

    // Load dropdown sources efficiently using backend filters
    if (this.mode === 'stock-return') {
      this.returnFromOptions = [];

      this.inventoryService.getPurchaseSources(undefined, 'Site').subscribe({
        next: (res: any) => {
          if (res?.status === 'Success' && res?.data) {
            this.returnFromOptions = res.data
              .filter((s: any) => s.sourceType === 'Site')
              .map((s: any) => ({
                label: s.sourceName,
                value: s.sourceId,
                country: s.source_country
              }));
          }
        },
        error: (err: any) => console.error('Failed to load site sources', err)
      });

    } else if (this.mode === 'stock-send') {
      // Send From (Stores)
      this.inventoryService.getPurchaseSources(undefined, 'Store').subscribe({
        next: (res: any) => {
          if (res?.status === 'Success' && res?.data) {
            this.sendFromOptions = res.data
              .filter((s: any) => s.sourceType === 'Store')
              .map((s: any) => ({ label: s.sourceName, value: s.sourceId }));
            const currentSendFrom = this.stockSendForm.get('sendFrom')?.value;
            if (currentSendFrom) {
              this.onSendFromChange(currentSendFrom);
            }
          }
        },
        error: (err: any) => console.error('Failed to load store sources', err)
      });

      // Site (Sites)
      // Removed initial load as it will be dynamic based on Send From
      /*
      this.inventoryService.getPurchaseSources(undefined, 'Site').subscribe({
        next: (res: any) => {
          if (res?.status === 'Success' && res?.data) {
            this.siteOptions = res.data.map((s: any) => ({ label: s.sourceName, value: s.sourceId }));
          }
        },
        error: (err: any) => console.error('Failed to load site sources', err)
      });
      */
    }
  }

  loadReturnToOptions(country?: string) {
    this.inventoryService.getPurchaseSources(country, 'Store').subscribe({
      next: (res: any) => {
        if (res?.status === 'Success' && res?.data) {
          this.returnToOptions = res.data
            .filter((s: any) => s.sourceType === 'Store')
            .map((s: any) => ({
              label: s.sourceName,
              value: s.sourceId
            }));

          if (this.returnToOptions.length > 0) {
            const currentVal = this.stockReturnForm.get('returnTo')?.value;
            if (!currentVal || currentVal === 'Store' || !this.returnToOptions.find(o => o.value === currentVal)) {
              this.stockReturnForm.get('returnTo')?.setValue(this.returnToOptions[0].value, { emitEvent: false });
            }
          } else {
            this.stockReturnForm.get('returnTo')?.setValue(null, { emitEvent: false });
          }
        }
      },
      error: (err: any) => console.error('Failed to load store sources for Return To', err)
    });
  }

  onSendFromChange(storeId: any) {
    if (!storeId || storeId === 'Select' || storeId === 'Store') {
      this.siteOptions = [];
      this.itemsList = [];
      this.stockSendForm.get('site')?.setValue(null);
      this.stockSendForm.get('site')?.disable();
      return;
    }

    // Load store-specific items
    this.loadStockSendItemsDropdown(storeId);

    // Lookup the store name (label) to call the site API
    const selectedStore = this.sendFromOptions.find(o => o.value === storeId);
    const storeName = selectedStore ? selectedStore.label : null;

    if (storeName && storeName !== 'Store') {
      this.stockSendForm.get('site')?.enable();
      this.inventoryService.getSitesByStore_1_0(storeName).subscribe({
        next: (res: any) => {
          if (res && res.data) {
            this.siteOptions = res.data.map((s: any) => ({ label: s.siteName, value: s.siteId }));
          } else {
            this.siteOptions = [];
          }
          this.stockSendForm.get('site')?.setValue(null);
        },
        error: (err: any) => {
          this.siteOptions = [];
          this.stockSendForm.get('site')?.setValue(null);
        }
      });
    } else {
      this.siteOptions = [];
      this.stockSendForm.get('site')?.setValue(null);
      this.stockSendForm.get('site')?.disable();
    }
  }

  loadPurchaseSources(country?: string) {
    const countryParam = (country && country !== 'Select') ? country : '';
    this.inventoryService.getPurchaseSources(countryParam).subscribe({
      next: (res) => {
        if (res && res.status === 'Success' && res.data) {
          const sources = res.data;

          // const storeSites = sources.filter((s: any) => s.sourceType === 'Store' || s.sourceType === 'Site');
          const storeSites = sources.filter((s: any) => s.sourceType === 'Store');
          const vendors = sources.filter((s: any) => s.sourceType === 'Vendor');
          const onlines = sources.filter((s: any) => String(s.sourceType).toLowerCase().includes('online'));

          this.stores = [{ label: 'Select', value: null }, ...storeSites.map((s: any) => ({ label: s.sourceName, value: s.id || s.sourceId }))];
          this.vendorNames = vendors.map((s: any) => ({ label: s.sourceName, value: s.id || s.sourceId }));
          this.onlinePlatforms = onlines.map((s: any) => ({ label: s.sourceName, value: s.id || s.sourceId }));
          this.allPlatformsAndVendors = [...this.vendorNames, ...this.onlinePlatforms];
        }
      },
      error: (err) => console.error('Failed to load purchase sources:', err)
    });
  }

  patchForms() {
    // We will expand on this depending on how data is passed in 'mode'
    if (this.mode === 'stock-send') {
      this.stockSendForm.patchValue({
        sendFrom: this.stockSend.sendFrom || 'Store',
        site: this.stockSend.site || null,
        category: this.stockSend.category || null,
        transportationPlatform: this.transportation.platform || 'Fedex',
        trackingId: this.transportation.trackingId || '',
        shipmentDate: this.transportation.shipmentDate || null,
        deliveredDate: this.transportation.deliveredDate || null
      });
    } else if (this.mode === 'stock-return') {
      this.stockReturnForm.patchValue({
        returnFrom: this.stockReturn.returnFrom || 'Select',
        returnTo: this.stockReturn.returnTo || 'Store'
      });
    } else if (this.mode === 'add-purchase' || this.mode === 'update-purchase') {
      if (this.data && Object.keys(this.data).length > 0) {
        this.addPurchaseForm.patchValue({
          purchaseForCountry: this.data.purchaseForCountry || 'India',
          purchaseForStore: this.data.purchaseForStore || null,
          invoiceNo: this.data.invoiceNo || this.data?.purchase?.invoiceNumber || '',
          invoiceDate: (this.data.invoiceDate || this.data?.purchase?.invoiceDate) ? new Date(this.data.invoiceDate || this.data?.purchase?.invoiceDate) : null,
          vendorName: this.data.vendorName || '',
          purchaseVia: (this.data.purchaseVia === 'Select' || !this.data.purchaseVia) ? null : this.data.purchaseVia,
          platform: this.data.platform || this.data?.purchase?.purchaseFrom || null,
          isPreorder: this.isPreorderUpdate
        });

        const itemsArray = this.addPurchaseForm.get('purchaseItems') as FormArray;
        while (itemsArray.length !== 0) {
          itemsArray.removeAt(0);
        }

        const rawItems = this.data.itemsDetails || this.data.items || [];

        for (const item of rawItems) {
          const serialDetailsControls = [];
          let count = item.count || item.qty || 1;

          let existingSerials = item.serialDetails || [];
          for (let k = 0; k < count; k++) {
            const sd = existingSerials[k] || { serialNo: '', barcodeNo: '' };
            serialDetailsControls.push(this.fb.group({
              serialNo: [{ value: sd.serialNo || sd.serialNumber || '', disabled: this.isDeliveredUpdate }],
              barcodeNo: [{ value: sd.barcodeNo || sd.barcode || '', disabled: this.isDeliveredUpdate }]
            }));
          }

          const newGroup = this.fb.group({
            purchaseItemId: [item.purchaseItemId || item.id],
            itemName: [{ value: item.itemId || item.id, disabled: this.isPreorderUpdate || this.isDeliveredUpdate }, Validators.required],
            itemNameDisplay: [item.make && item.model ? `${item.itemName} - ${item.make} - ${item.model}` : item.itemName || ''],
            qty: [{ value: count, disabled: this.isPreorderUpdate || this.isDeliveredUpdate }, [Validators.required, Validators.min(1)]],
            cost: [{ value: item.unitPrice || item.rate || 0, disabled: this.isPreorderUpdate || this.isDeliveredUpdate }, Validators.required],
            gst: [{ value: item.gstPercent || item.gst || 0, disabled: this.isPreorderUpdate || this.isDeliveredUpdate }, Validators.required],
            total: [item.totalPricePerUnit || item.totalPrice || 0],
            link: [{ value: item.link || '', disabled: this.isPreorderUpdate || this.isDeliveredUpdate }],
            serialDetails: this.fb.array(serialDetailsControls),
            expanded: [false]
          });

          this.setupItemCalculations(newGroup);
          itemsArray.push(newGroup);
        }
        this.calculateFormTotal();

        if (this.isPreorderUpdate || this.isDeliveredUpdate) {
          this.addPurchaseForm.get('purchaseForCountry')?.disable();
          this.addPurchaseForm.get('purchaseForStore')?.disable();
          this.addPurchaseForm.get('vendorName')?.disable();
          this.addPurchaseForm.get('purchaseVia')?.disable();
          this.addPurchaseForm.get('platform')?.disable();
        }

        if (this.isDeliveredUpdate) {
          this.addPurchaseForm.get('invoiceNo')?.disable();
          this.addPurchaseForm.get('invoiceDate')?.disable();
        }

        if (this.isPreorderUpdate) {
          // Invoice No. is optional and editable when updating pre-order; Invoice Date stays locked
          this.addPurchaseForm.get('invoiceNo')?.enable();
          this.addPurchaseForm.get('invoiceDate')?.disable();
          this.addPurchaseForm.get('invoiceNo')?.clearValidators();
          this.addPurchaseForm.get('invoiceNo')?.updateValueAndValidity();
          this.addPurchaseForm.get('invoiceDate')?.clearValidators();
          this.addPurchaseForm.get('invoiceDate')?.updateValueAndValidity();
        }
      }
    }
  }

  get purchaseItemsControls() {
    return (this.addPurchaseForm.get('purchaseItems') as FormArray).controls;
  }

  getSerialDetailsControls(index: number) {
    const itemsArray = this.addPurchaseForm.get('purchaseItems') as FormArray;
    return (itemsArray.at(index).get('serialDetails') as FormArray).controls;
  }

  get stockSendItemsControls() {
    return (this.stockSendForm.get('stockSendItems') as FormArray).controls;
  }

  get stockSendProductsControls() {
    return (this.stockSendForm.get('stockSendProducts') as FormArray).controls;
  }

  get stockReturnItemsControls() {
    return (this.stockReturnForm.get('stockReturnItems') as FormArray).controls;
  }

  get stockReturnProductsControls() {
    return (this.stockReturnForm.get('stockReturnProducts') as FormArray).controls;
  }

  /** Shapes the raw ItemForIssue list into {label, value} objects for p-dropdown */
  get itemsDropdownOptions(): { label: string; value: any }[] {
    return this.itemsList.map(item => {
      const hasSerial = item.serialNumber && item.serialNumber.trim() !== '' && item.serialNumber !== null;
      const hasBarcode = item.barcode && item.barcode.trim() !== '' && item.barcode !== null;

      let identifier = '';
      if (hasSerial && hasBarcode) {
        identifier = `SNo: ${item.serialNumber} | Bc: ${item.barcode}`;
      } else if (hasSerial) {
        identifier = `SNo: ${item.serialNumber}`;
      } else if (hasBarcode) {
        identifier = `Bc: ${item.barcode}`;
      } else {
        identifier = `Bulk (Qty: ${item.quantity})`;
      }

      return {
        label: `${item.itemName} - ${item.make} - ${item.model} - ${identifier}`,
        value: { ...item, isBulk: !hasSerial && !hasBarcode, availableQty: item.quantity }
      };
    });
  }

  get purchaseItemsDropdownOptions(): { label: string; value: number }[] {
    return this.itemsList.map((item: any) => ({
      label: `${item.itemName} - ${item.make} - ${item.model}`,
      value: item.id || item.itemId || 0
    }));
  }

  onItemNameChange(event: any) {
    const selectedId = event.value;
    const selectedItemObj = this.itemsList.find((i: any) => (i.id || i.itemId) === selectedId);
    if (selectedItemObj) {
      this.newItem.link = (selectedItemObj as any).purchaseItemLink || '';
      this.newItem.serialNumberFlag = (selectedItemObj as any).serialNumberFlag || 'T';
      this.newItem.barcodeFlag = (selectedItemObj as any).barcodeFlag || 'T';
    } else {
      this.newItem.link = '';
      this.newItem.serialNumberFlag = 'T';
      this.newItem.barcodeFlag = 'T';
    }
  }

  calculateNewItemTotal() {
    if (this.newItem.qty && this.newItem.cost) {
      const qty = parseFloat(this.newItem.qty.toString()) || 0;
      const rate = parseFloat(this.newItem.cost.toString()) || 0;
      const gst = parseFloat(this.newItem.gst?.toString() || '0');
      const basePrice = qty * rate;
      const taxAmount = (basePrice * gst) / 100;
      this.newItem.total = (basePrice + taxAmount).toFixed(2);
    } else {
      this.newItem.total = null;
    }

    let qtyInt = parseInt(this.newItem.qty, 10);
    if (isNaN(qtyInt) || qtyInt < 1) {
      qtyInt = 1;
    }

    if (!this.newItem.serialDetails) {
      this.newItem.serialDetails = [{ serialNo: '', barcodeNo: '' }];
    }

    if (this.newItem.serialDetails.length < qtyInt) {
      for (let i = this.newItem.serialDetails.length; i < qtyInt; i++) {
        this.newItem.serialDetails.push({ serialNo: '', barcodeNo: '' });
      }
    } else if (this.newItem.serialDetails.length > qtyInt) {
      this.newItem.serialDetails.splice(qtyInt);
    }
  }

  calculateFormTotal() {
    let sum = 0;
    const itemsArray = this.addPurchaseForm.get('purchaseItems') as FormArray;

    itemsArray.controls.forEach(ctrl => {
      const total = parseFloat(ctrl.get('total')?.value) || 0;
      sum += total;
    });

    if (!this.data) this.data = {};
    this.data.totalPrice = sum.toFixed(2);
  }

  setupItemCalculations(group: FormGroup) {
    group.valueChanges.subscribe(val => {
      const qty = parseFloat(val.qty) || 0;
      const rate = parseFloat(val.cost) || 0;
      const gst = parseFloat(val.gst) || 0;
      const basePrice = qty * rate;
      const taxAmount = (basePrice * gst) / 100;
      const total = (basePrice + taxAmount).toFixed(2);

      if (group.get('total')?.value !== total) {
        group.patchValue({ total: total }, { emitEvent: false });
      }
      this.calculateFormTotal();
    });
  }

  addItemToInvoice() {
    this.newItemSubmitAttempted = true;
    if (this.validateNewItem()) {
      const selectedItemObj = this.itemsList.find((i: any) => (i.id || i.itemId) === this.newItem.itemName);
      let displayItemName = '';

      if (selectedItemObj) {
        displayItemName = selectedItemObj.make && selectedItemObj.model
          ? `${selectedItemObj.itemName} - ${selectedItemObj.make} - ${selectedItemObj.model}`
          : selectedItemObj.itemName;
      } else {
        displayItemName = this.newItem.itemName;
      }

      const itemsArray = this.addPurchaseForm.get('purchaseItems') as FormArray;

      const parsedQty = parseInt(this.newItem.qty, 10) || 1;
      const serialDetailsControls = [];
      for (let k = 0; k < parsedQty; k++) {
        const sd = this.newItem.serialDetails[k] || { serialNo: '', barcodeNo: '' };
        serialDetailsControls.push(this.fb.group({
          serialNo: [sd.serialNo],
          barcodeNo: [sd.barcodeNo]
        }));
      }

      const newGroup = this.fb.group({
        itemName: [this.newItem.itemName, Validators.required],
        itemNameDisplay: [displayItemName],
        qty: [this.newItem.qty, [Validators.required, Validators.min(1)]],
        cost: [this.newItem.cost, Validators.required],
        gst: [this.newItem.gst, Validators.required],
        total: [this.newItem.total],
        link: [this.newItem.link],
        serialNumberFlag: [this.newItem.serialNumberFlag || 'T'],
        barcodeFlag: [this.newItem.barcodeFlag || 'T'],
        serialDetails: this.fb.array(serialDetailsControls),
        expanded: [false]
      });

      this.setupItemCalculations(newGroup);

      itemsArray.push(newGroup);
      this.calculateFormTotal();

      this.newItemSubmitAttempted = false;
      this.newItem = {
        itemName: null,
        qty: null,
        cost: null,
        gst: null,
        total: null,
        link: '',
        serialNumberFlag: 'T',
        barcodeFlag: 'T',
        serialDetails: [{ serialNo: '', barcodeNo: '' }]
      };
    }
  }

  isValidUrl(url: string): boolean {
    if (!url || !url.trim()) return true; // Empty is allowed
    try {
      const testUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      new URL(testUrl);
      return true;
    } catch {
      return false;
    }
  }

  preventNegative(event: KeyboardEvent) {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  }

  validateNewItem(): boolean {
    if (!this.newItem.itemName) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select an item name.' });
      return false;
    }
    if (!this.newItem.qty || this.newItem.qty < 1) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please enter a valid quantity.' });
      return false;
    }
    if (this.newItem.cost === null || this.newItem.cost === undefined || this.newItem.cost === '' || this.newItem.cost < 0) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please enter the cost per unit.' });
      return false;
    }
    if (this.newItem.gst === null || this.newItem.gst === undefined || this.newItem.gst === '') {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please enter the GST percentage (use 0 if not applicable).' });
      return false;
    }
    if (this.newItem.link && !this.isValidUrl(this.newItem.link)) {
      this.messageService.add({ severity: 'error', summary: 'Invalid URL', detail: 'Please enter a valid link.' });
      return false;
    }

    // Duplicate Check (only if flags require serial/barcode)
    const requireSerial = this.newItem.serialNumberFlag !== 'F';
    const requireBarcode = this.newItem.barcodeFlag !== 'F';

    const currentSerials = requireSerial
      ? this.newItem.serialDetails.map((sd: any) => sd.serialNo?.trim()).filter((s: string) => s)
      : [];
    const currentBarcodes = requireBarcode
      ? this.newItem.serialDetails.map((sd: any) => sd.barcodeNo?.trim()).filter((b: string) => b)
      : [];

    const expectedQty = parseInt(this.newItem.qty, 10) || 1;
    const isPreorder = this.addPurchaseForm.get('isPreorder')?.value;

    if (!isPreorder) {
      if (requireSerial && currentSerials.length < expectedQty) {
        return false;
      }

      if (requireBarcode && currentBarcodes.length < expectedQty) {
        return false;
      }
    }

    // Internal duplicates in current entry
    if ((requireSerial && new Set(currentSerials).size !== currentSerials.length) ||
      (requireBarcode && new Set(currentBarcodes).size !== currentBarcodes.length)) {
      this.messageService.add({ severity: 'error', summary: 'Duplicate Entry', detail: 'same numbers entered' });
      return false;
    }

    // Check against existing items in the invoice
    const itemsArray = this.addPurchaseForm?.get('purchaseItems') as FormArray;
    if (itemsArray && (requireSerial || requireBarcode)) {
      for (const group of itemsArray.controls) {
        const existingSerials = requireSerial
          ? (group.get('serialDetails') as FormArray).value.map((sd: any) => sd.serialNo?.trim()).filter((s: string) => s)
          : [];
        const existingBarcodes = requireBarcode
          ? (group.get('serialDetails') as FormArray).value.map((sd: any) => sd.barcodeNo?.trim()).filter((b: string) => b)
          : [];

        if ((requireSerial && currentSerials.some((s: string) => existingSerials.includes(s))) ||
          (requireBarcode && currentBarcodes.some((b: string) => existingBarcodes.includes(b)))) {
          this.messageService.add({ severity: 'error', summary: 'Duplicate Entry', detail: 'same numbers entered' });
          return false;
        }
      }
    }

    return true;
  }

  removeItemFromInvoice(index: number) {
    const itemsArray = this.addPurchaseForm.get('purchaseItems') as FormArray;
    itemsArray.removeAt(index);
    this.calculateFormTotal();
  }

  toggleExpanded(index: number) {
    const itemsArray = this.addPurchaseForm.get('purchaseItems') as FormArray;
    const itemGroup = itemsArray.at(index);
    if (itemGroup) {
      itemGroup.patchValue({ expanded: !itemGroup.get('expanded')?.value });
    }
  }

  // ITEMS LIST from API for Stock Send/Return
  loadStockSendItemsDropdown(storeId?: number) {
    this.inventoryService.getItemsForIssue(storeId).subscribe({
      next: (response) => {
        if (response?.data) {
          this.itemsList = response.data;
        } else {
          this.itemsList = [];
        }
      },
      error: (error: any) => {
        console.error('Failed to load items for issue', error);
        this.itemsList = [];
      }
    });
  }

  // ITEMS LIST from API for Purchase Invoice
  loadPurchaseItemsDropdown() {
    this.itemsService.getItems(1, 1000).subscribe({
      next: (response: any) => {
        if (response && response.status === 'Success' && response.data) {
          // Map to match the options structure needed
          this.itemsList = response.data;
        }
      },
      error: (error: any) => console.error('Failed to load items list', error)
    });
  }

  // PRODUCTS LIST from API
  loadProductsDropdown() {
    this.inventoryService.getProductsForIssue().subscribe({
      next: (response) => {
        if (response?.data) {
          this.productsList = response.data;
        }
      },
      error: (error: any) => {
        console.error('Failed to load products for issue', error);
      }
    });
  }

  /** Shapes the raw ProductForIssue list into {label, value} objects for p-dropdown */
  get productsDropdownOptions(): { label: string; value: any }[] {
    return this.productsList.map(prod => {
      const hasSerial = prod.serialNumber && prod.serialNumber.trim() !== '' && prod.serialNumber !== null;
      const hasBarcode = prod.barCode && prod.barCode.trim() !== '' && prod.barCode !== null;

      let identifier = '';
      if (hasSerial && hasBarcode) {
        identifier = `SNo: ${prod.serialNumber} | Bc: ${prod.barCode}`;
      } else if (hasSerial) {
        identifier = `SNo: ${prod.serialNumber}`;
      } else if (hasBarcode) {
        identifier = `Bc: ${prod.barCode}`;
      } else {
        identifier = `Qty: 1`; // Fallback, though user stated they always have serial/barcode
      }

      return {
        label: `${prod.productName} - ${prod.make} - ${prod.model} - ${identifier}`,
        value: { ...prod, isBulk: false }
      };
    });
  }

  onStockItemSelect(event: any) {
    const selected = event.value;
    if (selected) {
      if (!selected.isBulk) {
        this.newStockItem.qty = 1;
      } else {
        this.newStockItem.qty = 1; // Default to 1 for bulk too, but user can change
      }
    }
  }

  onStockProductSelect(event: any) {
    const selected = event.value;
    if (selected) {
      this.newStockProduct.qty = 1;
    }
  }

  get returnItemsDropdownOptions(): { label: string; value: any }[] {
    return this.returnableItemsList.map(item => {
      const hasSerial = item.serialNumber && item.serialNumber.trim() !== '' && item.serialNumber !== null;
      const hasBarcode = item.barcode && item.barcode.trim() !== '' && item.barcode !== null;

      let identifier = '';
      if (hasSerial && hasBarcode) {
        identifier = `SNo: ${item.serialNumber} | Bc: ${item.barcode}`;
      } else if (hasSerial) {
        identifier = `SNo: ${item.serialNumber}`;
      } else if (hasBarcode) {
        identifier = `Bc: ${item.barcode}`;
      } else {
        identifier = `Qty: ${item.quantity}`;
      }

      return {
        label: `${item.itemName} - ${item.make} - ${item.model} - ${identifier}`,
        value: { ...item, isBulk: !hasSerial && !hasBarcode }
      };
    });
  }

  get returnProductsDropdownOptions(): { label: string; value: any }[] {
    return this.returnableProductsList.map(prod => {
      const hasSerial = prod.serialNumber && prod.serialNumber.trim() !== '' && prod.serialNumber !== null;
      const hasBarcode = prod.barCode && prod.barCode.trim() !== '' && prod.barCode !== null;

      let identifier = '';
      if (hasSerial && hasBarcode) {
        identifier = `SNo: ${prod.serialNumber} | Bc: ${prod.barCode}`;
      } else if (hasSerial) {
        identifier = `SNo: ${prod.serialNumber}`;
      } else if (hasBarcode) {
        identifier = `Bc: ${prod.barCode}`;
      } else {
        identifier = `Qty: ${prod.quantity}`;
      }

      return {
        label: `${prod.productName} - ${prod.make} - ${prod.model} - ${identifier}`,
        value: { ...prod, isBulk: !hasSerial && !hasBarcode }
      };
    });
  }

  onReturnItemSelect(event: any) {
    const selected = event.value;
    if (selected) {
      if (!selected.isBulk) {
        this.newReturnItem.qty = 1;
      } else {
        this.newReturnItem.qty = 1;
      }
    }
  }

  onReturnProductSelect(event: any) {
    const selected = event.value;
    if (selected) {
      if (!selected.isBulk) {
        this.newReturnProduct.qty = 1;
      } else {
        this.newReturnProduct.qty = 1;
      }
    }
  }

  get conditionOptions(): { label: string; value: string }[] {
    return this.returnConditions.map(c => ({
      label: c.charAt(0).toUpperCase() + c.slice(1).toLowerCase(),
      value: c
    }));
  }

  // VIEW STOCK SEND STATE
  viewStockSendData: any = {};
  isEditingIssueStatus: boolean = false;

  onEditIssueStatus() {
    this.isEditingIssueStatus = true;
    this.loadStockSendDropdownsForEdit();
  }

  loadStockSendDropdownsForEdit() {
    // Only load if not already loaded
    if (this.shippingPlatforms.length === 0) {
      this.metadataService.getDropdownByTypeName('Inv_ShippingFlatform').subscribe({
        next: (res: MetadataResponse[]) => {
          const metadataArray: MetadataItem[] = res?.[0]?.metadata || [];
          this.shippingPlatforms = metadataArray.map((item: MetadataItem) => ({
            label: item.value,
            value: item.keyId
          }));

          // Link the selected platform ID based on the string value if necessary
          if (this.viewStockSendData && !this.viewStockSendData.transportationPlatform && this.viewStockSendData.transportation) {
            const match = this.shippingPlatforms.find(p => p.label.toLowerCase() === this.viewStockSendData.transportation.toLowerCase());
            if (match) {
              this.viewStockSendData.transportationPlatform = match.value;
            }
          }
        }
      });
    }

    if (this.issueStatusOptions.length === 0) {
      // These are static, but good to ensure they are available
      this.issueStatusOptions = [
        { label: 'Issued', value: 'ISSUED' },
        { label: 'Delivered', value: 'DELIVERED' }
      ];
    }
  }

  updateIssueStatus() {
    const shipmentDateStr = this.formatDateForPayload(this.viewStockSendData.shipmentDateObj);
    const deliveredDateStr = this.formatDateForPayload(this.viewStockSendData.deliveredDateObj);

    // Date Validation
    if (this.viewStockSendData.status === 'DELIVERED') {
      if (!this.viewStockSendData.deliveredDateObj) {
        this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Delivered date is required for DELIVERED status.' });
        return;
      }
      if (this.viewStockSendData.shipmentDateObj && this.viewStockSendData.deliveredDateObj < this.viewStockSendData.shipmentDateObj) {
        this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Delivered date cannot be before shipment date.' });
        return;
      }
    }

    const now = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const modifiedTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const updatePayload = {
      status: this.viewStockSendData.status,
      transportationId: this.viewStockSendData.transportationPlatform,
      trackingId: this.viewStockSendData.trackingId,
      shipmentDate: shipmentDateStr,
      deliveredDate: deliveredDateStr,
      modifiedBy: this.userId,
      modifiedTime: modifiedTime
    };

    const issueId = this.data?.header?.id || this.data?.id;

    if (!issueId) {
      this.messageService?.add({ severity: 'error', summary: 'Error', detail: 'Issue ID not found' });
      return;
    }

    // Emit to parent to handle API call and refresh
    this.submit.emit({
      isUpdateIssueStatus: true,
      issueId: issueId,
      payload: updatePayload
    });

    // this.isEditingIssueStatus = false;
  }

  private formatDateForPayload(date: Date | null | string): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // VIEW PURCHASE METHODS
  initViewItems() {
    let rawItems: any[] = [];
    if (this.data?.items) {
      rawItems = this.data.items;
    } else if (this.data?.itemsDetails) {
      rawItems = this.data.itemsDetails;
    }

    this.viewPurchaseItems = [];
    for (const item of rawItems) {
      const sFlag: string = (item.serialNumberFlag || '');
      const bFlag: string = (item.barcodeFlag || '');
      const requiresSerial = sFlag !== 'F';
      const requiresBarcode = bFlag !== 'F';
      const isBulk = sFlag === 'F' && bFlag === 'F';

      const serialDetails = item.serialDetails || [];

      if (isBulk) {
        // Bulk items (F & F) — group by status
        const groups: { [key: string]: any[] } = {};

        for (const sd of serialDetails) {
          const status = String(sd.status || item.status || (this.isPreorderInvoice ? 'PREORDER' : 'DELIVERED')).toUpperCase().replace(/[_\s-]/g, '');
          const normalizedStatus = status === 'PREORDER' || status === 'PREORDERED' ? 'PREORDER' : status;
          if (!groups[normalizedStatus]) groups[normalizedStatus] = [];
          groups[normalizedStatus].push(sd);
        }

        const statuses = Object.keys(groups);
        if (statuses.length === 0) {
          // Fallback if no serialDetails (shouldn't happen with current backend logic but safe to have)
          this.viewPurchaseItems.push({
            ...item,
            purchaseItemId: item.purchaseItemId || item.id || item.itemId,
            allPurchaseItemIds: [],
            count: item.count || 1,
            actionQty: 0,
            serialNo: null,
            barcodeNo: null,
            serialNumberFlag: sFlag,
            barcodeFlag: bFlag,
            requiresSerial: false,
            requiresBarcode: false,
            status: String(item.status || (this.isPreorderInvoice ? 'PREORDER' : 'DELIVERED')).toUpperCase(),
            originalStatus: String(item.status || (this.isPreorderInvoice ? 'PREORDER' : 'DELIVERED')).toUpperCase(),
            returnReason: item.returnReason || '',
            originalReturnReason: item.returnReason || ''
          });
        } else {
          for (const status of statuses) {
            const groupDetails = groups[status];
            const allIds = groupDetails.map((sd: any) => sd.purchaseItemId || sd.id);
            this.viewPurchaseItems.push({
              ...item,
              purchaseItemId: allIds[0],
              allPurchaseItemIds: allIds,
              count: allIds.length,
              actionQty: 0,
              serialNo: null,
              barcodeNo: null,
              serialNumberFlag: sFlag,
              barcodeFlag: bFlag,
              requiresSerial: false,
              requiresBarcode: false,
              status: status,
              originalStatus: status,
              returnReason: groupDetails[0].returnReason || item.returnReason || '',
              originalReturnReason: groupDetails[0].returnReason || item.returnReason || ''
            });
          }
        }
      } else {
        // Serialized items (at least one 'T') — expand into individual rows
        for (const sd of serialDetails) {
          this.viewPurchaseItems.push({
            ...item,
            purchaseItemId: sd.purchaseItemId || sd.id,
            count: 1,
            serialNo: sd.serialNumber || '-',
            barcodeNo: sd.barcode || '-',
            serialNumberFlag: sFlag,
            barcodeFlag: bFlag,
            requiresSerial: requiresSerial,
            requiresBarcode: requiresBarcode,
            status: sd.status !== undefined && sd.status !== null ? String(sd.status).toUpperCase() : String(item.status || 'DELIVERED').toUpperCase(),
            originalStatus: sd.status !== undefined && sd.status !== null ? String(sd.status).toUpperCase() : String(item.status || 'DELIVERED').toUpperCase(),
            returnReason: sd.returnReason || item.returnReason || '',
            originalReturnReason: sd.returnReason || item.returnReason || ''
          });
        }

        // Handle potential remaining count not covered by serialDetails
        let totalCount = 1;
        if (item.count !== undefined && item.count !== null) {
          totalCount = parseInt(item.count, 10);
        } else if (item.qty !== undefined && item.qty !== null) {
          totalCount = parseInt(item.qty, 10);
        }
        if (isNaN(totalCount) || totalCount < 1) totalCount = 1;

        if (totalCount > serialDetails.length) {
          const remaining = totalCount - serialDetails.length;
          for (let i = 0; i < remaining; i++) {
            this.viewPurchaseItems.push({
              ...item,
              purchaseItemId: item.purchaseItemId || item.id || item.itemId,
              count: 1,
              serialNo: '-',
              barcodeNo: '-',
              serialNumberFlag: sFlag,
              barcodeFlag: bFlag,
              requiresSerial: requiresSerial,
              requiresBarcode: requiresBarcode,
              status: String(item.status || (this.isPreorderInvoice ? 'PREORDER' : 'DELIVERED')).toUpperCase(),
              originalStatus: String(item.status || (this.isPreorderInvoice ? 'PREORDER' : 'DELIVERED')).toUpperCase(),
              returnReason: item.returnReason || '',
              originalReturnReason: item.returnReason || ''
            });
          }
        }
      }
    }
  }

  getItemStatusColor(status: string): string {
    const s = (status || '').toLowerCase().replace(/[_\s-]/g, '');
    if (s === 'delivered') return '#53BF8B'; // Green
    if (s === 'issued') return '#000000';
    if (s === 'returned') return '#ED3237'; // Red
    if (s === 'intransit') return '#ED3237';
    if (s === 'preorder' || s === 'preordered') return '#000000'; // Black
    return '#FF9800';
  }

  enableBulkEdit() {
    this.isBulkEditingStatus = true;
    this.isPreorderSubmitAttempted = false;
    this.isReturnSubmitAttempted = false;

    // Invoice Number editing for preorder updates
    if (this.isPreorderInvoice) {
      this.data.newInvoiceNumber = this.data?.purchase?.invoiceNumber || this.data?.invoiceNumber || '';
    }

    for (const item of this.viewPurchaseItems) {
      item.newStatus = String(item.status).toUpperCase();
      item.newSerialNumber = item.serialNo !== '-' && item.serialNo !== null ? item.serialNo : '';
      item.newBarcode = item.barcodeNo !== '-' && item.barcodeNo !== null ? item.barcodeNo : '';
      item.returnReason = item.returnReason || '';
      item.actionQty = 0;
    }
  }

  isItemBeingFilled(item: ViewPurchaseItem): boolean {
    const isBulk = item.serialNumberFlag === 'F' && item.barcodeFlag === 'F';
    if (isBulk) return (item.actionQty || 0) > 0;
    return !!(item.newSerialNumber?.trim() || item.newBarcode?.trim());
  }

  getFilteredStatusOptions(item: ViewPurchaseItem): any[] {
    const isAlreadyDelivered = String(item.status).toUpperCase() === 'DELIVERED';
    const hasSerials = !!(item.serialNo && item.serialNo !== '-') || !!(item.barcodeNo && item.barcodeNo !== '-');

    if (isAlreadyDelivered || hasSerials) {
      return this.statusOptions.filter(opt => opt.value !== 'PREORDER');
    }
    return this.statusOptions;
  }

  onTrackingInfoChange(item: ViewPurchaseItem): void {
    const hasTrackingInfo = !!(item.newSerialNumber?.trim() || item.newBarcode?.trim());
    const originalStatus = String(item.status).toUpperCase().replace(/[_\s-]/g, '');

    if (hasTrackingInfo) {
      if (originalStatus === 'PREORDER' || originalStatus === 'PREORDERED') {
        item.newStatus = 'DELIVERED';
      }
    } else {
      // Revert to PREORDER only if it was originally a PREORDER and not currently RETURNED
      if ((originalStatus === 'PREORDER' || originalStatus === 'PREORDERED') && item.newStatus !== 'RETURNED') {
        item.newStatus = 'PREORDER';
      }
    }
  }

  saveBulkStatus() {
    this.isPreorderSubmitAttempted = true;
    this.isReturnSubmitAttempted = true;

    let hasErrors = false;
    const itemsBeingReturned = this.viewPurchaseItems.filter(i => i.newStatus?.toString().toUpperCase() === 'RETURNED' && i.status?.toString().toUpperCase() !== 'RETURNED');
    const itemsBeingFilled = this.viewPurchaseItems.filter(i => this.isItemBeingFilled(i));

    // 1. Validate Invoice Number (if applicable)
    if (this.isPreorderInvoice) {
      const invoiceNumberChanged = this.data.newInvoiceNumber !== (this.data?.purchase?.invoiceNumber || this.data?.invoiceNumber);
      if ((itemsBeingFilled.length > 0 || invoiceNumberChanged) && (!this.data.newInvoiceNumber || !this.data.newInvoiceNumber.trim())) {
        const existing = this.data?.purchase?.invoiceNumber || this.data?.invoiceNumber;
        if (existing) {
          this.data.newInvoiceNumber = existing;
        } else {
          hasErrors = true;
        }
      }
    }

    // 2. Validate Returns (Reason and Quantity)
    const missingReasons = itemsBeingReturned.some(i => !i.returnReason || !i.returnReason.trim());
    if (missingReasons) hasErrors = true;

    const itemsBeingFulfilled = this.viewPurchaseItems.filter(i => {
      const curStatus = String(i.status || '').toUpperCase().replace(/[_\s-]/g, '');
      const nextStatus = String(i.newStatus || '').toUpperCase().replace(/[_\s-]/g, '');
      return (curStatus === 'PREORDER' || curStatus === 'PREORDERED') && nextStatus === 'DELIVERED';
    });

    const invalidReturnQty = itemsBeingReturned.some(i => {
      const isBulk = i.serialNumberFlag === 'F' && i.barcodeFlag === 'F';
      return isBulk && (i.actionQty === undefined || i.actionQty < 1 || i.actionQty > (i.count || 0));
    });
    if (invalidReturnQty) hasErrors = true;

    const invalidFulfillQty = itemsBeingFulfilled.some(i => {
      const isBulk = i.serialNumberFlag === 'F' && i.barcodeFlag === 'F';
      return isBulk && (i.actionQty === undefined || i.actionQty < 1 || i.actionQty > (i.count || 0));
    });
    if (invalidFulfillQty) hasErrors = true;

    // 3. Validate Serial/Barcode updates (for preorders OR existing item edits)
    // Only validate if user actually touched these fields or is marking them delivered
    const itemsWithTrackingChanges = this.viewPurchaseItems.filter(i => {
      const oldSerial = (i.serialNo !== '-' && i.serialNo !== null) ? i.serialNo : '';
      const oldBarcode = (i.barcodeNo !== '-' && i.barcodeNo !== null) ? i.barcodeNo : '';
      const curStatus = String(i.status || '').toUpperCase().replace(/[_\s-]/g, '');
      const nextStatus = String(i.newStatus || '').toUpperCase().replace(/[_\s-]/g, '');
      return (i.newSerialNumber !== undefined && i.newSerialNumber !== oldSerial) ||
        (i.newBarcode !== undefined && i.newBarcode !== oldBarcode) ||
        ((curStatus === 'PREORDER' || curStatus === 'PREORDERED') && nextStatus === 'DELIVERED');
    });

    const missingSerials = itemsWithTrackingChanges.some(i => i.requiresSerial && (!i.newSerialNumber || !i.newSerialNumber.trim()));
    if (missingSerials) hasErrors = true;

    const missingBarcodes = itemsWithTrackingChanges.some(i => i.requiresBarcode && (!i.newBarcode || !i.newBarcode.trim()));
    if (missingBarcodes) hasErrors = true;


    if (hasErrors) {
      this.messageService.clear();
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fill all required fields before saving.' });
      return;
    }

    const modifiedItems = this.viewPurchaseItems.filter(item => {
      const isBulk = item.serialNumberFlag === 'F' && item.barcodeFlag === 'F';
      const statusChanged = item.newStatus && item.newStatus !== item.originalStatus;
      const reasonChanged = item.returnReason !== item.originalReturnReason;

      if (isBulk && !this.isPreorderInvoice && item.newStatus === 'RETURNED' && item.originalStatus !== 'RETURNED') {
        return (item.actionQty || 0) > 0;
      }
      if (isBulk && this.isPreorderInvoice) {
        // If transitioning from PREORDER to DELIVERED, we need actionQty > 0
        const curStatus = String(item.status || '').toUpperCase().replace(/[_\s-]/g, '');
        const nextStatus = String(item.newStatus || '').toUpperCase().replace(/[_\s-]/g, '');
        if ((curStatus === 'PREORDER' || curStatus === 'PREORDERED') && nextStatus === 'DELIVERED') {
          return (item.actionQty || 0) > 0;
        }
        return statusChanged || reasonChanged;
      }

      let serialChanged = false;
      let barcodeChanged = false;

      const oldSerial = (item.serialNo !== '-' && item.serialNo !== null) ? item.serialNo : '';
      const newSerial = item.newSerialNumber || '';
      serialChanged = oldSerial !== newSerial && !!newSerial;

      const oldBarcode = (item.barcodeNo !== '-' && item.barcodeNo !== null) ? item.barcodeNo : '';
      const newBarcode = item.newBarcode || '';
      barcodeChanged = oldBarcode !== newBarcode && !!newBarcode;

      const isModified = statusChanged || serialChanged || barcodeChanged || reasonChanged;
      if (isModified) {
        item.isModified = true;
      }
      return isModified;
    });

    const invoiceNumberChanged = this.isPreorderInvoice &&
      this.data.newInvoiceNumber !== (this.data?.purchase?.invoiceNumber || this.data?.invoiceNumber);

    if (!invoiceNumberChanged && modifiedItems.length === 0) {
      this.isBulkEditingStatus = false;
      this.isPreorderSubmitAttempted = false;
      this.isReturnSubmitAttempted = false;
      return;
    }

    const now = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const modifiedTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const purchaseId = this.data?.purchase?.id || this.data?.purchaseId || this.data?.id;

    const payload: any = {
      purchaseId: purchaseId,
      modifiedBy: this.userId,
      modifiedTime: modifiedTime
    };

    if (invoiceNumberChanged) {
      payload.invoiceNumber = this.data.newInvoiceNumber;
    }

    const payloadItems: any[] = [];
    const itemsToProcess = this.isPreorderInvoice ? modifiedItems : modifiedItems;

    itemsToProcess.forEach(item => {
      const isBulk = item.serialNumberFlag === 'F' && item.barcodeFlag === 'F';

      if (this.isPreorderInvoice) {
        // Preorder update: Move only filled units to DELIVERED
        if (isBulk) {
          const qtyToDeliver = item.actionQty || 0;
          const idsToDeliver = (item.allPurchaseItemIds || []).slice(0, qtyToDeliver);
          idsToDeliver.forEach(id => {
            payloadItems.push({
              purchaseItemId: id,
              status: 'DELIVERED',
              serialNumber: null,
              barcode: null
            });
          });
        } else {
          payloadItems.push({
            purchaseItemId: item.purchaseItemId || item.id,
            status: 'DELIVERED',
            serialNumber: item.newSerialNumber || null,
            barcode: item.newBarcode || null
          });
        }
      } else {
        // Delivered update
        if (isBulk && item.newStatus === 'RETURNED') {
          const idsToReturn = (item.allPurchaseItemIds || []).slice(0, item.actionQty);
          idsToReturn.forEach(id => {
            payloadItems.push({
              purchaseItemId: id,
              status: 'RETURNED',
              returnReason: item.returnReason || '',
              serialNumber: null,
              barcode: null
            });
          });
        } else if (isBulk) {
          const ids = item.allPurchaseItemIds || [item.purchaseItemId];
          ids.forEach(id => {
            payloadItems.push({
              purchaseItemId: id,
              status: (String(item.newStatus).toUpperCase().replace(/[_\s-]/g, '') === 'PREORDER') ? 'DELIVERED' : item.newStatus,
              serialNumber: null,
              barcode: null
            });
          });
        } else {
          // Serialized unit update
          payloadItems.push({
            purchaseItemId: item.purchaseItemId || item.id,
            status: (String(item.newStatus).toUpperCase().replace(/[_\s-]/g, '') === 'PREORDER') ? 'DELIVERED' : item.newStatus,
            serialNumber: (item.newSerialNumber || item.serialNo !== '-' ? item.newSerialNumber || item.serialNo : null),
            barcode: (item.newBarcode || item.barcodeNo !== '-' ? item.newBarcode || item.barcodeNo : null),
            returnReason: item.newStatus === 'RETURNED' ? (item.returnReason || '') : undefined
          });
        }
      }
    });

    payload.items = payloadItems;
    this.submit.emit({ isStatusUpdate: true, payload: payload });
  }

  initViewStockSendData() {
    const header = this.data?.header || {};
    const items = this.data?.items || [];
    const products = this.data?.products || [];

    this.viewStockSendData = {
      sendFrom: header.issuedFrom || '',
      sendTo: header.issuedTo || '',
      category: header.category || '',
      billing: header.billing || '',
      transportation: header.transportation || '',
      transportationPlatform: header.transportationId || null,
      trackingId: header.trackingId || '',
      shipmentDate: header.shipmentDate || '',
      shipmentDateObj: header.shipmentDate ? new Date(header.shipmentDate) : null,
      deliveredDate: header.deliveredDate || '',
      deliveredDateObj: header.deliveredDate ? new Date(header.deliveredDate) : null,
      status: header.status || '',
      items: items.map((item: any) => ({
        id: item.issueItemId || item.id,
        name: item.itemName,
        qty: item.quantity,
        unit: item.units,
        billingStatus: item.billingStatus,
        serialNumber: item.serialNumber,
        barcode: item.barcode,
        assignSite: item.assignSite || header.issuedTo || '—',
        make: item.make || '',
        model: item.model || ''
      })),
      products: products.map((prod: any) => ({
        id: prod.issueProductId || prod.id,
        name: prod.productName,
        qty: prod.quantity,
        unit: prod.units,
        billingStatus: prod.billingStatus,
        assignSite: prod.assignSite || header.issuedTo || '—',
        expanded: false,
        make: prod.make || '',
        model: prod.model || '',
        ingredients: (prod.hardware || []).map((hw: any) => ({
          name: hw.itemName,
          count: hw.itemsQuantity,
          unit: hw.units,
          make: hw.make || '',
          model: hw.model || ''
        }))
      }))
    };
  }


  getStatusClass(status: string): string {
    if (!status) return '';
    const lower = status.toLowerCase().replace(/[_\s-]/g, '');
    if (lower === 'delivered') return 'status-badge-green';
    if (lower === 'returned') return 'status-badge-red';
    if (lower === 'issued') return 'status-badge-black';
    if (lower === 'preorder' || lower === 'preordered') return 'status-badge-black';
    return 'status-badge-gray';
  }

  // CLOSING STATEMENT STATE
  closingStatementData: any = {
    itemName: '',
    availableCount: 0,
    startDate: '',
    endDate: '',
    transactions: []
  };

  fetchClosingStatement() {
    const itemId = this.data.itemId;
    const formatStrictDate = (dString: string | undefined | null): string => {
      if (!dString) return '';

      let year = '2000', month = '01', day = '01';

      if (typeof dString === 'string') {
        const trimmed = dString.trim();

        // Match YYYY-MM-DD HH:mm:ss exactly (Stock tab uses this)
        const fullMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (fullMatch) {
          return trimmed;
        }

        // Match YYYY-MM-DD
        const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (ymdMatch) {
          year = ymdMatch[1];
          month = ymdMatch[2];
          day = ymdMatch[3];
        } else {
          // Handle DD/MM/YYYY or MM/DD/YYYY formats
          const parts = trimmed.split(' ')[0].split('/');
          if (parts.length === 3) {
            const p0 = parts[0].padStart(2, '0');
            const p1 = parts[1].padStart(2, '0');
            const p2 = parts[2].length === 2 ? `20${parts[2]}` : parts[2];

            if (parseInt(p1, 10) > 12) {
              year = p2; month = p0; day = p1;
            } else {
              year = p2; month = p1; day = p0;
            }
          } else {
            const d = new Date(dString);
            if (!isNaN(d.getTime())) {
              year = String(d.getFullYear());
              month = String(d.getMonth() + 1).padStart(2, '0');
              day = String(d.getDate()).padStart(2, '0');
            }
          }
        }
      }

      // Construct strict datetime format (YYYY-MM-DD HH:mm:ss) required by the API
      return `${year}-${month}-${day} 00:00:00`;
    };

    const formattedStartDate = formatStrictDate(this.data.startDate);
    const formattedEndDate = formatStrictDate(this.data.endDate);

    const storeId = this.data.storeId;

    this.inventoryService.getClosingStatement(itemId, formattedStartDate, formattedEndDate, storeId).subscribe({
      next: (res: ClosingStatementResponse) => {
        if (res?.status === 'Success' && res?.data) {
          const header = res.data.header;
          const details = res.data.details || [];

          // Format Header dates for display (DD/MM/YYYY)
          const formatDateDisplay = (dateStr: string) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          };

          // Transform and Group by Date
          const groupedTransactions: any[] = [];
          const groups: { [key: string]: any } = {};

          details.forEach((item: ClosingStatementDetail) => {
            const dateKey = formatDateDisplay(item.date);
            if (!groups[dateKey]) {
              groups[dateKey] = {
                date: dateKey,
                availableCount: item.availableCount,
                records: []
              };
              groupedTransactions.push(groups[dateKey]);
            }

            // Map Action to Type for Badge Styling
            let mappedType = '';
            switch (item.action?.toUpperCase()) {
              case 'PURCHASE': mappedType = 'Purchased'; break;
              case 'ISSUE': mappedType = 'Issued'; break;
              case 'RETURN': mappedType = 'Returned'; break;
              case 'USE': mappedType = 'Used'; break;
              default: mappedType = item.action || '';
            }

            groups[dateKey].records.push({
              from: item.from,
              to: item.to,
              status: item.status,
              count: item.count,
              type: mappedType
            });
          });

          this.closingStatementData = {
            itemName: header.itemName,
            availableCount: header.availableCount,
            startDate: formatDateDisplay(header.startDate),
            endDate: formatDateDisplay(header.endDate),
            transactions: groupedTransactions
          };
        }
      },
      error: (err) => {
        console.error('Error fetching closing statement', err);
        // Fallback or error message could go here
      }
    });
  }

  addStockItem() {
    this.isItemEntryAttempted = true;
    if (this.newStockItem.name && this.newStockItem.qty && this.newStockItem.billingStatus) {
      const selectedItemObj = this.newStockItem.name;
      const itemsArray = this.stockSendForm.get('stockSendItems') as FormArray;

      // Uniqueness check
      const alreadyAdded = itemsArray.controls.some(ctrl => {
        const sameId = ctrl.get('itemId')?.value === (selectedItemObj.id || selectedItemObj.itemId);
        if (selectedItemObj.isBulk) {
          return sameId && !ctrl.get('serialNumber')?.value;
        } else {
          return sameId && ctrl.get('serialNumber')?.value === selectedItemObj.serialNumber;
        }
      });

      if (alreadyAdded) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: selectedItemObj.isBulk ? 'This bulk item is already added to the list.' : 'This item with this serial number is already added.'
        });
        return;
      }

      let finalQty = this.newStockItem.qty;
      if (!selectedItemObj.isBulk) {
        finalQty = 1;
      } else if (selectedItemObj.availableQty && finalQty > selectedItemObj.availableQty) {
        this.messageService.add({ severity: 'warn', summary: 'Quantity Warning', detail: `Only ${selectedItemObj.availableQty} available.` });
        return;
        // finalQty = selectedItemObj.availableQty;
      }

      const displayItemName = `${selectedItemObj.itemName} - ${selectedItemObj.make} - ${selectedItemObj.model}`;
      const details = selectedItemObj.isBulk
        ? `Bulk Item (Available: ${selectedItemObj.availableQty})`
        : `S.No. ${selectedItemObj.serialNumber || '-'} | Barcode: ${selectedItemObj.barcode || '-'}`;

      const selectedBilling = this.billingStatuses.find(b => b.value === this.newStockItem.billingStatus);
      const billingStatusName = selectedBilling ? selectedBilling.label : '';

      itemsArray.push(this.fb.group({
        name: [selectedItemObj.isBulk ? selectedItemObj.itemName : (selectedItemObj.serialNumber || selectedItemObj.barcode || selectedItemObj.itemName)],
        nameDisplay: [displayItemName],
        qty: [finalQty, [Validators.required, Validators.min(1)]],
        billingStatus: [this.newStockItem.billingStatus],
        billingStatusName: [billingStatusName],
        details: [details],
        itemId: [selectedItemObj.id || selectedItemObj.itemId || 0],
        serialNumber: [selectedItemObj.isBulk ? '' : (selectedItemObj.serialNumber || '')],
        barcode: [selectedItemObj.isBulk ? '' : (selectedItemObj.barcode || '')],
        isBulk: [selectedItemObj.isBulk]
      }));

      this.newStockItem = { name: null, qty: null, billingStatus: null };
      this.isItemEntryAttempted = false;
    }
  }

  removeStockItem(index: number) {
    const itemsArray = this.stockSendForm.get('stockSendItems') as FormArray;
    itemsArray.removeAt(index);
  }

  addStockProduct() {
    this.isProductEntryAttempted = true;
    if (this.newStockProduct.name && this.newStockProduct.qty && this.newStockProduct.billingStatus) {
      const selectedProd = this.newStockProduct.name;
      const productsArray = this.stockSendForm.get('stockSendProducts') as FormArray;

      // Uniqueness check: Products are always serialized (uniqueness by serialNumber or barCode)
      const alreadyAdded = productsArray.controls.some(ctrl => {
        const sameId = ctrl.get('productDetailsId')?.value === selectedProd.productDetailsId;
        const snMatch = ctrl.get('serialNumber')?.value === selectedProd.serialNumber;
        const bcMatch = ctrl.get('barcode')?.value === selectedProd.barCode;
        return sameId && (snMatch || bcMatch);
      });

      if (alreadyAdded) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'This specific product is already added.'
        });
        return;
      }

      const displayProdName = `${selectedProd.productName} - ${selectedProd.make} - ${selectedProd.model}`;
      const details = `S.No. ${selectedProd.serialNumber || '-'} | Barcode: ${selectedProd.barCode || '-'} | Status: ${this.newStockProduct.productStatus}`;

      const selectedBilling = this.billingStatuses.find(b => b.value === this.newStockProduct.billingStatus);
      const billingStatusName = selectedBilling ? selectedBilling.label : '';

      productsArray.push(this.fb.group({
        name: [selectedProd.serialNumber || selectedProd.barCode || selectedProd.productName],
        nameDisplay: [displayProdName],
        qty: [1, [Validators.required, Validators.min(1)]],
        billingStatus: [this.newStockProduct.billingStatus],
        billingStatusName: [billingStatusName],
        details: [details],
        productDetailsId: [selectedProd.productDetailsId || 0],
        serialNumber: [selectedProd.serialNumber || ''],
        barcode: [selectedProd.barCode || ''],
        productStatus: [this.newStockProduct.productStatus || 'SALE'],
        isBulk: [false]
      }));

      this.newStockProduct = { name: null, qty: null, billingStatus: null, productStatus: 'SALE' };
      this.isProductEntryAttempted = false;
    }
  }

  removeStockProduct(index: number) {
    const productsArray = this.stockSendForm.get('stockSendProducts') as FormArray;
    productsArray.removeAt(index);
  }

  toggleStockItemExpanded(index: number) {
    const itemsArray = this.stockSendForm.get('stockSendItems') as FormArray;
    const itemGroup = itemsArray.at(index);
    if (itemGroup) {
      itemGroup.patchValue({ expanded: !itemGroup.get('expanded')?.value });
    }
  }

  toggleStockProductExpanded(index: number) {
    const productsArray = this.stockSendForm.get('stockSendProducts') as FormArray;
    const itemGroup = productsArray.at(index);
    if (itemGroup) {
      itemGroup.patchValue({ expanded: !itemGroup.get('expanded')?.value });
    }
  }

  // Stock Return Methods
  addReturnItem() {
    this.isReturnItemEntryAttempted = true;
    if (this.newReturnItem.name && this.newReturnItem.qty && this.newReturnItem.condition) {
      const itemsArray = this.stockReturnForm.get('stockReturnItems') as FormArray;
      const selectedItemObj = this.newReturnItem.name;

      const alreadyAdded = itemsArray.controls.some(ctrl => ctrl.get('issueItemId')?.value === selectedItemObj.issueItemId);

      if (alreadyAdded) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'This item is already added to the return list.' });
        return;
      }

      let finalQty = this.newReturnItem.qty;
      if (!selectedItemObj.isBulk) {
        finalQty = 1;
      } else if (selectedItemObj.quantity && finalQty > selectedItemObj.quantity) {
        this.messageService.add({ severity: 'warn', summary: 'Quantity Warning', detail: `Only ${selectedItemObj.quantity} available to return.` });
        return;
        // finalQty = selectedItemObj.quantity;
      }

      const displayItemName = `${selectedItemObj.itemName} - ${selectedItemObj.make} - ${selectedItemObj.model}`;

      itemsArray.push(this.fb.group({
        name: [selectedItemObj.isBulk ? selectedItemObj.itemName : (selectedItemObj.serialNumber || selectedItemObj.barcode || selectedItemObj.itemName)],
        nameDisplay: [displayItemName],
        qty: [finalQty, [Validators.required, Validators.min(1)]],
        condition: [this.newReturnItem.condition],
        issueItemId: [selectedItemObj.issueItemId || 0],
        itemId: [selectedItemObj.itemId || 0],
        serialNumber: [selectedItemObj.serialNumber || ''],
        barcode: [selectedItemObj.barcode || ''],
        isBulk: [selectedItemObj.isBulk]
      }));

      this.newReturnItem = { name: null, qty: null, condition: null };
      this.isReturnItemEntryAttempted = false;
    }
  }

  removeReturnItem(index: number) {
    const itemsArray = this.stockReturnForm.get('stockReturnItems') as FormArray;
    itemsArray.removeAt(index);
  }

  addReturnProduct() {
    this.isReturnProductEntryAttempted = true;
    if (this.newReturnProduct.name && this.newReturnProduct.qty && this.newReturnProduct.condition) {
      const productsArray = this.stockReturnForm.get('stockReturnProducts') as FormArray;
      const selectedProdObj = this.newReturnProduct.name;

      const alreadyAdded = productsArray.controls.some(ctrl => ctrl.get('issueProductId')?.value === selectedProdObj.issueProductId);

      if (alreadyAdded) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'This product is already added to the return list.' });
        return;
      }

      let finalQty = this.newReturnProduct.qty;
      if (!selectedProdObj.isBulk) {
        finalQty = 1;
      } else if (selectedProdObj.quantity && finalQty > selectedProdObj.quantity) {
        this.messageService.add({ severity: 'warn', summary: 'Quantity Warning', detail: `Only ${selectedProdObj.quantity} available to return.` });
        return;
        // finalQty = selectedProdObj.quantity;
      }

      const displayProductName = `${selectedProdObj.productName} - ${selectedProdObj.make} - ${selectedProdObj.model}`;

      productsArray.push(this.fb.group({
        name: [selectedProdObj.serialNumber || selectedProdObj.barCode || selectedProdObj.productName],
        nameDisplay: [displayProductName],
        qty: [finalQty, [Validators.required, Validators.min(1)]],
        condition: [this.newReturnProduct.condition],
        issueProductId: [selectedProdObj.issueProductId || 0],
        productDetailsId: [selectedProdObj.productDetailsId || 0],
        serialNumber: [selectedProdObj.serialNumber || ''],
        barCode: [selectedProdObj.barCode || ''],
        isBulk: [selectedProdObj.isBulk]
      }));

      this.newReturnProduct = { name: null, qty: null, condition: null };
      this.isReturnProductEntryAttempted = false;
    }
  }

  removeReturnProduct(index: number) {
    const productsArray = this.stockReturnForm.get('stockReturnProducts') as FormArray;
    productsArray.removeAt(index);
  }

  submitted: boolean = false;

  getModalTitle(): string {
    switch (this.mode) {
      case 'view-purchase':
        return `${this.data?.invoiceNumber || 'PREORDER'} - ${this.formatDate(this.data?.invoiceDate) || ''}`;
      case 'add-purchase':
        return 'ADD PURCHASE INVOICE';
      case 'update-purchase':
        return 'UPDATE PURCHASE INVOICE';
      case 'stock-send':
        return 'STOCK SEND';
      case 'view-stock-send':
        return 'STOCK ISSUED INFO';
      case 'stock-return':
        return 'STOCK RETURN';
      case 'view-return':
        return 'RETURN DETAILS';
      case 'closing-statement':
        return 'CLOSING STATEMENT';
      default:
        return 'ADD PURCHASE INVOICE';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // File Upload Handlers (Used by stock-send)
  onInvoiceUpload(files: File[]) {
    if (files.length > 0) {
      this.invoiceFile = { name: files[0].name, progress: 100, file: files[0] };
    } else {
      this.invoiceFile = null;
    }
  }

  onOthersUpload(files: File[]) {
    this.otherFiles = files.map(f => ({ name: f.name, progress: 100, file: f }));
  }

  // Main Save/Submit Handlers
  handleSave() {
    this.submitted = true;
    let payload: any = {};

    switch (this.mode) {
      case 'add-purchase':
      case 'update-purchase':
        this.isDeliveredSubmit = true;
        this.addPurchaseForm.markAllAsTouched();

        // For delivered saves, Invoice No. and Invoice Date are required
        if (!this.isPreorderUpdate) {
          this.addPurchaseForm.get('invoiceNo')?.setValidators(Validators.required);
          this.addPurchaseForm.get('invoiceDate')?.setValidators(Validators.required);
          this.addPurchaseForm.get('invoiceNo')?.updateValueAndValidity();
          this.addPurchaseForm.get('invoiceDate')?.updateValueAndValidity();
        }

        const pdFormValue = this.addPurchaseForm.getRawValue();

        // Custom Validation for Delivered
        if (!pdFormValue.purchaseItems || pdFormValue.purchaseItems.length === 0) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please add at least one item to the invoice before saving.' });
          return;
        }

        // Validate Serials and Barcodes for Delivered
        this.hasMissingSerials = false;
        let hasMissingBarcodes = false;

        for (const item of pdFormValue.purchaseItems) {
          const reqSerial = item.serialNumberFlag !== 'F';
          const reqBarcode = item.barcodeFlag !== 'F';

          if (!reqSerial && !reqBarcode) continue;

          if (!item.serialDetails || item.serialDetails.length === 0) {
            if (reqSerial) this.hasMissingSerials = true;
            if (reqBarcode) hasMissingBarcodes = true;
            break;
          }

          for (const sd of item.serialDetails) {
            if (reqSerial && (!sd.serialNo || sd.serialNo.trim() === '')) {
              this.hasMissingSerials = true;
            }
            if (reqBarcode && (!sd.barcodeNo || sd.barcodeNo.trim() === '')) {
              this.hasMissingBarcodes = true;
            }
          }
        }

        if (this.hasMissingSerials) {
          return;
        }

        if (this.hasMissingBarcodes) {
          return;
        }

        if (this.addPurchaseForm.invalid) {
          return;
        }

        this.formatAndEmitPayload('delivered');
        break;

      case 'stock-send':
        if (this.stockSendForm.invalid) {
          this.stockSendForm.markAllAsTouched();
          return;
        }
        const sendFormValue = this.stockSendForm.getRawValue();

        // Helper to format date properly (YYYY-MM-DD or ISO matching local time)
        const formatYYYYMMDD = (dateVal: any) => {
          if (!dateVal) return null;
          const d = new Date(dateVal);
          if (isNaN(d.getTime())) return null;
          const pad = (n: number) => n < 10 ? '0' + n : n;
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        // Format createdTime as YYYY-MM-DD HH:mm:ss
        const now = new Date();
        const pad = (n: number) => n < 10 ? '0' + n : n;
        const createdTimeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        // Validate at least one item or product is selected
        if (sendFormValue.stockSendItems.length === 0 && sendFormValue.stockSendProducts.length === 0) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please add at least one Item or Product to send.' });
          return;
        }

        // Map items securely from previously selected data
        const mappedItems = sendFormValue.stockSendItems.map((item: any) => {
          const itm: any = {
            itemId: Number(item.itemId),
            quantity: Number(item.qty),
            billingTypeId: Number(item.billingStatus) || 1
          };
          if (item.serialNumber || item.barcode) {
            itm.serialNumber = item.serialNumber || '';
            itm.barcode = item.barcode || '';
          }
          return itm;
        });

        const mappedProducts = sendFormValue.stockSendProducts.map((prod: any) => ({
          productDetailsId: Number(prod.productDetailsId),
          productStatus: prod.productStatus || 'SALE',
          quantity: Number(prod.qty) || 1,
          billingTypeId: Number(prod.billingStatus) || 1
        }));

        const requestPayload = {
          issueDate: formatYYYYMMDD(new Date()),
          issuedFromId: Number(sendFormValue.sendFrom) || 0,
          issuedToId: Number(sendFormValue.site) || 0,
          categoryId: Number(sendFormValue.category) || 0,
          billingTypeId: Number(sendFormValue.billingStatus) || 0,
          status: sendFormValue.status || 'ISSUED',
          transportationId: Number(sendFormValue.transportationPlatform) || 0,
          trackingId: isNaN(Number(sendFormValue.trackingId)) ? sendFormValue.trackingId : Number(sendFormValue.trackingId),
          shipmentDate: formatYYYYMMDD(sendFormValue.shipmentDate),
          deliveredDate: sendFormValue.status === 'DELIVERED' ? formatYYYYMMDD(sendFormValue.deliveredDate) : null,
          items: mappedItems,
          products: mappedProducts,
          createdBy: this.userId,
          createdTime: createdTimeStr
        };

        // Wrap in isStockSend so the inventory list captures it
        payload = { isStockSend: true, payload: requestPayload };
        this.submit.emit(payload);
        break;

      case 'stock-return':
        if (this.stockReturnForm.invalid) {
          this.stockReturnForm.markAllAsTouched();
          return;
        }

        const returnFormValue = this.stockReturnForm.getRawValue();

        if (returnFormValue.stockReturnItems.length === 0 && returnFormValue.stockReturnProducts.length === 0) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please add at least one Item or Product to return.' });
          return;
        }

        const formatReturnDate = (dateVal: any) => {
          if (!dateVal) return null;
          const d = new Date(dateVal);
          if (isNaN(d.getTime())) return null;
          const pad = (n: number) => n < 10 ? '0' + n : n;
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        const nowReturn = new Date();
        const padReturn = (n: number) => n < 10 ? '0' + n : n;
        const createdTimeReturnStr = `${nowReturn.getFullYear()}-${padReturn(nowReturn.getMonth() + 1)}-${padReturn(nowReturn.getDate())} ${padReturn(nowReturn.getHours())}:${padReturn(nowReturn.getMinutes())}:${padReturn(nowReturn.getSeconds())}`;

        const returnPayload: AddReturnPayload = {
          returnDate: returnFormValue.status === 'RETURNED' ? (formatReturnDate(returnFormValue.returnDate) || formatReturnDate(new Date())!) : formatReturnDate(new Date())!,
          returnFromId: Number(returnFormValue.returnFrom) || 0,
          returnToId: Number(returnFormValue.returnTo) || 0,
          remarks: returnFormValue.remarks || (returnFormValue.status === 'RETURNED' ? "Items returned to store" : "Items in transit from site"),
          status: returnFormValue.status || "IN_TRANSIT",
          items: returnFormValue.stockReturnItems.map((item: any) => ({
            issueItemId: item.issueItemId,
            itemId: item.itemId,
            conditionType: String(item.condition).toUpperCase()
          })),
          products: returnFormValue.stockReturnProducts.map((prod: any) => ({
            issueProductId: prod.issueProductId,
            productDetailsId: prod.productDetailsId,
            conditionType: String(prod.condition).toUpperCase()
          })),
          createdBy: this.userId,
          createdTime: createdTimeReturnStr
        };

        payload = { isStockReturn: true, payload: returnPayload };
        this.submit.emit(payload);
        break;

      default:
        payload = this.data;
        this.submit.emit(payload);
    }
  }

  handleSavePreOrder() {
    this.submitted = true;
    this.isDeliveredSubmit = false;

    // Invoice No. is NOT required for pre-order saves, but Invoice Date IS
    this.addPurchaseForm.get('invoiceNo')?.clearValidators();
    this.addPurchaseForm.get('invoiceNo')?.updateValueAndValidity();
    this.addPurchaseForm.get('invoiceDate')?.setValidators(Validators.required);
    this.addPurchaseForm.get('invoiceDate')?.updateValueAndValidity();

    this.addPurchaseForm.markAllAsTouched();
    const formValue = this.addPurchaseForm.getRawValue();

    // Strict Validation for PreOrder (Same as delivered, minus serials)
    if (!formValue.purchaseItems || formValue.purchaseItems.length === 0) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please add at least one item to the invoice before saving.' });
      return;
    }

    if (this.addPurchaseForm.invalid) {
      return;
    }

    this.formatAndEmitPayload('preorder');
  }

  submitUpdateReturn() {
    if (!this.viewReturnData) return;

    this.submitted = true;

    const now = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const modifiedTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const returnPayload: any = {
      returnDate: this.formatDateForPayload(this.viewReturnData.header.returnDateObj || this.viewReturnData.header.returnDate),
      status: this.viewReturnData.header.status,
      remarks: this.viewReturnData.header.remarks,
      modifiedBy: this.userId,
      modifiedTime: modifiedTime,
      items: (this.viewReturnData.items || []).map(item => ({
        returnItemId: item.id,
        conditionType: item.conditionType
      })),
      products: (this.viewReturnData.products || []).map(prod => ({
        returnProductId: prod.id,
        conditionType: prod.conditionType
      }))
    };

    const payload = {
      isUpdateReturn: true,
      returnId: this.viewReturnData.header.id,
      payload: returnPayload
    };

    this.submit.emit(payload);
  }

  private formatAndEmitPayload(statusString: 'delivered' | 'preorder') {
    const formValue = this.addPurchaseForm.getRawValue();

    const itemsPayload = (formValue.purchaseItems || []).map((item: any) => {
      const mappedItem: any = {
        itemId: item.itemName,
        quantity: typeof item.qty === 'string' ? parseInt(item.qty, 10) : item.qty,
        unitPrice: typeof item.cost === 'string' ? parseFloat(item.cost) : item.cost,
        gstPercent: typeof item.gst === 'string' ? parseFloat(item.gst) : item.gst
      };

      if (statusString === 'delivered') {
        mappedItem.serialNumbers = item.serialDetails.map((sd: any) => sd.serialNo).filter(Boolean);
        mappedItem.barcodes = item.serialDetails.map((sd: any) => sd.barcodeNo).filter(Boolean);
      }
      return mappedItem;
    });

    if (this.mode === 'add-purchase') {
      const purchasePayload: any = {
        invoiceNumber: formValue.invoiceNo,
        purchaseFromId: Number(formValue.platform) || null,
        purchaseToId: Number(formValue.purchaseForStore) || null,
        purchaseType: String(formValue.purchaseVia).toUpperCase() === 'ONLINE' ? 'ONLINE' : 'VENDOR',
        invoiceType: statusString === 'preorder' ? 'PREORDER' : 'DELIVERED',
        items: itemsPayload,
        createdBy: this.userId,
        createdTime: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}:${String(new Date().getSeconds()).padStart(2, '0')}`
      };

      if (formValue.invoiceDate) {
        const d = formValue.invoiceDate;
        if (d instanceof Date) {
          purchasePayload.invoiceDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }

      const formData = new FormData();
      formData.append('purchase', JSON.stringify(purchasePayload));
      if (this.invoiceFile?.file) formData.append('InvoiceFiles', this.invoiceFile.file);
      if (this.otherFiles && this.otherFiles.length > 0) {
        this.otherFiles.forEach((f: any) => {
          if (f.file) formData.append('otherFiles', f.file);
        });
      }

      console.log('Emitting add-purchase FormData payload');
      this.submit.emit({ isAddPurchase: true, payload: formData });

    } else if (this.mode === 'update-purchase') {
      const now = new Date();
      const pad = (n: number) => n < 10 ? '0' + n : n;
      const modifiedTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const updatePayloadItems = (formValue.purchaseItems || []).map((item: any) => {
        const updateItem: any = {
          purchaseItemId: item.purchaseItemId || item.id,
          status: statusString === 'preorder' ? 'PREORDER' : 'DELIVERED',
        };

        if (statusString === 'delivered') {
          updateItem.serialNumbers = (item.serialDetails || []).map((sd: any) => sd.serialNo).filter(Boolean);
          updateItem.barcodes = (item.serialDetails || []).map((sd: any) => sd.barcodeNo).filter(Boolean);
        } else {
          updateItem.serialNumbers = [];
          updateItem.barcodes = [];
        }
        return updateItem;
      });

      const updatePayload: any = {
        purchaseId: this.data?.purchase?.id || this.data?.id || this.data?.purchaseId,
        modifiedBy: this.userId,
        modifiedTime: modifiedTime,
        status: statusString === 'preorder' ? 'PREORDER' : 'DELIVERED',
        items: updatePayloadItems
      };
      if (formValue.invoiceNo) {
        updatePayload.invoiceNumber = formValue.invoiceNo;
      }
      this.submit.emit({ isUpdatePurchase: true, payload: updatePayload });
    }
  }

  // Legacy Methods for other modes (Stock Send/Return)
  isItemFilled(item: any) { return !!item?.name; }
  addItemRow() { if (this.data.items) this.data.items.push({}); }
  removeItemRow(index: number) { if (this.data.items) this.data.items.splice(index, 1); }
  onItemChange(item: any, index: number) { } // No-op
  getFilledItemsCount() { return 0; }

  calculateTotal() {
    // Trigger recalculation if needed, or just let the template call calculateItemTotal
  }

  calculateItemTotal(item: any): string {
    if (!item.cost || !item.qty) {
      return '0';
    }
    const cost = parseFloat(item.cost) || 0;
    const qty = parseInt(item.qty) || 0;
    const gst = parseFloat(item.gst) || 0;

    const subtotal = cost * qty;
    const gstAmount = subtotal * (gst / 100);
    const total = subtotal + gstAmount;

    return total.toFixed(2);
  }

  // Restore missing methods for Product rows (Stock Send mode)
  isProductFilled(product: any): boolean {
    return !!(product.name && product.name.trim());
  }

  getFilledProductsCount(): number {
    if (!this.data.products) return 0;
    return this.data.products.filter((p: any) => this.isProductFilled(p)).length;
  }

  onProductChange(product: any, index: number) {
    if (product.name && index === this.data.products.length - 1) {
      this.data.products.push({});
    }
  }

  addProductRow() {
    if (!this.data.products) {
      this.data.products = [];
    }
    this.data.products.push({});
  }

  removeProductRow(index: number) {
    if (this.data.products && this.data.products.length > 1) {
      this.data.products.splice(index, 1);
    }
  }

  getStatusColor(status: string | undefined | null): any {
    if (!status) return { background: '#999999', color: '#ffffff' };
    const s = status.toLowerCase().replace(/[_\s-]/g, '');

    // Default styles
    let bg = '#999999';
    let text = '#ffffff';

    if (this.mode === 'view-stock-send') {
      // ISSUED TAB CONTEXT
      if (s === 'delivered') bg = '#53BF8B';
      else if (s === 'issued') bg = '#000000';
      else if (s === 'intransit') bg = '#F44336';
      else if (s === 'returned') bg = '#53BF8B'; // Issued tab uses green/teal for return
    } else if (this.mode === 'view-purchase') {
      // PURCHASE TAB CONTEXT
      if (s === 'delivered') bg = '#53BF8B';
      else if (s === 'preorder' || s === 'preordered') bg = '#000000';
      else if (s === 'returned') bg = '#ED3237'; // Purchase tab uses red for return
    } else if (this.mode === 'view-return') {
      // RETURN TAB CONTEXT
      if (s === 'returned' || s === 'success') bg = '#53BF8B';
      else if (s === 'intransit' || s === 'intransit') bg = '#F44336';
    } else {
      // FALLBACK
      if (s === 'delivered' || s === 'success') bg = '#53BF8B';
      else if (s === 'issued' || s === 'preorder' || s === 'preordered') bg = '#000000';
      else if (s === 'returned' || s === 'returned') bg = '#ED3237';
      else if (s === 'intransit') bg = '#F44336';
    }

    return { background: bg, color: text };
  }

  getConditionColor(condition: string | undefined | null): any {
    if (!condition) return { background: '#999999', color: '#ffffff' };
    const c = condition.toLowerCase();
    if (c === 'new') return { background: '#53BF8B', color: '#ffffff' };
    if (c === 'used') return { background: '#FF9800', color: '#ffffff' };
    if (c === 'scrap') return { background: '#F44336', color: '#ffffff' };
    return { background: '#999999', color: '#ffffff' };
  }

  getSubmitButtonLabel(): string {
    if (!this.isLoading) {
      if (this.mode === 'stock-send') return 'SEND';
      if (this.mode === 'stock-return') return 'RETURN';
      if (this.mode === 'view-purchase' && this.isBulkEditingStatus) return 'SAVE CHANGES';
      return 'SUBMIT';
    }

    if (this.mode === 'stock-send') return 'SENDING...';
    if (this.mode === 'stock-return') return 'RETURNING...';
    if (this.mode === 'view-purchase' || this.mode === 'view-stock-send' || this.mode === 'view-return') return 'SAVING...';
    return 'SUBMITTING...';
  }

  dateRangeValidator(group: FormGroup) {
    const shipmentDate = group.get('shipmentDate')?.value;
    const deliveredDate = group.get('deliveredDate')?.value;
    const status = group.get('status')?.value;

    if (status === 'DELIVERED' && shipmentDate && deliveredDate) {
      if (new Date(deliveredDate) < new Date(shipmentDate)) {
        return { dateRangeInvalid: true };
      }
    }
    return null;
  }
}
