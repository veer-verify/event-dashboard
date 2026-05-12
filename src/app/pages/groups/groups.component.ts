import { Component, OnInit, OnDestroy } from "@angular/core";
import { GridApi, GridReadyEvent, ColDef } from "ag-grid-community";
import { Subscription } from "rxjs";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { GroupsPopupComponent } from "src/app/shared/groups-popup/groups-popup.component";
import { AgGridModule } from "ag-grid-angular";
import { GroupsService } from "./groups.service"; // ✅ Import service
import { QuickFilterModule, ModuleRegistry } from "ag-grid-community";
import { DropdownModule } from "primeng/dropdown";
import { ButtonModule } from "primeng/button";
import { MultiSelectModule } from "primeng/multiselect";
import { DialogModule } from 'primeng/dialog';
import { OverlayPanelModule } from 'primeng/overlaypanel';

import { NotificationService } from 'src/app/shared/notification.service';

import { ProfileImageRendererComponent } from "src/app/shared/renderers/profile-image-renderer.component";

// Register module
ModuleRegistry.registerModules([QuickFilterModule]);

interface SecondEscalatedDetail {
  label: string;
  value: number;
  iconPath?: string;
  color: string;
}

@Component({
  selector: "app-groups",
  templateUrl: "./groups.component.html",
  styleUrls: ["./groups.component.css"],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    DropdownModule,
    ButtonModule,
    GroupsPopupComponent,
    MultiSelectModule,
    ProfileImageRendererComponent,
    DialogModule,
    OverlayPanelModule
  ],
})
export class GroupsComponent implements OnInit, OnDestroy {
  selectedQueueId: number | null = null;
  showInfoDialog: boolean = false;

  currentUser: any = null;   // 👈 add this

  currentDate: Date = new Date();

  selectedDate: Date | null = null;
  private boundResize?: () => void;
  gridApi!: GridApi;
  private apiSub?: Subscription;

  constructor(private groupsService: GroupsService, private notificationService: NotificationService) { }

  ngOnInit() {
    this.selectedDate = new Date();

    // 👇 Read whatever you stored when logging in
    const raw =
      sessionStorage.getItem('verifai_user') ||
      sessionStorage.getItem('verifai_user');

    if (raw) {
      try {
        this.currentUser = JSON.parse(raw);
      } catch (e) {
        console.error('Error parsing stored user data', e);
      }
    }

    // Restore selection from memory
    const savedQueueId = sessionStorage.getItem('selectedQueueId');
    if (savedQueueId) {
      this.selectedQueueId = Number(savedQueueId);
    }


    this.loadAllQueues();
    this.loadFlows();
    this.loadGroups();
  }
  private showSuccess(summary: string, detail?: string) {
    this.notificationService.success(summary, detail);
  }

  private showError(summary: string, detail?: string) {
    this.notificationService.error(summary, detail);
  }

  private showWarn(summary: string, detail?: string) {
    this.notificationService.warn(summary, detail);
  }

  /** Close popups */
  closePopup() {
    this.isPopupVisible = false;
    this.isTablePopupVisible = false;
  }

  searchTerm: string = "";
  rowData: any[] = [];
  allRowData: any[] = []; // ⭐ Master set for filtering
  statusFilter: string = "TOTAL"; // ⭐ Current filter state
  secondEscalatedDetails: SecondEscalatedDetail[] = [];

  isPopupVisible = false;
  isTablePopupVisible = false;
  selectedItem: any = null;
  popupColumnDefs: ColDef[] = [];
  popupRowData: any[] = [];

  selectedFilter: string = "CLOSED";
  currentIndex = 0; // currently selected item index

  goBack() {
    if (this.currentSection.startsWith('flow_') && this.currentSection !== 'flow_list') {
      this.onSectionChange('flow_list');
    } else {
      this.currentSection = 'default';

      // Reset all section states
      this.selectedSiteId = null;
      this.selectedCameraId = null;
      this.selectedCameraIds = [];
      this.sitesDropdown = [];
      this.camerasDropdown = [];
      this.searchUserTerm = "";
      this.selectedUserIds = [];
      this.selectedDept = "";
      this.errorMessage = "";
    }
  }

  nextItem() {
    if (this.rowData.length === 0) return;

    if (this.currentIndex < this.rowData.length - 1) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0; // loop back to start
    }

