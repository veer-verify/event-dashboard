import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";
import * as moment from "moment";
import { DatePipe } from "@angular/common";

@Injectable({
  providedIn: "root",
})
export class EventsService {
  constructor(
    private datePipe: DatePipe,
    private http: HttpClient,
  ) {}

  // 🔹 events data endpoints
  private readonly eventReportFullData = `${environment.eventDataUrl}/getEventReportFullData_1_0`;
  // private readonly eventReportFullData =
  //   `http://192.168.0.244:8000/getEventReportFullData_1_0`;


  private readonly actionTagCategoriesUrl = `${environment.eventDataUrl}/getActionTagCategories_1_0`;

  // private readonly eventReportCountsForActionTag = `${environment.eventDataUrl}/getEventReportCountsForActionTag_1_0`;    //// API Merged into getEventReportFullData

  private readonly getEventsMoreInfoUrl = `${environment.eventDataUrl}/getEventsMoreInfo_1_0`;

  private readonly addCommentForEventUrl = `${environment.eventDataUrl}/addCommentForEvent_1_0`;

  private readonly updateEventsMoreInfoUrl = `${environment.eventDataUrl}/updateEventsMoreInfo_1_0`;

  private readonly consoleEventsCountsUrl = `${environment.eventDataUrl}/getConsoleEventsCounts_1_0`;

  private readonly consolePendingMessagesDataUrl = `${environment.eventDataUrl}/getConsolePendingMessages_1_0`;

  // 🔹 MQ / queueManagement endpoints
  private readonly pendingMessagesUrl = `${environment.mqApiBaseUrl}/getEventsPendingMessages_1_0`;

  private readonly consolePendingMessagesUrl = `${environment.mqApiBaseUrl}/getConsolePendingMessages_1_0`;

  private readonly pendingEventsCountsUrl = `${environment.mqApiBaseUrl}/getPendingEventsCounts_1_0`;
  // private readonly allSitesListUrl = `http://192.168.0.229:3004/vipsites/getSitesList_1_0`;

  private readonly allSitesListUrl = `${environment.vipSitesUrl}/getSitesList_1_0`;


  private readonly liveInfoForSiteAndCameraUrl = `https://usstaging.ivisecurity.com/vipsites/getLiveInfoForSiteAndCamera_1_0`;
  private readonly siteSpecificAlertCategoriesUrl = `https://usstaging.ivisecurity.com/guard_monitoring/getAlertCategoriesForSiteId_1_0`;
  private readonly timezonesUrl = `https://usstaging.ivisecurity.com/events_data/getTimezones_1_0`;
  private readonly employeeLevelsUrl = `https://usstaging.ivisecurity.com/events_data/getLevelsInfo_1_0`;


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

  getActionTagCategories(): Observable<any> {
    return this.http.get<any>(this.actionTagCategoriesUrl);
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


  getPendingEventsCounts_1_0(): Observable<any> {
    return this.http.get<any>(this.pendingEventsCountsUrl);
  }

  // ✅ From events data
  getConsolePendingMessages_1_0(): Observable<any> {
    return this.http.get<any>(`${this.consolePendingMessagesDataUrl}`);
  }

  // ✅ From MQ queueManagement
  getEventsPendingMessages_1_0(): Observable<any> {
    return this.http.get<any>(`${this.pendingMessagesUrl}`);
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
    const url = `${this.getEventsMoreInfoUrl}?eventId=${eventId}`;
    return this.http.get<any>(url);
  }

  addComment(event: {
    eventsId: string;
    commentsInfo: string;
    createdBy: number;
    remarks: string;
  }): Observable<any> {
    return this.http.post<any>(this.addCommentForEventUrl, event, {
      headers: { "Content-Type": "application/json" },
    });
  }

  putEventsMoreInfo(event: {
    eventsId: string;
    userlevel: number;
    user: number;
    alarm: string;
    landingTime: string;
    receivedTime: string;
    reviewStartTime: string;
    reviewEndTime: string;
    actionTag: number;
    subActionTag: number;
    notes: string;
  }): Observable<any> {
    console.log(event, "kk");
    return this.http.put<any>(this.updateEventsMoreInfoUrl, event, {
      headers: { "Content-Type": "application/json" },
    });
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
    return moment().tz(timezone).hours();
  }
  getDay(timezone: string) {
    return moment().tz(timezone).day();
  }

  getEmailDataForVMSEvents(payload: any) {
    // let url = `${environment.guard_monitoring_url}/getEmailDataForClosedEvent_1_0`;
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

    return this.http.get(url, { params: params });
  }

  public getTimeByTimezone(timezone: string = "Asia/Kolkata", time?: any) {
    return moment.tz(timezone).format("YYYY-MM-DD HH:mm:ss");
  }

  sendResolution(payload: any) {
    console.log(payload);
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


  getAlertCategoriesForSiteId(siteIdOrPayload: any) {
    let url = `${environment.guard_monitoring_url}/getAlertCategoriesForSiteId_1_0`;
    let params = new HttpParams();

    const siteId = (typeof siteIdOrPayload === 'object') ? siteIdOrPayload?.siteId : siteIdOrPayload;

    if (siteId) {
      params = params.set("siteId", siteId);
    }

    return this.http.get<any>(url, { params });
  }
}
