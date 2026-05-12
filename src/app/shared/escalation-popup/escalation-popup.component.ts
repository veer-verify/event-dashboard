import {
  Component,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  OnChanges,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  HostListener,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { AgGridModule, ICellRendererAngularComp } from "ag-grid-angular";
import { ColDef, GridApi, Column, IRichCellEditorParams, ICellRendererParams } from "ag-grid-community";
import { DialogModule } from "primeng/dialog";
import { OverlayPanelModule, OverlayPanel } from "primeng/overlaypanel";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { ViewChild } from "@angular/core";
import { EventsService } from "src/app/pages/events/events.service";
import { ProfileImageRendererComponent } from "src/app/shared/renderers/profile-image-renderer.component";
import { ImagePipe } from "src/app/shared/image.pipe";

import { NotificationService } from "src/app/shared/notification.service";

@Component({
  selector: "app-escalation-popup",
  templateUrl: "./escalation-popup.component.html",
  styleUrls: ["./escalation-popup.component.css"],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    DialogModule,
    OverlayPanelModule,
    ButtonModule,
    ImagePipe,
  ],
  providers: [],
})
export class EscalationPopupComponent implements OnChanges, OnInit {
  @Input() isVisible = false;
  @Input() selectedItem: any;
  @Input() selectedDate: Date | null = null;
  @Input() data: any; // not used, kept for compatibility

  @Input() tableConfigs: {
    [key: string]: { columnDefs: ColDef[]; rowData: any[] };
  } = {};
  @Input() popupType: "MORE" | "DETAILS" = "DETAILS";

  // 👇 NEW: queueUsers from your queue API response
  @Input() queueUsers: any[] = [];
  @Input() isPending = false;

  @Output() close = new EventEmitter<void>();
  @Output() refreshMoreInfo = new EventEmitter<number>();
  @Output() addCommentClicked = new EventEmitter<any>();

  currentUser: any = null;

  /** Re-read user from storage if currentUser is not loaded yet */
  private getStoredUser(): any | null {
    const raw =
      sessionStorage.getItem("verifai_user") ||
      sessionStorage.getItem("verifai_user");

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Get the logged-in user's "level" from the login response.
   * Adjust this mapping if your backend uses a different field.
   */
  private getLoggedInUserLevelId(): number {
    const u = this.currentUser ?? this.getStoredUser();

    // ✅ If backend already sends something like userLevel/levelId, prefer it
    const direct =
      Number(u?.userLevel) ||
      Number(u?.UserLevel) ||
      Number(u?.levelId) ||
      Number(u?.LevelId);

    if (direct) return direct;

    // ✅ Common fallback: first role in roleList uses roleId as the level
    const roleId = Number(u?.roleList?.[0]?.roleId);
    if (roleId) return roleId;

    return 0;
  }

  /** View toggle: false = ESCALATION DETAILS, true = ADD COMMENT **/
  isAddCommentView = false;
  isEmailPreviewView = false;
  emailPreviewData: any = null;
  isEmailPreviewLoading = false;
  currentPreviewRow: any = null;

  formattedBasicInfoData: any[] = [];


  /** ADD COMMENT form model **/
  commentTags = [
    { label: "Suspicious", value: "SUSPICIOUS" },
    { label: "False", value: "FALSE" },
    { label: "Info", value: "INFO" },
  ];

  addCommentForm: { tag: string | null; notes: string } = {
    tag: null,
    notes: "",
  };

  /** IMAGE LIGHTBOX STATE **/
  isImagePopupVisible = false;
  selectedImageUrl: string | null = null;
  showPdfOptions = false;
  selectedLogoType = 'ivis';
  logoTypes = ['ivis', 'tid', 'verifai'];

  openImagePopup(url: string, event: Event) {
    event.preventDefault(); // prevent navigation
    this.selectedImageUrl = url;
    this.isImagePopupVisible = true;
  }

  closeImagePopup() {
    this.isImagePopupVisible = false;
    this.selectedImageUrl = null;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.isImagePopupVisible) return;

    if (event.key === 'ArrowRight' || event.key === '>' || event.key === '.') {
      this.nextImage();
    } else if (event.key === 'ArrowLeft' || event.key === '<' || event.key === ',') {
      this.prevImage();
    } else if (event.key === 'Escape') {
      this.closeImagePopup();
    }
  }

  nextImage() {
    if (!this.imageUrls || this.imageUrls.length <= 1 || !this.selectedImageUrl) return;
    const idx = this.imageUrls.indexOf(this.selectedImageUrl);
    if (idx === -1) return;
    const nextIdx = (idx + 1) % this.imageUrls.length;
    this.selectedImageUrl = this.imageUrls[nextIdx];
  }

