import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, Subject, of } from "rxjs";
import { shareReplay, tap } from "rxjs/operators";
import { environment } from "src/environments/environment";
import * as moment from "moment";
import { DatePipe } from "@angular/common";

@Injectable({
  providedIn: "root",
})
export class EventsService {
  private pendingCountsSocket: WebSocket | null = null;
  private pendingCountsReconnectTimer: any = null;
  public pendingCountsData$ = new Subject<any>();
  constructor(
    private datePipe: DatePipe,
    private http: HttpClient,
  ) { }

  private alertCategoriesCache = new Map<number, Observable<any>>();
  private emailDataCache = new Map<string, Observable<any>>();
  private eventMoreInfoCache = new Map<number, Observable<any>>();
  
  public clearCache(): void {
    this.alertCategoriesCache.clear();
    this.emailDataCache.clear();
    this.eventMoreInfoCache.clear();
  }


  startPendingCountsWebSocket(): void {
    if (this.pendingCountsSocket) {
      return;
    }

    const wsUrl = `${environment.mqApiBaseUrl}/wsEventsPendingCounts_1_0`
      .replace("https://", "wss://")
      .replace("http://", "ws://");


    this.pendingCountsSocket = new WebSocket(wsUrl);

    this.pendingCountsSocket.onmessage = (event) => {
      try {
        const res = JSON.parse(event.data);
        this.pendingCountsData$.next(res);
      } catch (err) {
        console.error("Failed to parse WebSocket message", err);
      }
    };

    this.pendingCountsSocket.onerror = () => {
      this.stopPendingCountsWebSocket();
    };

    this.pendingCountsSocket.onclose = () => {
      this.pendingCountsSocket = null;
      // Reconnect logic
      this.pendingCountsReconnectTimer = setTimeout(() => {
        this.startPendingCountsWebSocket();
      }, 5000);
    };
  }

  stopPendingCountsWebSocket(): void {
    if (this.pendingCountsReconnectTimer) {
      clearTimeout(this.pendingCountsReconnectTimer);
      this.pendingCountsReconnectTimer = null;
    }

    if (this.pendingCountsSocket) {
      this.pendingCountsSocket.close();
      this.pendingCountsSocket = null;
    }
  }
  private readonly eventReportFullData = `${environment.eventDataUrl}/getEventReportFullData_1_0`;

  private readonly actionTagCategoriesUrl = `${environment.eventDataUrl}/getActionTagCategories_1_0`;

  private readonly getEventsMoreInfoUrl = `${environment.eventDataUrl}/getEventsMoreInfo_1_0`;

  private readonly addCommentForEventUrl = `${environment.eventDataUrl}/addCommentForEvent_1_0`;

  private readonly updateEventsMoreInfoUrl = `${environment.eventDataUrl}/updateEventsMoreInfo_1_0`;

  private readonly consoleEventsCountsUrl = `${environment.eventDataUrl}/getConsoleEventsCounts_1_0`;

  private readonly consolePendingMessagesDataUrl = `${environment.eventDataUrl}/getConsolePendingMessages_1_0`;

  private readonly pendingMessagesUrl = `${environment.mqApiBaseUrl}/getEventsPendingMessages_1_0`;

  private readonly consolePendingMessagesUrl = `${environment.mqApiBaseUrl}/getConsolePendingMessages_1_0`;

  private readonly pendingEventsCountsUrl = `${environment.mqApiBaseUrl}/getPendingEventsCounts_1_0`;

  private readonly allSitesListUrl = `${environment.vipSitesUrl}/getSitesList_1_0`;

  private readonly liveInfoForSiteAndCameraUrl = `${environment.vipSitesUrl}/getLiveInfoForSiteAndCamera_1_0`;

  private readonly timezonesUrl = `${environment.eventDataUrl}/getTimezones_1_0`;

  private readonly employeeLevelsUrl = `${environment.eventDataUrl}/getLevelsInfo_1_0`;

 private readonly cameraWisePendingCountsUrl = `${environment.mqApiBaseUrl}/getCameraWisePendingCounts_1_0`;

 private readonly downloadSingleEventExcelUrl = `${environment.eventDataUrl}/downloadSingleEventFullExcelReport_1_0`;
  private readonly downloadSingleEventPdfUrl = `${environment.eventDataUrl}/downloadSingleEventPdfReport_1_0`;

  downloadSingleEventExcel(eventId: string): Observable<any> {
    const params = new HttpParams().set("eventId", eventId);
    return this.http.get(this.downloadSingleEventExcelUrl, {
      params,
      responseType: "arraybuffer",
      observe: "response"
    });
  }

