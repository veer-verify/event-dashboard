import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetailedViewItem } from '../../../../core/models/invsites.models';
import { SiteInventoryDetailedItem } from '../../../../core/models/inventory.models';

@Component({
  selector: 'app-invsites-detailed-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invsites-detailed-view.component.html',
  styleUrls: ['./invsites-detailed-view.component.css']
})
export class InvsitesDetailedViewComponent implements OnInit, OnChanges {
  @Input() tableData: SiteInventoryDetailedItem[] = [];

  detailedViewData: DetailedViewItem[] = [];

  constructor() { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tableData']) {
      this.groupData();
    }
  }

  groupData() {
    const grouped = new Map<string, DetailedViewItem>();

    (this.tableData || []).forEach(item => {
      const key = `${item.activityDate}_${item.action}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: item.activityDate,
          status: (item.action.charAt(0).toUpperCase() + item.action.slice(1).toLowerCase()) as 'Issued' | 'Returned',
          items: []
        });
      }

      const group = grouped.get(key)!;

      // Extract details and build the description string dynamically
      const descParts: string[] = [];
      if (item.make) descParts.push(item.make);
      if (item.model) descParts.push(item.model);
      const sn = item.serialNumber;
      if (sn) descParts.push(`SN: ${sn}`);
      const bc = item.barcode || item.barCode;
      if (bc) descParts.push(`BC: ${bc}`);

      const description = descParts.length > 0 ? descParts.join(' | ') : undefined;

      group.items.push({
        sNo: group.items.length + 1,
        itemProductName: item.name,
        itemProductDesc: description,
        totalQty: item.totalQty,
        store: item.storeQty,
        online: item.onlineQty,
        units: item.units
      });
    });

    this.detailedViewData = Array.from(grouped.values()).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }
}
