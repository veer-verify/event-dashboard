import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnInit,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatNativeDateModule } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { GroupsService } from "src/app/pages/groups/groups.service";
import { ImagePipe } from "src/app/shared/image.pipe";
import { NotificationService } from "src/app/shared/notification.service";
import { ProfileImageRendererComponent } from "src/app/shared/renderers/profile-image-renderer.component";

interface DisplayCamera {
  cameraId: string | number;
  cameraName: string;
  status: string;
  queueSitesId: number;
  queueId: number;
  flowId?: number | null; // 👈 Add this
}

interface DisplaySite {
  siteId: string | number;
  siteName: string;
  queueId: number;
  status: string;
  queueCamerasCount: number;
  totalCamerasCount: number;
  cameras: DisplayCamera[];
  expanded: boolean;
}

interface DisplayUser {
  userId: number | string;
  User_Name?: string;
  userName?: string;
  email: string;
  status: string;
  profileImage?: string | null;
  profileImageUrl?: string | null;
  routingType?: string | null;
  routingQueueId?: number | null;
}

@Component({
  selector: "app-groups-popup",
  templateUrl: "./groups-popup.component.html",
  styleUrls: ["./groups-popup.component.css"],
  standalone: true,
  imports: [
    FormsModule,
    MatNativeDateModule,
    MatDatepickerModule,
    CommonModule,
    HttpClientModule,
    ProfileImageRendererComponent,
  ],
})
export class GroupsPopupComponent implements OnChanges, OnInit {
  @Input() isVisible = false;
  @Input() selectedItem: any;
  @Input() selectedDate: Date | null = null;
  @Input() sites: any[] = [];
  @Input() camera: any[] = [];
  @Input() data: any;
  @Input() flows: any[] = [];
  @Input() allQueues: any[] = [];
  @Input() loading: boolean = false; // 👈 Add loading input

  @Output() sectionChange = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();
  @Output() openPopupEvent = new EventEmitter<any>();
  @Output() refreshRequested = new EventEmitter<number>();

  get isActive(): boolean {
    return (this.data?.status ?? "").toString().toLowerCase() === "active";
  }

  get filteredRoutingQueues(): any[] {
    return this.allQueues.filter(q => q.category === 'Console' && q.level === 2);
  }

  showPopup = false;
  selectedFlowId: number | null = null;
  loadingAssign: boolean = false;

  sitesDisplay: DisplaySite[] = [];
  usersDisplay: DisplayUser[] = [];

  currentUser: any = null;

  constructor(
    private groupsService: GroupsService,
    private notificationService: NotificationService,
  ) { }