  prevImage() {
    if (!this.imageUrls || this.imageUrls.length <= 1 || !this.selectedImageUrl) return;
    const idx = this.imageUrls.indexOf(this.selectedImageUrl);
    if (idx === -1) return;
    const prevIdx = (idx - 1 + this.imageUrls.length) % this.imageUrls.length;
    this.selectedImageUrl = this.imageUrls[prevIdx];
  }

  // Row data for escalation and alarm events
  escalationRowData: any[] = [];
  alarmRowData: any[] = [];
  commentRowData: any[] = [];
  actionsTakenRowData: any[] = [];

  selectedTZ: "MT" | "CT" | "IST" = "MT";

  escalationGridApi!: GridApi;
  commentGridApi!: GridApi;
  commentGridColumnApi!: Column;

  selectedEvent: any = null;
  parsedObjects: any[] = [];
  imageUrls: string[] = [];
  videoUrls: string[] = [];

  constructor(
    private eventsService: EventsService,
    private notificationService: NotificationService
  ) { }

  // ------------------------ INIT ------------------------
  ngOnInit() {

    this.loadActionTags();
    const raw =
      sessionStorage.getItem("verifai_user") ||
      sessionStorage.getItem("verifai_user");

    if (raw) {
      try {
        this.currentUser = JSON.parse(raw);
      } catch (e) {
        console.error("Error parsing stored user data", e);
      }
    }
  }

  handleAddClick() {
    this.addCommentClicked.emit({ row: null, mode: 'add' });
  }

  /* -------- Toast helpers (PrimeNG) -------- */
  private showSuccess(summary: string, detail?: string) {
    this.notificationService.success(summary, detail);
  }

  private showError(summary: string, detail?: string) {
    this.notificationService.error(summary, detail);
  }

  private showWarn(summary: string, detail?: string) {
    this.notificationService.warn(summary, detail);
  }

  downloadExcel() {
    const eventId = this.selectedEvent?.eventId || this.selectedEvent?.eventsId || this.selectedEvent?.id;
    if (!eventId) {
      this.showError("Download Failed", "Event ID not found");
      return;
    }

    this.eventsService.downloadSingleEventExcel(eventId).subscribe({
      next: (response: any) => {
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `Event_${eventId}_Report.xlsx`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+)"?/);
          if (match?.[1]) filename = match[1];
        }

        const blob = new Blob([response.body], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => this.showError("Download Failed", "Failed to download Excel report")
    });
  }

