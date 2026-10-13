import React from 'react';
import { createPortal } from 'react-dom';
import { LegacyScene, legacyAsset } from '../LegacyScene.jsx';

const primaryNav=header=>[
  ['home','/',header?.home_label||'Trang chủ'],
  ['catalog','/catalog',header?.fish_label||'Cá cảnh'],
  ['tanks','/tanks',header?.tanks_label||'Bể cá'],
  ['journal','/nhat-bao','Nhật Báo'],
  ['wiki','/wiki','HPZWiki'],
  ['care','/care','AquaCare'],
  ['game','/game','Game'],
  ['market','/market','Market'],
  ['community','/community','Community']
];
const secondaryNav=header=>[
  ['policy','/policy',header?.policy_label||'Chính sách'],
  ['contact','/#contact',header?.contact_label||'Liên hệ']
];

export function HPZHeader({active='',siteHeader=null}) {
  const nav=primaryNav(siteHeader),secondary=secondaryNav(siteHeader);
  const brandName=siteHeader?.brand_name||'HPZ AQUAROOM';
  const brandTagline=siteHeader?.brand_tagline||'CUSTOMER ECOSYSTEM';
  const activeClass=id=>active===id?'active':'';
  return <header className="hpz-header">
    <div className="hpz-container hpz-header__inner">
      <a className="hpz-brand" href="/" aria-label="HPZ Aquaroom">
        <span className="hpz-brand__mark"><img src={legacyAsset('logo.png')} alt=""/></span>
        <span><b>{brandName}</b><small>{brandTagline}</small></span>
      </a>
      <nav className="hpz-header__nav" aria-label="Điều hướng chính">
        {nav.map(([id,href,label])=><a key={id} href={href} className={activeClass(id)}>{label}</a>)}
      </nav>
      <div className="hpz-header__actions">
        <details className="hpz-more-nav">
          <summary className={secondary.some(([id])=>active===id)?'active':''}>Thêm</summary>
          <div className="hpz-more-nav__panel">
            {secondary.map(([id,href,label])=><a key={id} href={href} className={activeClass(id)}>{label}</a>)}
          </div>
        </details>
        <a className="hpz-icon-link" href="/catalog" aria-label="Tìm kiếm">⌕</a>
        <a className={'hpz-account-link '+(active==='me'?'active':'')} href="/me">My HPZ</a>
        <details className="hpz-mobile-menu">
          <summary aria-label="Mở menu">☰</summary>
          <div className="hpz-mobile-menu__panel">
            {[...nav,...secondary].map(([id,href,label])=><a key={id} href={href} className={activeClass(id)}>{label}</a>)}
            <a href="/me" className={active==='me'?'active':''}>My HPZ</a>
          </div>
        </details>
      </div>
    </div>
  </header>;
}

export function HPZBottomNav({active=''}) {
  const items=[['home','/','Home','⌂'],['care','/care','Care','≈'],['game','/game','Game','🎮'],['market','/market','Market','◇'],['me','/me','Me','●']];
  return <nav className="hpz-bottom-nav" aria-label="Điều hướng mobile">
    {items.map(([id,href,label,icon])=><a key={id} href={href} className={active===id?'active':''}><i>{icon}</i><span>{label}</span></a>)}
  </nav>;
}

function HPZFooter({siteFooter=null}) {
  const location=siteFooter?.location||'Hà Nội';
  const facebookLabel=siteFooter?.facebook_label||'Facebook';
  const facebookHref=siteFooter?.facebook_href||'https://www.facebook.com/hpzaquaroom';
  const copyright=siteFooter?.copyright||'© 2026 HPZ Aquaroom.';
  return <footer className="hpz-footer"><div className="hpz-container">
    <div className="hpz-footer__business">HPZ Aquaroom · {location} · <a href={facebookHref} target="_blank" rel="noreferrer">{facebookLabel}</a><br/>{copyright}</div>
    <nav className="hpz-footer__links" aria-label="Liên kết website">
      <a href="/catalog">Cá cảnh</a><a href="/tanks">Bể cá</a><a href="/nhat-bao">Nhật Báo</a><a href="/wiki">HPZWiki</a><a href="/care">AquaCare</a><a href="/game">Game</a><a href="/market">Market</a><a href="/community">Community</a><a href="/policy">Chính sách</a><a href="/#contact">Liên hệ</a>
    </nav>
  </div></footer>;
}