  ngOnInit(): void {
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

  private showSuccess(summary: string, detail?: string) {
    this.notificationService.success(summary, detail);
  }

  private showError(summary: string, detail?: string) {
    this.notificationService.error(summary, detail);
  }

  ngOnChanges(): void {
    if (this.data) {
      this.selectedFlowId = null; // 👈 Reset selection on data change
      this.updateSitesAndUsers(this.data);
    }
  }

  togglePopup() {
    this.showPopup = !this.showPopup;
    this.openPopupEvent.emit(this.data);
  }

  openPopup(groupData: any) {
    this.data = groupData;
    this.showPopup = true;
  }

  openSection(section: string) {
    this.sectionChange.emit(section);
    this.showPopup = false;
  }

  onStatusToggle(event: Event) {
    if (!this.data || !this.data.id) return;

    this.notificationService
      .confirm(`This action will disable all queues and remove queue access for users.`,{acceptLabel:"Yes",rejectLabel:"No"})
      .then((res: any) => {
        const input = event.target as HTMLInputElement;
        const isActive = input.checked;
        const status = isActive ? "ACTIVE" : "INACTIVE";
        const modifiedBy = this.currentUser?.UserId || 0;

        if (res) {
          this.groupsService
            .toggleQueueStatus(this.data.id, status, modifiedBy)
            .subscribe({
              next: (res) => {
                this.data.status = status;
                this.refreshRequested.emit(this.data.id);
                this.showSuccess("Update Queue Status", res.message || `Queue marked as ${status}`);
              },
              error: (err) => {
                input.checked = !isActive;
                this.showError("Update Queue Status Failed", err.error?.message || "Failed");
              },
            });
        } else {
          input.checked = !isActive;
        }
      });
  }

  assignFlowToAllCameras() {
    if (!this.selectedFlowId) {
      this.showError("Flow Assignment", "Please select a flow first");
      return;
    }

    // Extract all camera IDs from all sites
    const allCameraIds: string[] = [];
    this.sitesDisplay.forEach(site => {
      site.cameras.forEach(cam => {
        if (cam.cameraId) allCameraIds.push(String(cam.cameraId));
      });
    });

    if (allCameraIds.length === 0) {
      this.showError("Flow Assignment", "No cameras found in this queue to assign");
      return;
    }

    this.loadingAssign = true;
    const payload = {
      cameraIds: allCameraIds,
      flowId: this.selectedFlowId,
      modifiedBy: this.currentUser?.UserId || 0
    };

    this.groupsService.assignFlowToCameras(payload).subscribe({
      next: (res) => {
        this.loadingAssign = false;
        this.showSuccess("Flow Assignment", res.message || "Flow assigned successfully");
        this.selectedFlowId = null;

        // 🔹 Refresh the camera list to show updated flow IDs
        this.groupsService.getGroupSitesAndUsers(this.data.id).subscribe({
          next: (refreshRes) => {
            this.updateSitesAndUsers(refreshRes);
            this.refreshRequested.emit(this.data.id);
          }
        });
      },
      error: (err) => {
        this.loadingAssign = false;
        this.showError("Flow Assignment Failed", err.error?.message || "Failed to assign flow");
      }
    });
  }

  getFlowPath(flowId: number | null | undefined): string {
    if (!flowId) return '';
    const flow = this.flows.find(f => f.flowId == flowId);
    return flow ? flow.pathString : `Flow ${flowId}`;
  }

  formatRoutingType(type: string | null | undefined): string {
    if (!type) return '';
    const t = type.toLowerCase();
    if (t === 'vms') return 'LIVE-VMS -> LIVE-VMS';
    if (t === 'console') return 'LIVE-VMS -> EVENTS-CONSOLE';
    return type.toUpperCase();
  }

  onRoutingTypeChange(user: DisplayUser) {
    if (!this.data?.id || !user.userId || !user.routingType) return;

    // Reset routingQueueId if routingType is vms
    if (user.routingType === 'vms') {
      user.routingQueueId = null;
    }

    const payload = {
      queueId: this.data.id,
      userId: user.userId,
      routingType: user.routingType,
      routingQueueId: user.routingQueueId || null
    };

    this.groupsService.updateQueueUserRoutingType(payload).subscribe({
      next: (res) => {
        this.showSuccess("Update Routing Type", res.message || "Routing type updated successfully");
      },
      error: (err) => {
        this.showError("Update Routing Type Failed", err.error?.message || "Failed to update routing type");
      }
    });
  }

  toggleSiteExpand(site: DisplaySite) {
    site.expanded = !site.expanded;
  }

  async onSiteDelete(site: DisplaySite, event: MouseEvent) {
    event.stopPropagation();
    const confirmed = await this.notificationService.confirm("Are you sure you want to remove this site from the queue?");
    if (confirmed) this.inactivateSite(site.siteId, this.data.id);
  }

  async onCameraDelete(site: DisplaySite, cam: DisplayCamera, event: MouseEvent) {
    event.stopPropagation();
    const confirmed = await this.notificationService.confirm("Are you sure you want to remove this camera?");
    if (confirmed) this.inactivateCamera(cam.cameraId, cam.queueSitesId, this.data.id);
  }

  async onUserDelete(user: DisplayUser) {
    const confirmed = await this.notificationService.confirm("Are you sure you want to remove this employee?");
    if (confirmed) this.inactivateUser(user.userId as number, this.data.id);
  }

  inactivateCamera(cameraId: string | number, queueSitesId: number, queueId: number) {
    const modifiedBy = this.currentUser?.UserId || 0;
    this.groupsService.inactivateQueuesCamera(String(cameraId), queueSitesId, modifiedBy).subscribe({
      next: (res: any) => {
        this.groupsService.getGroupSitesAndUsers(queueId).subscribe(refreshRes => {
          this.updateSitesAndUsers(refreshRes);
          this.refreshRequested.emit(queueId);
          this.showSuccess("Remove Camera", res.message || "Success");
        });
      },
      error: (err) => this.showError("Remove Camera Failed", err.error?.message || "Error")
    });
  }

  inactivateSite(siteId: number | string, queueId: number) {
    const modifiedBy = this.currentUser?.UserId || 0;
    this.groupsService.inactivateQueuesSite(Number(siteId), queueId, modifiedBy).subscribe({
      next: (res) => {
        this.groupsService.getGroupSitesAndUsers(queueId).subscribe(refreshRes => {
          this.updateSitesAndUsers(refreshRes);
          this.refreshRequested.emit(queueId);
          this.showSuccess("Remove Site", res.message || "Success");
        });
      },
      error: (err) => this.showError("Remove Site Failed", err.error?.message || "Error")
    });
  }

  inactivateUser(userId: number, queueId: number) {
    const modifiedBy = this.currentUser?.UserId || 0;
    this.groupsService.inactivateQueuesUser(userId, queueId, modifiedBy).subscribe({
      next: (res) => {
        this.groupsService.getGroupSitesAndUsers(queueId).subscribe(refreshRes => {
          this.updateSitesAndUsers(refreshRes);
          this.refreshRequested.emit(queueId);
          this.showSuccess("Remove Employee", res.message || "Success");
        });
      },
      error: (err) => this.showError("Remove Employee Failed", err.error?.message || "Error")
    });
  }

  private updateSitesAndUsers(res: any) {
    const queueUsers = res.groupUsers || res.queueUsers || [];
    const queuesData = res.groupSites || res.queuesData || [];

    this.usersDisplay = queueUsers.map((user: any) => ({
      userId: user.userId || "N/A",
      User_Name: user.User_Name || null,
      userName: user.userName || null,
      email: user.email || "N/A",
      status: user.status || "N/A",
      profileImage: user.profileImage || null,
      profileImageUrl: user.profileImageUrl || null,
      routingType: user.routingType || null,
      routingQueueId: user.routingQueueId || null,
    }));

    this.sitesDisplay = queuesData.map((site: any) => {
      const cameras = Array.isArray(site.cameraInfo)
        ? site.cameraInfo.map((cam: any) => ({
          cameraId: cam.cameraId,
          cameraName: cam.cameraName || "Unnamed Camera",
          status: cam.status || "ACTIVE",
          queueSitesId: cam.queueSitesId ?? site.queueSitesId,
          queueId: site.queueId,
          flowId: cam.eventsLevelQueueFlowId || cam.flowId || null, // 👈 Map the new field
        }))
        : [];

      return {
        siteId: site.siteId || "N/A",
        siteName: site.siteName || "N/A",
        queueId: site.queueId || "N/A",
        status: site.status || "N/A",
        queueCamerasCount: site.queueCamerasCount ?? 0,
        totalCamerasCount: site.totalCamerasCount ?? 0,
        cameras,
        expanded: false,
      };
    });
  }

  closePopup() {
    this.close.emit();
  }
}
