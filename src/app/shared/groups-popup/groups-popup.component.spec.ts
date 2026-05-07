import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupsPopupComponent } from './groups-popup.component';

describe('GroupsPopupComponent', () => {
  let component: GroupsPopupComponent;
  let fixture: ComponentFixture<GroupsPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsPopupComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GroupsPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
