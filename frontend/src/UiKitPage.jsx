import React,{useState}from'react';
import{HPZAppShell,HPZContainer,HPZPageHeader,HPZButton,HPZCard,HPZCardHeader,HPZKpi,HPZTabs,HPZField,HPZModal,HPZNotice,HPZStatus,HPZTable,HPZTableRow,HPZEmptyState}from'./ui/HPZUI.jsx';

export function UiKitPage(){
  const[tab,setTab]=useState('one'),[modal,setModal]=useState(false);
  return <HPZAppShell active="">
    <HPZContainer>
      <HPZPageHeader eyebrow="HPZ DESIGN SYSTEM V2" title="UI Kit" subtitle="Undersea navy visual source of truth cho toàn bộ HPZ Customer Ecosystem. Những component này là baseline cho Catalog, Wiki, AquaCare, Market, Community và My HPZ."/>
      <div className="hpz-grid hpz-grid--2 hpz-section">
        <HPZCard><HPZCardHeader eyebrow="BUTTONS" title="Actions"/>
          <div className="hpz-actions"><HPZButton>Primary</HPZButton><HPZButton variant="secondary">Secondary</HPZButton><HPZButton variant="ghost">Ghost</HPZButton><HPZButton variant="danger">Danger</HPZButton></div>
        </HPZCard>
        <HPZCard><HPZCardHeader eyebrow="STATUS" title="Badges"/>
          <div className="hpz-actions"><HPZStatus tone="success">Ổn định</HPZStatus><HPZStatus>Đang theo dõi</HPZStatus><HPZStatus tone="warning">Sắp đến hạn</HPZStatus><HPZStatus tone="danger">Sự cố</HPZStatus><HPZStatus tone="neutral">Ẩn</HPZStatus></div>
        </HPZCard>
      </div>
      <div className="hpz-kpi-grid hpz-section"><HPZKpi label="Tổng chi tiêu" value="12.500.000₫" meta="Theo CRM Orders"/><HPZKpi label="Điểm hiện có" value="1.250" meta="HPZ GOLD"/><HPZKpi label="Bể đang theo dõi" value="3" meta="AquaCare"/><HPZKpi label="Thông báo" value="2" meta="Cần xem"/></div>
      <HPZCard className="hpz-section"><HPZCardHeader eyebrow="FORMS" title="Form controls"/><div className="hpz-grid hpz-grid--2"><HPZField label="Tên hiển thị" placeholder="Nguyễn Văn A"/><HPZField label="Loại bể" as="select" options={[{value:'AQUARIUM',label:'Bể cá'},{value:'PLANTED',label:'Thủy sinh'}]}/><HPZField label="Ghi chú" as="textarea" className="hpz-field--wide" placeholder="Nội dung..."/></div></HPZCard>
      <HPZCard className="hpz-section"><HPZCardHeader eyebrow="NAVIGATION" title="Tabs"/><HPZTabs items={[['one','Tổng quan'],['two','Lịch sử'],['three','Hồ sơ']]} value={tab} onChange={setTab}/><HPZNotice>Tab đang chọn: {tab}</HPZNotice><HPZButton variant="secondary" onClick={()=>setModal(true)}>Mở modal mẫu</HPZButton></HPZCard>
      <HPZCard className="hpz-section"><HPZCardHeader eyebrow="TABLE" title="Data table"/><HPZTable columns={['Ngày','Nguồn','Nội dung','Điểm']} minWidth={520}><HPZTableRow><span>02/10</span><span>Đơn hàng</span><span>ORD-1021</span><b>+120</b></HPZTableRow></HPZTable></HPZCard>
      <HPZEmptyState title="Empty state mẫu">Không có dữ liệu giả; khi module chưa có data thật sẽ hiển thị empty state chủ động.</HPZEmptyState>
      <HPZModal open={modal} onClose={()=>setModal(false)} title="Modal chuẩn HPZ" subtitle="Tất cả module dùng cùng backdrop, radius, spacing và action style."><HPZField label="Ví dụ" placeholder="Nhập nội dung"/><div className="hpz-actions"><HPZButton variant="secondary" onClick={()=>setModal(false)}>Hủy</HPZButton><HPZButton onClick={()=>setModal(false)}>Xác nhận</HPZButton></div></HPZModal>
    </HPZContainer>
  </HPZAppShell>;
}
