import React from 'react';
import { AdminApp } from './AdminApp.jsx';
import { TankAdmin } from './TankAdmin.jsx';
import { CategoryAdmin, AuditAdmin } from './AdminTools.jsx';
import { HomeAdmin } from './HomeAdmin.jsx';
import { JournalAdmin, WikiAdmin, TrafficAdmin } from './ContentAdmin.jsx';
import { PolicyAdmin } from './PolicyAdmin.jsx';
import { ZwMarketAdmin, AquacareAdmin } from './WorkspaceAdmin.jsx';

export function AdminRouter(){
  const path=location.pathname.replace(/\/$/,'');
  let Page=AdminApp;
  if(path==='/admin/tanks') Page=TankAdmin;
  else if(path==='/admin/categories') Page=CategoryAdmin;
  else if(path==='/admin/home') Page=HomeAdmin;
  else if(path==='/admin/policy') Page=PolicyAdmin;
  else if(path==='/admin/zwmarket') Page=ZwMarketAdmin;
  else if(path==='/admin/aquacare') Page=AquacareAdmin;
  else if(path==='/admin/journal') Page=JournalAdmin;
  else if(path==='/admin/wiki') Page=WikiAdmin;
  else if(path==='/admin/traffic') Page=TrafficAdmin;
  else if(path==='/admin/audit') Page=AuditAdmin;
  const viewerHref=path==='/admin/tanks'?'/be.html':path==='/admin/policy'?'/chinhsach.html':path==='/admin/zwmarket'?'/zwmarket':path==='/admin/journal'?'/nhat-bao':path==='/admin/wiki'?'/hpzwiki':'/';
  return <><nav className="admin-global-nav"><a href="/admin">Cá</a><a href="/admin/tanks">Bể</a><a href="/admin/home">Trang chủ</a><a href="/admin/policy">Chính sách</a><a href="/admin/zwmarket">ZWmarket</a><a href="/admin/aquacare">HPz Aquacare</a><a href="/admin/journal">Nhật Báo</a><a href="/admin/wiki">HPzwiki</a><a href="/admin/traffic">Lưu lượng</a><a href="/admin/audit">Lịch sử</a><a className="viewer-gate" href={viewerHref}>Viewer ↗</a></nav><Page/></>;
}