  downloadPdf() {
    const eventId = this.selectedEvent?.eventId || this.selectedEvent?.eventsId || this.selectedEvent?.id;
    if (!eventId) {
      this.showError("Download Failed", "Event ID not found");
      return;
    }

    this.eventsService.downloadSingleEventPdf(eventId, this.selectedLogoType).subscribe({
      next: (response: any) => {
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `Event_${eventId}_Report_${this.selectedLogoType}.pdf`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+)"?/);
          if (match?.[1]) filename = match[1];
        }

        const blob = new Blob([response.body], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
        this.showPdfOptions = false;
      },
      error: (err) => this.showError("Download Failed", "Failed to download PDF report")
    });
  }

  // ------------------------ TZ Handling ------------------------
  onTzChange(tz: "MT" | "CT" | "IST") {
    this.selectedTZ = tz;
    this.refreshTimeColumns();
  }

  private getTimeValue =
    (baseField: "receiveAt" | "reviewStart" | "reviewEnd") => (params: any) => {
      let key: string = baseField;
      if (this.selectedTZ === "CT") key = `${baseField}(CT)`;
      else if (this.selectedTZ === "IST") key = `${baseField}(IST)`;

      const row = (params?.data ?? {}) as Record<string, unknown>;
      const raw =
        (row[key] as string | Date | undefined) ??
        (row[baseField] as string | Date | undefined) ??
        "";

      const full = this.formatDateTime(raw);
      return full.split(" ")[1] || ""; // only HH:MM:SS
    };

  private refreshTimeColumns() {
    if (this.escalationGridApi) {
      this.escalationGridApi.refreshCells({
        force: true,
        columns: ["receiveAt", "reviewStart", "reviewEnd", "actionTag", "subActionTag"],
      });
    }
  }

  private normalizeAvatarUrl(url?: string): string | undefined {
    if (!url) return url;
    return url.replace(
      /assetName=([^&]+)/,
      (_m, v) => `assetName=${encodeURIComponent(v)}`
    );
  }

  // ------------------------ ESCALATION COLUMNS ------------------------
  actionTagCategories: any[] = [];
  filteredSubActionTags: any[] = [];
  selectedCategoryId: number | null = null;

  private loadActionTags() {
    const cached = sessionStorage.getItem("actionTagCategories");
    if (cached) {
      try {
        this.actionTagCategories = JSON.parse(cached);
        this.refreshTimeColumns();
        return; // Skip API call if data exists in cache
      } catch (e) {
        console.error("Error parsing cached action tags", e);
      }
    }

    this.eventsService
      .getActionTagCategories()
      .subscribe((res: any) => {
        const cats = res?.actionTagCategories || [];
        this.actionTagCategories = cats;
        sessionStorage.setItem("actionTagCategories", JSON.stringify(cats));
        this.refreshTimeColumns();
      });
  }

  onActionTagChange(categoryId: number | null) {
    if (categoryId === null) {
      this.filteredSubActionTags = [];
      return;
    }
    const selectedCategory = this.actionTagCategories.find(
      cat => cat.categoryId === +categoryId
    );

    this.filteredSubActionTags =
      selectedCategory?.actionTagSubCategories || [];
  }


  currentActionTag: any;
  currentSubActionTag: any;
  escalationColumnDefs: ColDef[] = [
    {
      headerName: "USER",
      field: "user",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      cellRenderer: ProfileImageRendererComponent, // 👈 use Angular renderer with pipe
      editable: false,
    },
    {
      headerName: "USER LEVEL",
      field: "userLevel",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false,
      valueFormatter: (params: any) => {
        const val = params.value !== null && params.value !== undefined ? Number(params.value) : -1;
        switch (val) {
          case 1: return "SCR";
          case 2: return "PD";
          case 3: return "D";
          case 4: return "OB";
          case 0: return "ADMIN";
          default: return params.value || "";
        }
      }
    },
    {
      headerName: "RECEIVE AT",
      field: "receiveAt",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false,
      valueGetter: this.getTimeValue("receiveAt"),
    },
    {
      headerName: "REVIEW START",
      field: "reviewStart",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false,
      valueGetter: this.getTimeValue("reviewStart"),
    },
    {
      headerName: "REVIEW END",
      field: "reviewEnd",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false,
      valueGetter: this.getTimeValue("reviewEnd"),
    },
    {
      headerName: "DURATION",
      field: "duration",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false,
    },
    {
      headerName: "ACTION TAG",
      field: "actionTag",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false,
      valueFormatter: (params: any) => {
        const val = params.value;
        const cat = this.actionTagCategories.find(c => Number(c.categoryId) === Number(val));
        if (cat) return cat.categoryName;
        return (val !== null && val !== undefined) ? val.toString() : "";
      }
    },
    {
      headerName: "SUB ACTION TAG",
      field: "subActionTag",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false,
      valueFormatter: (params: any) => {
        const val = params.value;
        const row = params.data;
        const cat = this.actionTagCategories.find(c => Number(c.categoryId) === Number(row.actionTag));
        if (cat && cat.actionTagSubCategories) {
          const sub = cat.actionTagSubCategories.find((s: any) => Number(s.subCategoryId || s.id) === Number(val));
          if (sub) return sub.subCategoryName || sub.name;
        }
        return (val !== null && val !== undefined) ? val.toString() : "";
      }
    },
    {
      headerName: "NOTES",
      field: "notes",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false
    },
    {
      headerName: "END OF SHIFT",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      editable: false,
      cellRenderer: (params: any) => {
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.gap = "6px";
        container.style.justifyContent = "center";

        // ✅ Only show pencil for the LAST row
        const rowIndex = params.node.rowIndex;
        const lastRowIndex = params.api.getDisplayedRowCount() - 1;
        if (rowIndex !== lastRowIndex) return container;

        const editBtn = document.createElement("button");
        editBtn.className = "action-btn1 edit-btn1";
        editBtn.style.border = "none";
        editBtn.style.background = "transparent";
        editBtn.style.cursor = "pointer";

        const pencilIcon = document.createElement("img");
        pencilIcon.src = "assets/pencil.svg";
        pencilIcon.alt = "Edit";
        pencilIcon.style.width = "16px";
        pencilIcon.style.height = "16px";

        editBtn.appendChild(pencilIcon);
        editBtn.addEventListener("click", () => {
          this.addCommentClicked.emit({ row: params.data, mode: 'update' });
        });

        container.appendChild(editBtn);
        return container;
      }
    }
  ];

  editRow(params: any) {
    // backup original row BEFORE editing
    const originalCopy = { ...params.node.data };

    params.node.setData({
      ...params.node.data,
      isEditing: true,
      _originalData: originalCopy
    });

    // start editing
    params.api.startEditingCell({
      rowIndex: params.node.rowIndex,
      colKey: "subActionTag" // change if needed
    });
  }

  /** Create duplicate row from last row and put into edit mode */
  createDuplicateRowFromLast(params: any) {
    const lastRowNode = params.api.getDisplayedRowAtIndex(
      params.api.getDisplayedRowCount() - 1
    );
    if (!lastRowNode) return;

    const original = lastRowNode.data;

    const duplicate = {
      ...original,
      isDuplicate: true,
      isEditing: true,
      actionTag: null,
      subActionTag: null
    };

    const res = params.api.applyTransaction({ add: [duplicate] });
    const newRowNode = res?.add && res.add[0] ? res.add[0] : null;
    if (!newRowNode) return;

    const rowIndex = newRowNode.rowIndex;
    params.api.startEditingCell({
      rowIndex,
      colKey: "subActionTag",
    });
  }

  saveEscalation(data: any) {
    if (!this.selectedEvent) {
      console.error("No event selected");
      this.showError("Update Escalation", "No event selected.");
      return;
    }

    const eventId = Number(this.selectedItem?.eventDetails?.[0]?.eventId || this.selectedItem?.eventId);
    if (!eventId) {
      console.error("Invalid eventId:", this.selectedItem);
      this.showError("Update Escalation", "Invalid event ID for this record.");
      return;
    }

    // ✅ NEW: userlevel comes from login response (stored user)
    const loggedInUserLevelId = this.getLoggedInUserLevelId();
    if (!loggedInUserLevelId) {
      this.showError(
        "Update Escalation",
        "Unable to determine your user level."
      );
      return;
    }

    let payload: any;

    if (!this.isPending && data.id) {
      // ✅ CLOSED Tab: Update existing record using ID
      payload = {
        id: Number(data.id),
        eventId: Number(eventId),
        eventsId: String(eventId),
        actionTag: this.currentActionTag?.categoryId,
        subActionTag: this.currentSubActionTag?.subCategoryId,
        notes: data.notes || "",
      };
    } else {
      // ✅ PENDING Tab or New Record: Create new entry (Old Logic)
      payload = {
        eventId: Number(eventId),
        eventsId: String(eventId),

        // ✅ IMPORTANT: set userlevel from login
        userlevel: loggedInUserLevelId,

        user: this.currentUser?.UserId || 0,
        alarm: "N",
        landingTime: data.receiveAt || "",
        receivedTime: "",
        reviewStartTime: data.reviewStart || "",
        reviewEndTime: data.reviewEnd || "",
        actionTag: this.currentActionTag?.categoryId,
        subActionTag: this.currentSubActionTag?.subCategoryId,
        notes: data.notes || "",
      };
    }


    this.eventsService.putEventsMoreInfo(payload).subscribe({
      next: (res) => {
        const msg =
          res?.message ||
          res?.msg ||
          res?.statusMessage ||
          "Escalation updated successfully.";

        this.showSuccess("Update Escalation", msg);

        const finish = () => {
          // ✅ Update UI row so userLevel changes immediately in the table
          data.userLevel = loggedInUserLevelId;
          data.levelId = loggedInUserLevelId;
          data.isEditing = false;
          data.isDuplicate = false;
          this.escalationGridApi.applyTransaction({ update: [data] });
          this.refreshMoreInfo.emit(eventId);
        };

        // ✅ NEW: If notes are present, also add as a comment (as requested)
        if (data.notes && data.notes.trim()) {
          const commentPayload = {
            eventsId: String(eventId),
            commentsInfo: data.notes.trim(),
            createdBy: this.currentUser?.UserId || 0,
            remarks: "",
          };
          this.eventsService.addComment(commentPayload).subscribe({
            next: () => {
              finish();
            },
            error: (err) => {
              console.error("Failed to add automatic comment", err);
              this.showError("Comment Failed", "Update succeeded but adding comment failed.");
              finish();
            }
          });
        } else {
          finish();
        }
      },
      error: (err) => {
        const msg =
          err?.error?.message ||
          err?.error?.msg ||
          "Failed to update escalation. Please try again.";

        this.showError("Update Escalation Failed", msg);
      },
    });
  }

  private mapActionTag(value: any): number {
    if (!value) return 3;

    const v = String(value).trim().toLowerCase();

    if (v === "suspicious") return 2;
    if (v === "false" || v === "false alarm") return 1;

    return 3;
  }

  // ------------------------ ALARM COLUMNS ------------------------
  alarmColumnDefs: ColDef[] = [
    {
      headerName: "DETERRED TIME",
      field: "deterredTime",
      headerClass: "custom-header",
      cellClass: "custom-cell",
    },
    {
      headerName: "USER",
      field: "user",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      cellRenderer: ProfileImageRendererComponent, // ✅ use your component
      editable: false,
    },
    {
      headerName: "DESCRIPTION",
      field: "description",
      headerClass: ["custom-header", "center-header"],
      cellClass: ["custom-cell", "center-cell"],
      cellRenderer: (params: any) => {
        const value = params.value;
        let iconUrl = "";

        switch (value) {
          case "N":
            iconUrl = "assets/alarm-warning-fill-copy.svg";
            break;
          case "P":
            iconUrl = "assets/alarm-warning-fill-success.svg";
            break;
          case "R":
            iconUrl = "assets/alarm-warning-fill-restricted.svg";
            break;
          case "F":
            iconUrl = "assets/alarm-warning-fill-failed.svg";
            break;
          case "":
            iconUrl = "";
            break;
        }

        if (!iconUrl) return value || "";
        return `<div style="display:flex; justify-content:center; align-items:center; height:100%;"><img src="${iconUrl}" alt="${value}" style="width:20px; height:20px;" /></div>`;
      },
    },
    {
      headerName: "STATUS",
      field: "status",
      headerClass: "custom-header",
      cellClass: "custom-cell",
    },
  ];

  get activeAlarmColumnDefs(): ColDef[] {
    if (this.isPending) {
      return [
        {
          headerName: "DETERRENT TIME",
          field: "activityDetTime",
          headerClass: "custom-header",
          cellClass: "custom-cell",
        },
        {
          headerName: "USER",
          field: "user",
          headerClass: "custom-header",
          cellClass: "custom-cell",
          cellRenderer: ProfileImageRendererComponent,
          editable: false,
        },
        {
          headerName: "ALARM",
          field: "alarm",
          headerClass: ["custom-header", "center-header"],
          cellClass: ["custom-cell", "center-cell"],
          cellRenderer: (params: any) => {
            const value = params.value;
            let iconUrl = "";
            switch (value) {
              case "N": iconUrl = "assets/alarm-warning-fill-copy.svg"; break;
              case "P": iconUrl = "assets/alarm-warning-fill-success.svg"; break;
              case "R": iconUrl = "assets/alarm-warning-fill-restricted.svg"; break;
              case "F": iconUrl = "assets/alarm-warning-fill-failed.svg"; break;
            }
            if (!iconUrl) return value || "";
            return `<div style="display:flex; justify-content:center; align-items:center; height:100%;"><img src="${iconUrl}" alt="${value}" style="width:20px; height:20px;" /></div>`;
          },
        }
      ] as ColDef[];
    }
    return this.alarmColumnDefs;
  }

  get activeEscalationColumnDefs(): ColDef[] {
    if (this.isPending) {
      return this.escalationColumnDefs.filter(c => c.headerName !== "END OF SHIFT");
    }
    return this.escalationColumnDefs;
  }

  // ------------------------ BASIC INFO ------------------------
  basicInfoFields: { label: string; field: string; default?: string }[] = [
    { label: "Escalation ID", field: "eventId" },
    { label: "Ticket No.", field: "ticketNo", default: "--" },
    { label: "Site Name", field: "siteName" },
    { label: "Camera Name/id", field: "cameraCombined" },
    { label: "Event Time (CT)", field: "eventTime_CT" },
    { label: "Event Time Customer", field: "eventStartTime" },
    { label: "Event End Time", field: "eventEndTime" },
    { label: "Event Time (IN)", field: "eventTime_IN" },
    { label: "Type", field: "eventType", default: "--" },
    { label: "Country", field: "country" },
  ];

  get activeBasicInfoFields() {
    if (this.isPending) {
      return [
        { label: "Site Name", field: "siteName" },
        { label: "Camera Name/id", field: "cameraCombined" },
        { label: "Event Time Customer", field: "eventStartTime" },
        { label: "Type", field: "eventType", default: "--" }
      ];
    }
    return this.basicInfoFields;
  }

  getEventDotColor(eventType: string): string {
    const type = (eventType || "").toLowerCase();
    if (type.includes("manual")) return "#FFC400";
    if (type.includes("console") || type.includes("event wall")) return "#53BF8B";
    if (type.includes("timed-out") || type.includes("missed wall")) return "#FF0000";
    if (type.includes("custom event")) return "magenta";

    return "#ccc";
  }

  defaultColDef: ColDef = {
    sortable: true,
    // filter: true,
    resizable: true,
  };

  // ------------------------ ON CHANGES ------------------------
  ngOnChanges(changes: SimpleChanges) {
    if (!changes["selectedItem"] || !this.selectedItem) return;


    this.selectedEvent = this.selectedItem.eventDetails?.[0] || null;

    if (this.selectedEvent) {
      let imgs: string[] = [];

      // Extract images from videoUrl if any (often used for snapshots)
      const vids = Array.isArray(this.selectedEvent.videoUrl)
        ? this.selectedEvent.videoUrl
        : [this.selectedEvent.videoUrl].filter(Boolean);

      vids.forEach((v: string) => {
        if (v && v.includes('/') && !imgs.includes(v)) imgs.push(v);
      });

      // Extract images from imageUrl field
      if (this.selectedEvent.imageUrl) {
        const urlList = String(this.selectedEvent.imageUrl)
          .split(',')
          .map(u => u.trim())
          .filter(u => u.includes('/') && !imgs.includes(u));
        imgs = [...imgs, ...urlList];
      }

      this.imageUrls = imgs;

      // Handle pending-specific parsing
      if (this.isPending) {
        if (this.selectedEvent.objectName) {
          try {
            const obj = JSON.parse(this.selectedEvent.objectName);
            this.parsedObjects = Object.values(obj);
          } catch (e) {
            this.parsedObjects = [];
          }
        } else {
          this.parsedObjects = [];
        }
      }
    }

    // ✅ Build maps from all available sources
    const userImageMap = new Map<number, string>();
    const userNameMap = new Map<number, string>();
    const userLevelMap = new Map<number, string>();

    // 1. From queueUsers (passed from site context)
    (this.queueUsers || []).forEach((u: any) => {
      const id = Number(u?.userId);
      if (id) {
        if (u?.profileImage) userImageMap.set(id, u.profileImage);
        if (u?.userName) userNameMap.set(id, u.userName);
        if (u?.userLevel) userLevelMap.set(id, u.userLevel);
      }
    });

    // 2. From eventAlarmInfo (from the API response)
    (this.selectedItem.eventAlarmInfo || []).forEach((u: any) => {
      const id = Number(u?.user ?? u?.userId);
      if (id) {
        if (u?.userImage && !userImageMap.has(id)) userImageMap.set(id, u.userImage);
        if (u?.userName && !userNameMap.has(id)) userNameMap.set(id, u.userName);
        if (u?.userLevel && !userLevelMap.has(id)) userLevelMap.set(id, u.userLevel);
      }
    });

    // 3. From eventEscalationInfo (from the API response)
    (this.selectedItem.eventEscalationInfo || []).forEach((u: any) => {
      const id = Number(u?.user ?? u?.userId);
      if (id) {
        if (u?.userImage && !userImageMap.has(id)) userImageMap.set(id, u.userImage);
        if (u?.userName && !userNameMap.has(id)) userNameMap.set(id, u.userName);
        if (u?.userLevel && !userLevelMap.has(id)) userLevelMap.set(id, u.userLevel);
      }
    });

    // ✅ ESCALATION ROWS (uses ProfileImageRendererComponent already)
    const escalationInfo = this.selectedItem.userLevelAlarmInfo || this.selectedItem.eventEscalationInfo || [];
    this.escalationRowData = escalationInfo.map(
      (item: any) => {
        const userId = Number(item?.user ?? item?.userId ?? 0);

        return {
          ...item,
          user: {
            profileImage: this.normalizeAvatarUrl(userImageMap.get(userId) || ""),
            name: item.userName ?? userNameMap.get(userId) ?? String(item.user ?? ""),
            level: item.userLevel ?? userLevelMap.get(userId) ?? "",
          },
          isEditing: false,
          isDuplicate: false,
        };
      }
    );

    // ✅ ALARM ROWS (NOW ALSO uses ProfileImageRendererComponent)
    // IMPORTANT: alarmColumnDefs USER field must be `field: "user"` and `cellRenderer: ProfileImageRendererComponent`
    const alarmInfo = this.isPending ? escalationInfo : (this.selectedItem.eventAlarmInfo || []);
    this.alarmRowData = alarmInfo.map((item: any) => {
      // Pick whatever your API has for alarm user id:
      // try user -> userId -> createdBy -> reviewerId (add/remove as needed)
      const userId = Number(
        item?.user ?? item?.userId ?? item?.createdBy ?? item?.reviewedBy ?? 0
      );

      return {
        ...item,
        user: {
          profileImage: this.normalizeAvatarUrl(userImageMap.get(userId) || ""),
          name: item.userName ?? userNameMap.get(userId) ?? String(item.user ?? ""),
          level: item.userLevel ?? userLevelMap.get(userId) ?? "",
        },
      };
    });

    // ✅ COMMENTS ROWS (uses ProfileImageRendererComponent already)
    this.commentRowData = (this.selectedItem.eventComments || []).map((c: any) => {
      const userId = Number(c?.userId ?? c?.createdBy ?? c?.user ?? 0);

      return {
        ...c,
        user: {
          // prefer comment’s own image, else fall back to queueUsers map
          profileImage: this.normalizeAvatarUrl(
            c.userImage || userImageMap.get(userId) || ""
          ),
          name: c.name || userNameMap.get(userId) || "",
          level: c.level || userLevelMap.get(userId) || "",
        },
        name: c.name || userNameMap.get(userId) || "",
        level: c.level || userLevelMap.get(userId) || "",
        submittedtime: this.formatDateTime(c.submittedTime || new Date()),
        notes: c.notes || "",
      };
    });

    // ✅ ACTIONS TAKEN ROWS
    const actionsTaken = this.selectedItem.actionsTaken || [];
    this.actionsTakenRowData = actionsTaken.map((a: any) => {
      const userId = Number(a?.userId || a?.user || 0);
      return {
        ...a,
        user: {
          profileImage: this.normalizeAvatarUrl(userImageMap.get(userId) || ""),
          name: a.userName || userNameMap.get(userId) || String(userId || ""),
          level: a.userLevel || userLevelMap.get(userId) || "",
        }
      };
    });

    // ✅ Selected event details
    this.selectedEvent = (this.selectedItem.eventDetails || [])[0] || null;

    this.updateFormattedBasicInfo();
  }

  updateFormattedBasicInfo() {
    this.formattedBasicInfoData = this.activeBasicInfoFields.map((field) => {
      let value: any = "--";

      if (field.field === 'cameraCombined') {
        const name = this.selectedEvent?.cameraName || "";
        const id = this.selectedEvent?.cameraId || "";
        value = name && id ? `${name} - ${id}` : (name || id || "--");
      } else {
        value = this.selectedEvent?.[field.field] ?? field.default ?? "--";
      }

      if (field.label.toLowerCase().includes("time") && value !== "--") {
        value = this.formatDateTime(value);
      }

      return { ...field, value };
    });
  }

  trackByBasicInfo(index: number, item: any) {
    return item.field;
  }



  formatDateTime(dateInput: string | Date): string {
    if (!dateInput || dateInput === "--") return String(dateInput || "--");

    // Attempt to standardize string for Safari/cross-browser
    let parsedInput = dateInput;
    if (typeof dateInput === "string") {
      parsedInput = dateInput.replace(" ", "T");
    }

    const d = new Date(parsedInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const pad = (n: number) => n.toString().padStart(2, "0");

    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();

    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  formatTimeOnly(dateInput: string | Date): string {
    if (!dateInput || dateInput === "--") return String(dateInput || "--");

    let parsedInput = dateInput;
    if (typeof dateInput === "string") {
      parsedInput = dateInput.replace(" ", "T");
    }

    const d = new Date(parsedInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const pad = (n: number) => n.toString().padStart(2, "0");
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${hours}:${minutes}:${seconds}`;
  }


  // ------------------------ GRID READY ------------------------
  onGridReady(params: any) {
    this.escalationGridApi = params.api;
    params.api.sizeColumnsToFit();
    // params.columnApi.autoSizeAllColumns();
    this.commentGridApi = params.api; // kept for compatibility
  }

  onCommentGridReady(params: any) {
    params.api.sizeColumnsToFit();
    this.commentGridApi = params.api;
    this.commentGridColumnApi = params.columnApi;
  }

  // ------------------------ COMMENTS GRID (READ-ONLY) ------------------------
  commentColumnDefs: ColDef[] = [
    {
      headerName: "USER",
      field: "user",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      cellRenderer: ProfileImageRendererComponent, // 👈 uses the component
      editable: false,
    },
    {
      headerName: "NAME",
      field: "name",
      editable: false,
      headerClass: "custom-header",
      cellClass: "custom-cell",
    },
    {
      headerName: "LEVEL",
      field: "level",
      editable: false,
      headerClass: "custom-header",
      cellClass: "custom-cell",
    },
    {
      headerName: "SUBMITTED TIME",
      field: "submittedtime",
      editable: false,
      headerClass: "custom-header",
      cellClass: "custom-cell",
    },
    {
      headerName: "NOTES",
      field: "notes",
      editable: false,
      headerClass: "custom-header",
      cellClass: "custom-cell",
    },
  ];

  actionsTakenColumnDefs: ColDef[] = [
    {
      headerName: "USER",
      field: "user",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      cellRenderer: ProfileImageRendererComponent,
      editable: false,
      minWidth: 250,
      flex: 0
    },
    {
      headerName: "MAIL TYPE",
      field: "mailType",
      headerClass: "custom-header",
      cellClass: "custom-cell",
    },
    {
      headerName: "SMS SENT",
      field: "smsSentTime",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      valueFormatter: (params) => this.formatTimeOnly(params.value)
    },
    {
      headerName: "MAIL SENT",
      field: "mailSentTime",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      valueFormatter: (params) => this.formatTimeOnly(params.value)
    },
    {
      headerName: "ACTIONS TAKEN",
      field: "actionsTaken",
      headerClass: "custom-header",
      cellClass: ["custom-cell", "wrap-cell"],
      tooltipField: "actionsTaken",
      wrapText: true,
      autoHeight: true,
      flex: 3,
      minWidth: 250
    },
    {
      headerName: "NOTES",
      field: "notes",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      valueFormatter: (params) => params.value === "null" ? "--" : params.value
    },
    {
      headerName: "STATUS",
      field: "status",
      headerClass: ["custom-header", "center-header"],
      cellClass: ["custom-cell", "center-cell"],
      valueFormatter: (params) => {
        const val = String(params.value).toUpperCase();
        if (val === 'T') return 'Success';
        if (val === 'F') return 'Failed';
        return params.value || "";
      }
    },
    {
      headerName: "MAIL PREVIEW",
      field: "mailPreview",
      headerClass: "custom-header",
      cellClass: "custom-cell",
      cellRenderer: (params: any) => {
        return `<span class="material-symbols-outlined" style="cursor:pointer; color:#1955af; font-size:20px;">mail</span>`;
      },
      onCellClicked: (params: any) => {
        this.openMailPreview(params.event as MouseEvent, params.data);
      },
      maxWidth: 120,
      flex: 0
    }
  ];

  openMailPreview(event: MouseEvent, row: any) {
    this.currentPreviewRow = row;
    this.emailPreviewData = null;
    this.isEmailPreviewLoading = true;
    this.isEmailPreviewView = true; // Switch to preview view

    const eventDetails = this.selectedItem?.eventDetails?.[0];
    if (!eventDetails) {
      this.isEmailPreviewLoading = false;
      return;
    }

    // Helper to find the best available ID from the row or event details
    const findId = (row: any, details: any, primaryKey: string, secondaryKey: string, fallbackKey: string) => {
      const val = row?.[primaryKey] || row?.[secondaryKey] || details?.[primaryKey] || details?.[secondaryKey] || details?.[fallbackKey];
      return (val === undefined || val === null || val === 'undefined') ? null : val;
    };

    const alertTypeId = findId(row, eventDetails, 'alertTagId', 'actionTag', 'actionTagId');
    const subTypeId = findId(row, eventDetails, 'subAlertTagId', 'subActionTag', 'subActionTagId');

    const payload = {
      siteId: eventDetails.siteId,
      siteName: eventDetails.siteName,
      cameraId: eventDetails.cameraId,
      alertTypeId: alertTypeId,
      subTypeId: subTypeId,
      day: this.eventsService.weekdays[
        eventDetails.eventStartTime ? new Date(eventDetails.eventStartTime).getDay() : 0
      ],
      hour: eventDetails.eventStartTime ? new Date(eventDetails.eventStartTime).getHours() : 0,
      currentTime: eventDetails.eventStartTime,
    };

    // 1. Fetch Alert Categories (as requested)
    if (eventDetails.siteId) {
      this.eventsService.getAlertCategoriesForSiteId(eventDetails.siteId).subscribe({
        next: (cats) => { },
        error: (err) => console.error("Error fetching alert categories:", err)
      });
    }

    // 2. Fetch Email Data
    this.eventsService.getEmailDataForVMSEvents(payload).subscribe({
      next: (res: any) => {
        this.emailPreviewData = res?.statusCode === 200 ? res.emailDetails : res;
        this.isEmailPreviewLoading = false;
      },
      error: (err) => {
        console.error("Error fetching email preview data:", err);
        this.isEmailPreviewLoading = false;
      }
    });
  }

  closeEmailPreview() {
    this.isEmailPreviewView = false;
    this.emailPreviewData = null;
  }


}


@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
        <div [style.overflow]="'hidden'" [style.textOverflow]="'ellipsis'">
            <span [style.borderLeft]="'10px solid ' + value()" [style.paddingRight]="'5px'"></span>{{ value() }}
        </div>
    `,
  styles: [
    `
            :host {
                overflow: hidden;
            }
        `,
  ],
})
export class ColourCellRenderer implements ICellRendererAngularComp {
  value = signal<string>('');

  agInit(params: ICellRendererParams): void {
    this.value.set(params.value);
  }

  refresh() {
    return false;
  }
}
