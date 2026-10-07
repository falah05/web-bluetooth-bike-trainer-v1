import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ControlDialogComponent } from './control-dialog.component';

describe('ControlDialogComponent', () => {
  let component: ControlDialogComponent;
  let fixture: ComponentFixture<ControlDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ControlDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ControlDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