export function HPZAppShell({active='',children,className='',compact=false,footer=true,bottomNav=true,siteHeader=null,siteFooter=null}) {
  return <div className={'hpz-app '+className}>
    <LegacyScene/>
    <HPZHeader active={active} siteHeader={siteHeader}/>
    <main className={'hpz-main '+(compact?'hpz-main--compact':'')}>{children}</main>
    {footer&&<HPZFooter siteFooter={siteFooter}/>}
    {bottomNav&&<HPZBottomNav active={active}/>}
  </div>;
}

export function HPZContainer({children,className=''}) {
  return <div className={'hpz-container '+className}>{children}</div>;
}

export function HPZPageHeader({eyebrow='HPZ AQUAROOM',title,subtitle,actions,children}) {
  return <section className="hpz-page-head">
    <div className="hpz-page-head__copy"><span className="hpz-eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}{children}</div>
    {actions&&<div className="hpz-page-head__actions">{actions}</div>}
  </section>;
}

export function HPZButton({children,variant='primary',href,className='',...props}) {
  const cls={'primary':'hpz-btn hpz-btn--primary','secondary':'hpz-btn hpz-btn--secondary','ghost':'hpz-btn hpz-btn--ghost','danger':'hpz-btn hpz-btn--danger'}[variant]||'hpz-btn hpz-btn--primary';
  return href?<a className={cls+' '+className} href={href} {...props}>{children}</a>:<button className={cls+' '+className} {...props}>{children}</button>;
}

export function HPZCard({children,className='',tone='default',as='section'}) {
  const Tag=as;
  return <Tag className={'hpz-card hpz-card--'+tone+' '+className}>{children}</Tag>;
}

export function HPZCardHeader({eyebrow,title,meta,actions}) {
  return <div className="hpz-card-head"><div>{eyebrow&&<span className="hpz-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{meta&&<small>{meta}</small>}</div>{actions&&<div className="hpz-card-head__actions">{actions}</div>}</div>;
}

export function HPZKpi({label,value,meta,className=''}) {
  return <div className={'hpz-kpi '+className}><span>{label}</span><b>{value}</b>{meta&&<small>{meta}</small>}</div>;
}

export function HPZTabs({items,value,onChange,ariaLabel='Điều hướng nội dung'}) {
  return <nav className="hpz-tabs" aria-label={ariaLabel}>{items.map(item=>{
    const id=Array.isArray(item)?item[0]:item.id,label=Array.isArray(item)?item[1]:item.label,href=Array.isArray(item)?item[2]:item.href;
    if(href)return <a key={id} className={value===id?'active':''} href={href}>{label}</a>;
    return <button key={id} type="button" className={value===id?'active':''} onClick={()=>onChange?.(id)}>{label}</button>;
  })}</nav>;
}

export function HPZField({label,as='input',options=[],help,className='',...props}) {
  const Tag=as;
  return <label className={'hpz-field '+className}><span>{label}</span>
    {as==='select'?<select {...props}>{options.map(x=><option key={String(x.value)} value={x.value}>{x.label}</option>)}</select>:<Tag {...props}/>}
    {help&&<small>{help}</small>}
  </label>;
}

export function HPZModal({open=true,title,subtitle,onClose,children,wide=false}) {
  if(!open)return null;
  const modal=<div className="hpz-modal-backdrop" role="presentation"><section className={'hpz-modal '+(wide?'hpz-modal--wide':'')} role="dialog" aria-modal="true" aria-label={title}>
    <button className="hpz-modal__close" onClick={onClose} aria-label="Đóng">×</button>
    <div className="hpz-modal__mark">HPZ</div><h2>{title}</h2>{subtitle&&<p className="hpz-modal__subtitle">{subtitle}</p>}{children}
  </section></div>;
  return typeof document==='undefined'?modal:createPortal(modal,document.body);
}

export function HPZNotice({children,type='info'}) {
  return children?<div className={'hpz-notice hpz-notice--'+type}>{children}</div>:null;
}

export function HPZEmptyState({title='Chưa có dữ liệu',children,action}) {
  return <div className="hpz-empty"><b>{title}</b>{children&&<p>{children}</p>}{action}</div>;
}

export function HPZStatus({children,tone='info'}) {
  return <span className={'hpz-status hpz-status--'+tone}>{children}</span>;
}

export function HPZTable({columns=[],children,minWidth=720}) {
  return <div className="hpz-table-wrap"><div className="hpz-table" style={{minWidth}}><div className="hpz-table__head">{columns.map((x,i)=><span key={i}>{x}</span>)}</div>{children}</div></div>;
}

export function HPZTableRow({children}) {
  return <div className="hpz-table__row">{children}</div>;
}

export function HPZLoading({label='Đang tải…'}) {
  return <div className="hpz-loading"><span/><span/><span/><small>{label}</small></div>;
}