  downloadSingleEventPdf(eventId: string, logoType: string): Observable<any> {
    const params = new HttpParams()
      .set("eventId", eventId)
      .set("logoType", logoType);
    return this.http.get(this.downloadSingleEventPdfUrl, {
      params,
      responseType: "arraybuffer",
      observe: "response"
    });
  }


  /**
   * 🔹 Get Suspicious / False events
   *
   * Expected behavior:
   * falsecheck=true, suspiciouscheck=false  => only false
   * falsecheck=false, suspiciouscheck=true  => only suspicious
   * falsecheck=true, suspiciouscheck=true   => both
   * falsecheck=false, suspiciouscheck=false => backend default / all / none
   */
  getSuspiciousEvents(
    falsecheck: boolean,
    suspiciouscheck: boolean,
    startDate?: string,
    endDate?: string,
    filter?: any,
  ): Observable<any> {
    let params = new HttpParams();


    if (startDate) {
      params = params.set("fromDate", startDate);
    }


    if (endDate) {
      params = params.set("toDate", endDate);
    }


    // ✅ Pass both toggles exactly as backend expects
    params = params.set("falseActionTag", String(falsecheck));
    params = params.set("suspiciousActionTag", String(suspiciouscheck));


    // Optional filters
    if (filter) {
      if (
        filter.timezoneValue !== null &&
        filter.timezoneValue !== undefined &&
        filter.timezoneValue !== ""
      ) {
        params = params.set("timezone", filter.timezoneValue);
      } else if (
        filter.timeZone !== null &&
        filter.timeZone !== undefined &&
        filter.timeZone !== "All" &&
        filter.timeZone !== ""
      ) {
        const cleanTz =
          filter.timeZone.match(/\((.*?)\)/)?.[1] || filter.timeZone;
        params = params.set("timezone", cleanTz);
      }


      if (filter.site !== null && filter.site !== undefined) {
        let sid = filter.site;
        if (typeof filter.site === "object") {
          sid = filter.site.siteId || filter.site.site || filter.site.id;
        }
        if (sid && sid !== "All") {
          params = params.set("siteId", sid);
        }
      }


      if (
        filter.camera !== null &&
        filter.camera !== undefined &&
        filter.camera !== "" &&
        filter.camera !== "All"
      ) {
        params = params.set("cameraId", filter.camera);
      }


      if (
        filter.consoleType !== null &&
        filter.consoleType !== undefined &&
        filter.consoleType !== "" &&
        filter.consoleType !== "All"
      ) {
        params = params.set("eventType", filter.consoleType);
      }


      if (
        filter.employeeId !== null &&
        filter.employeeId !== undefined &&
        filter.employeeId !== ""
      ) {
        params = params.set("employee", filter.employeeId);
      } else if (
        filter.employee !== null &&
        filter.employee !== undefined &&
        filter.employee !== "" &&
        filter.employee !== "All"
      ) {
        params = params.set("employee", filter.employee);
      }


      if (
        filter.alertType !== null &&
        filter.alertType !== undefined &&
        filter.alertType !== "" &&
        filter.alertType !== "All"
      ) {
        params = params.set("alertType", filter.alertType);
      }


      if (
        filter.actionTagId !== null &&
        filter.actionTagId !== undefined
      ) {
        params = params.set("subActionTagId", filter.actionTagId);
      } else if (
        filter.actionTag !== null &&
        filter.actionTag !== undefined &&
        filter.actionTag !== "" &&
        filter.actionTag !== "All"
      ) {
        params = params.set("actionTag", filter.actionTag);
      }
    }


    return this.http.get<any>(this.eventReportFullData, { params });
  }

  getConsoleEventsCounts_1_0(): Observable<any> {
    return this.http.get<any>(this.consoleEventsCountsUrl);
  }

  getActionTagCategories(userLevel?: number): Observable<any> {
    let params = new HttpParams();
    if (userLevel !== undefined && userLevel !== null) {
      params = params.set("userLevel", String(userLevel));
    }
    return this.http.get<any>(this.actionTagCategoriesUrl, { params });
  }
  getTimezones(): Observable<any> {
    return this.http.get<any>(this.timezonesUrl);
  }

  getEmployeeLevels(): Observable<any> {
    return this.http.get<any>(this.employeeLevelsUrl);
  }

  getSitesList(): Observable<any> {
    return this.http.get<any>(this.allSitesListUrl);
  }

  getLiveInfoForSiteAndCamera(siteId: any): Observable<any> {
    return this.http.get<any>(`${this.liveInfoForSiteAndCameraUrl}?siteId=${siteId}`);
  }


  // getPendingEventsCounts_1_0(): Observable<any> {
  //   return this.http.get<any>(this.pendingEventsCountsUrl);
  // }

  // ✅ From events data
  getConsolePendingMessages_1_0(): Observable<any> {
    return this.http.get<any>(`${this.consolePendingMessagesDataUrl}`);
  }