    this.loadGroupDetails(this.rowData[this.currentIndex].id);
  }

  prevItem() {
    if (this.rowData.length === 0) return;

    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.rowData.length - 1; // loop to last
    }

    this.loadGroupDetails(this.rowData[this.currentIndex].id);
  }

  onFilterTextBoxChanged() {
    if (this.gridApi) {
      this.gridApi.setGridOption("quickFilterText", this.searchTerm);
    }
  }
  quickFilterMatcher = (quickFilterParts: string[], rowText: string) => {
    return quickFilterParts.every((part) => {
      const regex = new RegExp(part, "i"); // case-insensitive
      return regex.test(rowText);
    });
  };

  columnDefs: ColDef[] = [
    {
      headerName: "ID", field: "id", sortable: true, cellStyle: { opacity: "0.5" }, maxWidth: 90, filterParams: {
        buttons: ['reset', 'apply']
      }
    },
    {
      headerName: "NAME", field: "name", sortable: true, minWidth: 150, flex: 2, filterParams: {
        buttons: ['reset', 'apply']
      }
    },
    {
      headerName: "CATEGORY", field: "category", sortable: true, cellStyle: { opacity: "0.5" }, minWidth: 130, flex: 1.5, filterParams: {
        buttons: ['reset', 'apply']
      }
    },

    {
      headerName: "LEVEL",
      field: "level",
      cellStyle: { opacity: "0.5" },
      maxWidth: 100,
      valueGetter: (params) => {
        const levelMap: { [key: string]: string } = {
          "1": "Q",
          "2": "PDQ",
          "3": "DQ",
          "4": "OBQ",
        };
        return levelMap[params.data.level] ?? params.data.level;
      },
      sortable: true,
      filterParams: {
        buttons: ['reset', 'apply']
      }
    },
    {
      headerName: "SITES", field: "site", cellStyle: { opacity: "0.5" }, maxWidth: 90, filterParams: {
        buttons: ['reset', 'apply']
      }
    },
    {
      headerName: "CAMERAS", field: "cameras", cellStyle: { opacity: "0.5" }, maxWidth: 110, filterParams: {
        buttons: ['reset', 'apply']
      }
    },
    {
      headerName: "EMPLOYEES", field: "employees", cellStyle: { opacity: "0.5" }, maxWidth: 120, filterParams: {
        buttons: ['reset', 'apply']
      }
    },
    {
      headerName: "STATUS",
      field: "status",
      headerClass: "custom-header",
      maxWidth: 100,
      cellRenderer: (params: any) => {
        const color = params.value === "ACTIVE" ? "#53BF8B" : "#979797";
        return `
          <span style="display:inline-flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:14px; height:14px; background:${color}; border-radius:50%;"></span>
          </span>
        `;
      },
      filterParams: {
        buttons: ['reset', 'apply']
      }
    },
    {
      headerName: 'MORE INFO',
      maxWidth: 110,
      field: "more",
      cellRenderer: () => `
        <span class="info-icon">
          <img src="assets/information-icon.svg" style="width:20px; height:20px; cursor:pointer;" alt="Info"/>
        </span>
      `,
    },
  ];

  //get levels data
  selectedLevel: any;
  levelsData: any[] = [];

  getLevelsData() {
    this.groupsService.getLevels().subscribe({
      next: (response: any) => {
        // Make sure levelsData is always an array
        this.levelsData = Array.isArray(response.data) ? response.data : [];
      },
      error: (err) => {
        console.error("Error fetching levels", err);
      },
    });
  }

  // New queue model
  newQueue = {
    queueName: "", // bind this to your input
    levelId: null, // bind this to your dropdown
    category: null as string | null,  // ⭐ NEW - category dropdown
  };

  // Flow Management State
  flows: any[] = [];
  groupedFlows: any[] = [];
  loadingDetails: boolean = false;
  loadingCamera: boolean = false; // 👈 Track camera addition
  loadingUser: boolean = false;   // 👈 Track user addition
  allQueues: any[] = [];
  isUpdateMode: boolean = false;
  selectedFlowId: number | null = null;

  newFlow = {
    category: "Console",
    steps: [
      { qId: null, levelId: 1 }
    ]
  };

  // Assignment State
  allSitesForFlow: any[] = [];
  allCamerasForFlow: any[] = [];
  selectedCameraIdsForFlow: string[] = [];
  selectedFlowIdForAssign: number | null = null;
  searchCameraTerm: string = "";
  loadingFlows: boolean = false;

  onFlowManagementClick() {
    this.isUpdateMode = false;
    this.onSectionChange("flow_list");
  }

  loadFlows() {
    if (this.loadingFlows) return;
    this.loadingFlows = true;
    this.flows = [];
    this.groupedFlows = [];

    this.groupsService.getFlows().subscribe({
      next: (res) => {
        this.loadingFlows = false;
        const data = res.data || res.queuesData || res.flowsData || res.flowData || res.flows;
        if (Array.isArray(data)) {
          this.flows = data;
          this.groupFlows();
        } else if (res && typeof res === 'object' && !Array.isArray(res)) {
          // If response itself is an object but doesn't have common keys, maybe it's { flowId: [...], ... }
          // But our groupFlows expects an array of steps.
        }
      },
      error: (err) => {
        this.loadingFlows = false;
        console.error("Error loading flows", err);
      }
    });
  }

  groupFlows() {
    const groups: { [key: number]: any } = {};

    this.flows.forEach(item => {
      const fId = item.flowId || item.FlowId || item.id || item.Id;
      if (fId === undefined || fId === null) return;

      if (!groups[fId]) {
        groups[fId] = {
          flowId: fId,
          category: item.category || item.Category,
          status: item.status || item.Status,
          steps: []
        };
      }

      const stepsSource = item.flow || item.steps;
      if (Array.isArray(stepsSource)) {
        stepsSource.forEach((s: any) => {
          const qName = s.queueName || s.QueueName || s.name || s.qName || s.q_name || s.queue_name || s.qname || s.Queue_Name;
          // If qId is missing, try to find it in allQueues by name
          let qId = s.qId || s.queueId || s.QueueId || s.q_id || s.queue_id || s.qID || s.Qid;
          if (!qId && qName && this.allQueues.length > 0) {
            qId = this.allQueues.find(q => q.label === qName)?.value;
          }

          groups[fId].steps.push({
            qId: qId,
            levelId: s.levelId || s.LevelId || s.level_id || s.Level_Id,
            levelName: s.levelName || s.LevelName,
            queueName: qName
          });
        });
      } else {
        const qName = item.queueName || item.QueueName || item.name || item.qName || item.q_name || item.queue_name || item.qname || item.Queue_Name;
        let qId = item.qId || item.queueId || item.QueueId || item.q_id || item.queue_id || item.qId || item.qID || item.Qid;
        if (!qId && qName && this.allQueues.length > 0) {
          qId = this.allQueues.find(q => q.label === qName)?.value;
        }

        groups[fId].steps.push({
          qId: qId,
          levelId: item.levelId || item.LevelId || item.level_id || item.Level_Id,
          levelName: item.levelName || item.LevelName,
          queueName: qName
        });
      }
    });

    this.groupedFlows = Object.values(groups).map(g => {
      // Deduplicate steps if necessary (in case of nested + redundant grouping)
      const uniqueSteps = Array.from(new Set(g.steps.map((s: any) => JSON.stringify(s))))
        .map(s => JSON.parse(s as string));

      g.steps = uniqueSteps.sort((a: any, b: any) => (a.levelId || 0) - (b.levelId || 0));

      // 🔹 Pre-calculate path string for dropdown context
      g.pathString = g.steps.map((s: any) => s.queueName).join(' > ');

      return g;
    });
  }



  loadAllQueues() {
    this.groupsService.getGroups().subscribe({
      next: (res) => {
        if (res?.status === "Success" && Array.isArray(res.queuesData)) {
          this.allQueues = res.queuesData.map((q: any) => ({
            label: q.queueName,
            value: q.queueId,
            levelId: q.levelId,
            category: q.category || q.queueCategory
          }));
          // Re-group flows to resolve IDs if they were missing
          if (this.flows.length > 0) {
            this.groupFlows();
          }
        }
      }
    });
  }

  addFlowStep() {
    if (this.newFlow.steps.length >= 4) {
      this.showWarn("Flow Builder", "Maximum 4 levels allowed");
      return;
    }
    const nextLevel = this.newFlow.steps.length + 1;
    this.newFlow.steps.push({ qId: null, levelId: nextLevel });
  }

  removeFlowStep(index: number) {
    this.newFlow.steps.splice(index, 1);
    // Re-index levels
    this.newFlow.steps.forEach((step, i) => step.levelId = i + 1);
  }

  saveFlow() {
    if (!this.newFlow.category || this.newFlow.steps.some(s => !s.qId)) {
      this.showError("Flow Builder", "Please complete all fields");
      return;
    }

    const payload = {
      category: this.newFlow.category,
      createdBy: this.currentUser?.UserId || 0,
      flow: this.newFlow.steps
    };

    const obs = this.isUpdateMode
      ? this.groupsService.updateFlow({
        flowId: this.selectedFlowId,
        category: this.newFlow.category,
        modifiedBy: this.currentUser?.UserId || 0,
        flow: this.newFlow.steps
      })
      : this.groupsService.createFlow(payload);

    obs.subscribe({
      next: (res) => {
        this.showSuccess("Flow Builder", res.message || "Flow saved successfully");
        this.onFlowManagementClick();
      },
      error: (err) => this.showError("Flow Builder", err.error?.message || "Failed to save flow")
    });
  }

  editFlow(flow: any) {
    this.isUpdateMode = true;
    this.selectedFlowId = flow.flowId;
    this.newFlow = {
      category: flow.category,
      steps: flow.steps.map((s: any) => {
        const rawQId = s.qId || s.queueId || s.QueueId || s.q_id || s.queue_id || s.qID || s.Qid;
        return {
          qId: rawQId ? Number(rawQId) : null,
          levelId: s.levelId || s.LevelId || s.level_id || s.Level_Id
        };
      })
    };
    this.onSectionChange("flow_builder");
    this.loadAllQueues();
  }

  confirmInactivateFlow(flowId: number) {
    if (confirm("Are you sure you want to deactivate this flow?")) {
      this.groupsService.inactivateFlow(flowId, this.currentUser?.UserId || 0).subscribe({
        next: (res) => {
          this.showSuccess("Flow Management", res.message || "Flow inactivated");
          this.loadFlows();
        },
        error: (err) => {
          this.showError("Flow Management", err.error?.message || "Failed to inactivate flow");
        }
      });
    }
  }

  openAssignFlow() {
    this.onSectionChange("flow_assign");
    this.loadFlows();
    this.loadSitesDropdown();
  }

  onSiteSelectForAssign(siteId: number) {
    this.groupsService.getCameras(siteId).subscribe({
      next: (res) => {
        if (res?.data) {
          // Merge cameras but avoid duplicates
          const newCams = res.data.filter((nc: any) => !this.allCamerasForFlow.some(oc => oc.cameraId === nc.cameraId));
          this.allCamerasForFlow.push(...newCams);
        }
      }
    });
  }

  get filteredCamerasForFlow() {
    if (!this.searchCameraTerm) return this.allCamerasForFlow;
    const term = this.searchCameraTerm.toLowerCase();
    return this.allCamerasForFlow.filter(c =>
      c.cameraName?.toLowerCase().includes(term) ||
      c.cameraId?.toLowerCase().includes(term)
    );
  }

  toggleCameraSelectionForFlow(cameraId: string, checked: boolean) {
    if (checked) {
      if (!this.selectedCameraIdsForFlow.includes(cameraId)) {
        this.selectedCameraIdsForFlow.push(cameraId);
      }
    } else {
      this.selectedCameraIdsForFlow = this.selectedCameraIdsForFlow.filter(id => id !== cameraId);
    }
  }

  assignFlow() {
    if (!this.selectedFlowIdForAssign || !this.selectedCameraIdsForFlow.length) {
      this.showError("Assign Flow", "Please select a flow and at least one camera");
      return;
    }

    const payload = {
      flowId: this.selectedFlowIdForAssign,
      cameraIds: this.selectedCameraIdsForFlow,
      modifiedBy: this.currentUser?.UserId || 0
    };

    this.groupsService.assignFlowToCameras(payload).subscribe({
      next: (res) => {
        this.showSuccess("Assign Flow", res.message || "Flow assigned successfully");
        this.onFlowManagementClick();
      },
      error: (err) => this.showError("Assign Flow", err.error?.message || "Failed to assign flow")
    });
  }

  getAvailableQueues(currentQId: any) {
    const assignedInOtherFlows = new Set<number>();
    this.groupedFlows.forEach(flow => {
      if (this.isUpdateMode && flow.flowId === this.selectedFlowId) return;
      flow.steps.forEach((s: any) => {
        if (s.qId) assignedInOtherFlows.add(Number(s.qId));
      });
    });

    const assignedInThisFlow = new Set<number>();
    this.newFlow.steps.forEach((s: any) => {
      if (s.qId && s.qId != currentQId) {
        assignedInThisFlow.add(Number(s.qId));
      }
    });

    return this.allQueues.filter(q => {
      const qVal = Number(q.value);

      // 🌟 ALWAYS include the current selection for this step
      if (currentQId != null && qVal == Number(currentQId)) return true;

      // 1. Must not be assigned in other flows
      if (assignedInOtherFlows.has(qVal)) return false;

      // 2. Must not be already picked in this flow (except for this step)
      if (assignedInThisFlow.has(qVal)) return false;

      // 3. Must match the current flow category
      if (this.newFlow.category && q.category && q.category !== this.newFlow.category) {
        return false;
      }

      return true;
    });
  }

  getQueueName(qId: number | null): string {
    if (qId === null) return "";
    return this.allQueues.find(q => q.value == qId)?.label || "Unknown";
  }

  onCreateQueueClick() {
    this.currentSection = "queue";
    this.getLevelsData();
  }

  createQueue() {
    if (
      !this.newQueue.queueName ||
      !this.newQueue.levelId ||
      !this.newQueue.category
    ) {
      this.showError('Create Queue', 'Queue Name, Level, and Category are required');
      return;
    }

    const payload = {
      queueName: this.newQueue.queueName,
      levelId: this.newQueue.levelId,
      queueCategory: this.newQueue.category,
      remarks: "",
      createdBy: this.currentUser?.UserId || 0,
    };

    this.groupsService.postQueues(payload).subscribe({
      next: (res: any) => {
        // removed extra flag reset for this method for now to avoid confusion
        const msg =
          res?.message ||
          res?.msg ||
          res?.statusMessage ||
          'Queue created successfully';

        const newId =
          res?.queueId ??
          res?.data?.queueId ??
          res?.createdQueueId;

        this.newQueue = {
          queueName: "",
          levelId: null,
          category: null,
        };

        this.goBack();

        if (newId) {
          this.selectedQueueId = newId;
          //        


          this.loadGroups(newId);
        } else {
          this.loadGroups(this.selectedQueueId ?? undefined);
        }

        this.showSuccess('Create Queue', msg);
      },
      error: (err: any) => {
        const msg =
          err?.error?.message ||
          err?.error?.msg ||
          'Failed to create queue';
        console.error("Error creating queue:", err);
        this.showError('Create Queue Failed', msg);
      },
    });
  }





  onAddClick() {
    this.isPopupVisible = true;
  }

  // Check if all visible (filtered) users are selected
  areAllFilteredUsersSelected(): boolean {
    const filterableIds = this.filteredUsers
      .filter((u) => u.canBeAdded !== 'F')
      .map((u) => u.userId);
    return (
      filterableIds.every((id) => this.selectedUserIds.includes(id)) &&
      filterableIds.length > 0
    );
  }

  // Toggle select/deselect all visible users
  toggleSelectAll(isChecked: boolean) {
    const filterableIds = this.filteredUsers
      .filter((u) => u.canBeAdded !== 'F')
      .map((u) => u.userId);

    if (isChecked) {
      // Add all filterable users that are not already selected
      filterableIds.forEach((id) => {
        if (!this.selectedUserIds.includes(id)) {
          this.selectedUserIds.push(id);
        }
      });
    } else {
      // Remove all filterable users from selected
      this.selectedUserIds = this.selectedUserIds.filter(
        (id) => !filterableIds.includes(id)
      );
    }
  }

  defaultColDef: ColDef = { resizable: true, filter: true, flex: 1, minWidth: 80 };

  onQueueStatusChanged(queueId: number) {
    this.loadGroups(queueId);          // 👉 calls getQueuesDetails_1_0 and rebuilds rowData + cards
    // if (queueId) this.loadGroupDetails(queueId); // keep right pane in sync too
  }

  // Pass an optional queue id you want to preserve
  loadGroups(preserveId?: number) {
    const desiredId = preserveId ?? this.selectedQueueId ?? undefined;

    this.apiSub = this.groupsService.getGroups().subscribe({
      next: (res) => {
        if (res?.status === "Success" && Array.isArray(res.queuesData)) {
          this.allRowData = res.queuesData.map((g: any) => ({
            id: g.queueId,
            category: g.category,
            name: g.queueName,
            level: g.levelId,
            site: g.sites,
            cameras: g.cameras,
            employees: g.employees,
            status: g.status?.toUpperCase(),
            more: true,
          }));

          // Apply current filter (disable auto-select because we handle it below)
          this.applyStatusFilter(false);

          const total = res.queuesData.length;
          const active = res.queuesData.filter((g: any) => g.status?.toUpperCase() === "ACTIVE").length;
          const inactive = total - active;

          this.secondEscalatedDetails = [
            { label: "TOTAL", value: total, color: "#ed3237" },
            { label: "ACTIVE", value: active, color: "#53BF8B" },
            { label: "INACTIVE", value: inactive, color: "#979797" },
          ];

          // 👉 Only load details for the preserved id if it still exists;
          //    else fall back to first (if any)
          let idToOpen = desiredId && this.rowData.some(r => r.id === desiredId)
            ? desiredId
            : (this.rowData[0]?.id);

          if (idToOpen != null) {
            this.currentIndex = Math.max(0, this.rowData.findIndex(r => r.id === idToOpen));
            // important: do NOT call loadGroupDetails anywhere else now
            this.loadGroupDetails(idToOpen);
          }
        }
      },
      error: (err) => console.error("Failed to load groups:", err),
    });
  }

  onUserInactivated(queueId: number) {
    // Reload group details after user is inactivated
    this.loadGroupDetails(queueId);

    // Optionally refresh your main table
    // this.loadAllGroups(); // or whatever method reloads the table
  }

  setStatusFilter(filter: string) {
    this.statusFilter = filter;
    this.applyStatusFilter(true); // User changed filter -> auto-select first row
  }

  applyStatusFilter(autoSelectFirst: boolean = true) {
    if (this.statusFilter === "TOTAL") {
      this.rowData = [...this.allRowData];
    } else {
      this.rowData = this.allRowData.filter(r => r.status === this.statusFilter);
    }

    // 🔹 Optionally show the first row details when the filter changes
    if (autoSelectFirst && this.rowData.length > 0) {
      this.loadGroupDetails(this.rowData[0].id);
      this.currentIndex = 0;
    } else {
      this.selectedItem = null;
      this.selectedQueueId = null;
      this.currentIndex = -1;
    }
  }

  /** Load second API and send data to popup */
  loadGroupDetails(queueId: number) {
    this.selectedQueueId = queueId;                 // 👈 remember selection
    sessionStorage.setItem('selectedQueueId', String(queueId));

    // 🔹 Ensure we switch back to the default summary view when a new row is selected
    this.currentSection = 'default';
    this.loadingDetails = true; // 👈 Start loading

    this.groupsService.getGroupSitesAndUsers(queueId).subscribe({
      next: (res) => {
        this.loadingDetails = false; // 👈 Stop loading
        const baseData = this.rowData.find(r => r.id === queueId);
        this.selectedItem = {
          ...baseData,
          groupSites: res.queuesData || [],
          groupUsers: res.queueUsers || [],
          id: queueId
        };
        this.isTablePopupVisible = true;
      },
      error: (err) => {
        this.loadingDetails = false; // 👈 Stop loading on error
        console.error("Failed to load group sites/users:", err);
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    const resizeAll = () => {
      const ids = this.gridApi.getColumns()?.map((col) => col.getColId()) ?? [];
      this.gridApi.autoSizeColumns(ids, false);
      this.gridApi.sizeColumnsToFit();
    };
    setTimeout(resizeAll);
    this.boundResize = () => resizeAll();
    window.addEventListener("resize", this.boundResize);
    this.gridApi.addEventListener("firstDataRendered", resizeAll);
  }

  onCellClicked(event: any) {
    if (!event?.data) return;



    const target = event.event?.target as HTMLElement | null;
    const clickedMoreIcon = !!target?.closest(".info-icon");

    this.currentIndex = event.rowIndex ?? this.rowData.findIndex(r => r.id === event.data.id);

    // If they hit the "more" icon, you could do extra work here…
    if (clickedMoreIcon) {
      // e.g., open a context menu, then load details
      // openContextMenu(event);
    }

    // Always load details on any cell click

    this.loadGroupDetails(event.data.id);
  }



  users: any[] = [];
  selectedUserIds: number[] = [];
  departments: any[] = [];
  selectedDept: string = "";
  userselect: boolean = true;
  toggleUserSelection(userId: number, isChecked: boolean) {
    if (isChecked) {
      if (!this.selectedUserIds.includes(userId))
        this.selectedUserIds.push(userId);
    } else {
      this.selectedUserIds = this.selectedUserIds.filter((id) => id !== userId);
    }
  }

  // Employee search & pagination
  searchUserTerm: string = "";
  currentPage: number = 1;
  pageSize: number = 8; // number of users per page

  get filteredUsers() {
    if (this.searchUserTerm) {
      const term = this.searchUserTerm.toLowerCase();
      return this.users.filter(
        (u) =>
          u?.userName?.toLowerCase().includes(term) ||
          u?.email?.toLowerCase().includes(term) ||
          u?.userContact?.toLowerCase().includes(term)
      );
    }
    return this.users;
  }

  get totalPages() {
    return Math.ceil(
      (this.searchUserTerm
        ? this.users.filter(
          (u) =>
            u.userName
              .toLowerCase()
              .includes(this.searchUserTerm.toLowerCase()) ||
            u.email
              .toLowerCase()
              .includes(this.searchUserTerm.toLowerCase()) ||
            u.userContact
              .toLowerCase()
              .includes(this.searchUserTerm.toLowerCase())
        ).length
        : this.users.length) / this.pageSize
    );
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  errorMessage: string = ""; // Add this at the top of your component
  addSelectedUsers() {
    if (!this.selectedUserIds.length) {
      this.errorMessage = "Please select at least one user.";
      this.showError('Add Employees', this.errorMessage);
      return;
    }

    const category = this.selectedItem?.category;
    let routingType = "";
    if (category === "Console" || category === "Timed-Out") {
      routingType = "console";
    } else if (category === "Manual") {
      routingType = "vms";
    }

    const payload = {
      queueId: this.selectedItem?.id || 0,
      userId: this.selectedUserIds,
      createdBy: this.currentUser?.UserId || 0,
      routingType: routingType
    };

    this.loadingUser = true;
    this.groupsService.addUsersToQueue(payload).subscribe({
      next: (res) => {
        this.loadingUser = false;
        const msg =
          res?.message ||
          res?.msg ||
          res?.statusMessage ||
          'Employees added successfully';

        this.selectedUserIds = [];
        this.errorMessage = "";
        this.goBack();
        this.loadGroups();

        this.showSuccess('Add Employees', msg);
      },
      error: (err) => {
        this.loadingUser = false;
        const msg =
          err?.error?.message ||
          err?.error?.msg ||
          'Failed to add employees';
        console.error("Error adding users:", err);
        this.errorMessage = "Failed to add users. Please try again.";
        this.showError('Add Employees Failed', msg);
      },
    });
  }


  selectedCameraIds: string[] = [];

  addSiteCamera() {
    if (!this.selectedItem || !this.selectedSiteId || !this.selectedCameraIds.length) {
      console.warn("Form is incomplete: select queue, site, and at least one camera");
      this.showError('Add Site & Cameras', 'Please select queue, site, and at least one camera.');
      return;
    }

    const payload = {
      queueId: this.selectedItem.id,
      siteId: this.selectedSiteId,
      cameraIds: this.selectedCameraIds,
      createdBy: this.currentUser?.UserId,
    };

    this.loadingCamera = true; // 👈 Start loading

    this.groupsService.postSiteCamera(payload).subscribe({
      next: (res) => {
        this.loadingCamera = false;
        const msg =
          res?.message ||
          res?.msg ||
          res?.statusMessage ||
          'Site & cameras added successfully';

        this.selectedSiteId = null;
        this.selectedCameraIds = [];
        this.camerasDropdown = [];
        this.goBack();
        this.loadGroups();

        this.showSuccess('Add Site & Cameras', msg);
      },
      error: (err) => {
        this.loadingCamera = false;
        const msg =
          err?.error?.message ||
          err?.error?.msg ||
          'Failed to add site & cameras';
        console.error("Error adding site & cameras:", err);
        this.showError('Add Site & Cameras Failed', msg);
      },
    });
  }


  sites: any[] = []; // initially empty
  showPopup = false;

  // Selected site and camera
  selectedSiteId: number | null = null;
  selectedCameraId: string | null = null;

  // Dropdown data
  sitesDropdown: any[] = [];
  camerasDropdown: any[] = [];

  openPopup(item: any) {
    this.selectedItem = item; // store which item this popup is for
    this.showPopup = !this.showPopup; // toggle popup
  }

  onSectionChange(section: string) {
    this.currentSection = section;

    if (section === "camera") {
      // 🔄 Every time you go to Site & Camera, start with a clean form
      this.selectedSiteId = null;
      this.selectedCameraId = null;
      this.selectedCameraIds = [];
      this.sitesDropdown = [];
      this.camerasDropdown = [];

      this.loadSitesDropdown();
    } else if (section === "employee") {
      // 🔄 Every time you go to Employee, reset selection & filters
      this.searchUserTerm = "";
      this.selectedUserIds = [];
      this.selectedDept = "";
      this.errorMessage = "";
      this.loadDepartments();
      this.loadUsers();
    }
    else if (section === "queue") {
      // 🔄 Reset create queue form
      this.newQueue = {
        queueName: "",
        levelId: null,
        category: null,
      };
      this.getLevelsData();
    }
    else if (section === "flow_list") {
      this.loadAllQueues();
      this.loadFlows();
    }
    else if (section === "flow_builder") {
      this.loadAllQueues();
      if (!this.isUpdateMode) {
        this.newFlow = {
          category: "Console",
          steps: [{ qId: null, levelId: 1 }]
        };
      }
    }
    else if (section === "flow_assign") {
      this.loadFlows();
      this.loadSitesDropdown();
    }
  }



  // Load sites when popup opens
  loadSitesDropdown() {
    this.groupsService.getSites().subscribe({
      next: (res: any) => {
        this.sitesDropdown = res.data.map((s: any) => ({
          label: `${s.siteId} - ${s.siteName}`,   // 👈 ID + Name
          value: s.siteId,
        }));
      },
      error: (err) => console.error("Error fetching sites:", err),
    });
  }

  loadDepartments() {
    this.groupsService.getDepartments().subscribe({
      next: (res: any) => {
        if (res?.status === "success" && Array.isArray(res.departments)) {
          this.departments = res.departments.map((d: any) => ({
            label: d.department,
            value: d.department,
          }));
        } else {
          this.departments = [];
        }
      },
      error: (err) => console.error("Error fetching departments:", err),
    });
  }

  onDepartmentChange() {
    this.loadUsers();
  }

  loadUsers() {
    this.groupsService.getUsersByDepartment(this.selectedDept).subscribe({
      next: (res: any) => {
        // Correctly map the userDetails array and remove duplicates by userId
        const rawUsers = Array.isArray(res.userDetails) ? res.userDetails : [];
        const seenIds = new Set();
        this.users = rawUsers.filter((user: any) => {
          if (seenIds.has(user.userId)) {
            return false;
          }
          seenIds.add(user.userId);
          return true;
        });
        this.selectedUserIds = []; // reset selection
      },
      error: (err) => console.error("Error fetching users:", err),
    });
  }

  // ⭐ NEW: Static categories for queues
  queueCategories = [
    { label: 'Console', value: 'Console' },
    { label: 'Manual', value: 'Manual' },
  ];


  // Load cameras based on selected site
  onSiteChange(siteId: number) {
    this.selectedSiteId = siteId;
    this.selectedCameraId = null;
    this.selectedCameraIds = []; // clear previous camera selection

    this.groupsService.getCameras(siteId).subscribe({
      next: (res: any) => {
        const cams = Array.isArray(res.data) ? res.data : [];

        this.camerasDropdown = cams.map((c: any) => ({
          label: `${c.cameraId} - ${c.cameraName || c.name || 'Camera'}`,
          value: c.cameraId,
        }));
      },
      error: (err) => console.error("Error fetching cameras:", err),
    });
  }


  cameras = [
    { id: 1, name: "Camera 1" },
    { id: 2, name: "Camera 2" },
  ];

  currentSection: string = "default"; // default = normal right section




  formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d
      .toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
      })
      .replace("GMT", "CT");
  }

  localeText = {
    sortAscending: "",
    sortDescending: "",
    sortUnSort: "",
    columnMenu: "",
    ariaLabelSortAscending: "",
    ariaLabelSortDescending: "",
    ariaLabelSortNone: "",
    ariaLabelColumnMenu: "",
  };

  getLevelLabel(levelId: any): string {
    const id = Number(levelId);
    if (id === 1) return 'Q';
    if (id === 2) return 'PDQ';
    if (id === 3) return 'DQ';
    if (id === 4) return 'OBQ';
    return 'L' + id;
  }

  ngOnDestroy() {
    if (this.boundResize)
      window.removeEventListener("resize", this.boundResize);
    if (this.apiSub) this.apiSub.unsubscribe();
  }
}