  // ✅ From MQ queueManagement
  getEventsPendingMessages_1_0(): Observable<any> {
    return this.http.get<any>(`${this.pendingMessagesUrl}`);
  }
 getCameraWisePendingCounts_1_0(queueName: string): Observable<any> {
    const params = new HttpParams().set("queueName", queueName);
    return this.http.get<any>(this.cameraWisePendingCountsUrl, { params });
  }
  // getActionTagCategories(): Observable<any> {
  //   return this.http.get<any>(this.actionTagCategoriesUrl);
  // }

  // getEventReportCountsForActionTag(  //// API Merged into getEventReportFullData
  //   startDate?: string,
  //   endDate?: string,
  //   suspiciouscheck?: boolean,
  //   falsecheck?: boolean,

  //   filter?: any,
  // ): Observable<any> {
  //   const url =
  //     `${this.eventReportCountsForActionTag}?fromDate=${startDate}` +
  //     `&toDate=${endDate}&falseActionTag=${falsecheck}&suspiciousActionTag=${suspiciouscheck}`;

  //   let params = new HttpParams();

  //   // if (actionTag) {
  //   //   params = params.set("actionTag", actionTag);
  //   // }
  //   if (
  //     filter.timeZone !== null &&
  //     filter.timeZone !== "All" &&
  //     filter.timeZone !== ""
  //   ) {
  //     const cleanTz = filter.timeZone.match(/\((.*?)\)/)?.[1] || "";

  //     params = params.set("timezone", cleanTz);
  //   }

  //   if (filter.site !== null) {
  //     params = params.set("siteId", filter.site.siteId);
  //   }

  //   if (
  //     filter.camera !== null &&
  //     filter.camera !== "" &&
  //     filter.camera !== "All"
  //   ) {
  //     params = params.set("cameraId", filter.camera);
  //   }

  //   if (
  //     filter.consoleType !== null &&
  //     filter.consoleType !== "" &&
  //     filter.consoleType !== "All"
  //   ) {
  //     params = params.set("EventType", filter.consoleType);
  //   }

  //   return this.http.get<any>(url, { params });
  // }

 getEventMoreInfo(eventId: number): Observable<any> {
    if (this.eventMoreInfoCache.has(eventId)) {
      return this.eventMoreInfoCache.get(eventId)!;
    }

    const url = `${this.getEventsMoreInfoUrl}?eventId=${eventId}`;
    const request$ = this.http.get<any>(url).pipe(
      shareReplay(1)
    );

    this.eventMoreInfoCache.set(eventId, request$);
    return request$;
  }

  addComment(event: {
    eventsId: string;
    commentsInfo: string;
    createdBy: number;
    remarks: string;
  }): Observable<any> {
    return this.http.post<any>(this.addCommentForEventUrl, event, {
      headers: { "Content-Type": "application/json" },
     }).pipe(
      tap(() => {
        // Invalidate cache
        if (event.eventsId) this.eventMoreInfoCache.delete(Number(event.eventsId));
      })
    );
  }



  putEventsMoreInfo(event: any): Observable<any> {
    // The backend now expects Form data for the update logic
    const formData = new FormData();
    Object.keys(event).forEach(key => {
      if (event[key] !== undefined && event[key] !== null) {
        formData.append(key, event[key]);
      }
    });

    // Log FormData entries for verification
    formData.forEach((value, key) => {
    });

    return this.http.put<any>(this.updateEventsMoreInfoUrl, formData).pipe(
      tap(() => {
        // Invalidate cache
        if (event.eventId) this.eventMoreInfoCache.delete(Number(event.eventId));
      })
    );
  }

  timezoneDropdown() {
    let url = `${environment.eventDataUrl}/getTimezones_1_0`;

    return this.http.get(url);
  }

  downloadExcelreport(payload: any) {
    let url = `${environment.eventDataUrl}/downloadEventsReport_1_0`;
    let params = new HttpParams();

    if (payload?.fromDate) params = params.set("fromDate", payload.fromDate);
    if (payload?.toDate) params = params.set("toDate", payload.toDate);

    // ✅ Toggle booleans as per backend requirement
    params = params.set("falseActionTag", String(payload?.falseActionTag ?? false));
    params = params.set("suspiciousActionTag", String(payload?.suspiciousActionTag ?? false));

    if (payload?.timezone) params = params.set("timezone", payload.timezone);
    if (payload?.siteId && payload.siteId !== "All") params = params.set("siteId", payload.siteId);
    if (payload?.cameraId && payload.cameraId !== "All") params = params.set("cameraId", payload.cameraId);
    if (payload?.eventType && payload.eventType !== "All") params = params.set("eventType", payload.eventType);

    return this.http.get<ArrayBuffer>(url, {
      params,
      responseType: "arraybuffer" as "json",
    });
  }

  weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  getHour(timezone: string) {
    return moment.tz(timezone).hours();
  }
  getDay(timezone: string) {
    return moment.tz(timezone).day();
  }

 getEmailDataForVMSEvents(payload: any): Observable<any> {
    const cacheKey = `${payload?.siteId}-${payload?.cameraId}-${payload?.alertTypeId}-${payload?.subTypeId}`;
    
    if (this.emailDataCache.has(cacheKey)) {
      return this.emailDataCache.get(cacheKey)!;
    }
    let url = `${environment.guard_monitoring_url}/getEmailDataForVMSEvents_1_0`;
       

    let params = new HttpParams();
    params = params.set("siteId", payload?.siteId);
    params = params.set("siteName", payload?.siteName);
    params = params.set("cameraId", payload?.cameraId);
    params = params.set("alertTypeId", payload?.alertTypeId);
    params = params.set("subTypeId", payload?.subTypeId);
    params = params.set("day", payload?.day);
    params = params.set("hour", payload?.hour);
    params = params.set(
      "currentTime",
      this.datePipe.transform(payload?.currentTime, "yyyy-MM-dd HH:mm:ss")!,
    );
    params = params.set("callingSystemDetail", "dashboard");


    const request$ = this.http.get(url, { params: params }).pipe(
      shareReplay(1)
    );

    this.emailDataCache.set(cacheKey, request$);
    return request$;
  }

  public getTimeByTimezone(timezone: string = "Asia/Kolkata", time?: any) {
    return moment.tz(timezone).format("YYYY-MM-DD HH:mm:ss");
  }

  sendResolution(payload: any) {
    // console.log(payload);
    let url = `${environment.guard_monitoring_url}/sendResolutionEmail_1_0`;
    // let url = `${environment.guard_monitoring_url}/eventsGenericEmail_2_0`;

    const userString = sessionStorage.getItem("verifai_user");
    const user = userString ? JSON.parse(userString) : null;

    // let params = new HttpParams();
    // params = params.set('siteId', payload?.siteId);
    // params = params.set('day', this.getDay(payload?.timezoneValue));
    // params = params.set('hour', this.getHour(payload?.timezoneValue));
    // params = params.set('currentTime', this.getTimeByTimezone(payload?.timezoneValue));

    const formData = new FormData();
    formData.append("senderEmail", payload?.senderEmail);
    formData.append(
      "recipientEmails",
      JSON.stringify(payload?.recipientEmails ?? []),
    );
    formData.append("bcc", JSON.stringify(payload?.BCC ?? []));
    formData.append("cc", JSON.stringify(payload?.Cc ?? []));
    formData.append("subject", payload?.emailSubject);
    formData.append("body", payload?.emailBody);
    if (payload?.selectedFiles?.length) {
      payload.selectedFiles.forEach((file: File) => {
        formData.append("files", file);
      });
    }

    // formData.append(
    //   'files',
    //   JSON.stringify(payload?.selectedFiles)
    // );

    formData.append("fields", JSON.stringify(payload?.emailFields));
    formData.append("siteId", payload?.siteId);
    formData.append("cameraId", payload?.cameraId);
    // formData.append('cameraName', payload?.cameraName );
    formData.append("actionsTaken", payload?.action);
    formData.append("notes", payload?.resolution);
    formData.append("eventId", payload?.eventId);
    formData.append("createdBy", user?.UserId);
    formData.append("alerTagId", payload?.alertTagId1);
    formData.append("subAlertTagId", payload?.subAlertTagId);
    formData.append("timeZone", payload?.timezoneValue);
    // formData.append('callingSystemDetail', 'vms');

    return this.http.post(url, formData);
  }



  getAlertCategoriesForSiteId(siteIdOrPayload: any): Observable<any> {
    const siteId = (typeof siteIdOrPayload === 'object') ? siteIdOrPayload?.siteId : siteIdOrPayload;
    
    if (siteId && this.alertCategoriesCache.has(siteId)) {
      return this.alertCategoriesCache.get(siteId)!;
    }

    let url = `${environment.guard_monitoring_url}/getAlertCategoriesForSiteId_1_0`;
    let params = new HttpParams();

    // const siteId = (typeof siteIdOrPayload === 'object') ? siteIdOrPayload?.siteId : siteIdOrPayload;

    if (siteId) {
      params = params.set("siteId", siteId);
    }

   const request$ = this.http.get<any>(url, { params }).pipe(
      shareReplay(1)
    );

    if (siteId) {
      this.alertCategoriesCache.set(siteId, request$);
    }
    return request$;
  }
}
