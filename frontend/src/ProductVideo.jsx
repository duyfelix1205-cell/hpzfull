import React from 'react';

const safeHttpUrl=value=>{
  const raw=String(value||'').trim();
  if(!raw)return '';
  const candidate=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
  try{
    const url=new URL(candidate);
    return ['http:','https:'].includes(url.protocol)?url.href:'';
  }catch{return ''}
};

const youtubeId=url=>{
  const host=url.hostname.replace(/^www\./,'').toLowerCase();
  if(host==='youtu.be')return url.pathname.split('/').filter(Boolean)[0]||'';
  if(host==='youtube.com'||host==='m.youtube.com'){
    if(url.pathname==='/watch')return url.searchParams.get('v')||'';
    const match=url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/);
    return match?.[1]||'';
  }
  return '';
};

export const productVideoSource=value=>{
  const href=safeHttpUrl(value);
  if(!href)return null;
  const url=new URL(href);
  const host=url.hostname.replace(/^www\./,'').toLowerCase();

  if(host==='facebook.com'||host.endsWith('.facebook.com')){
    return {
      type:'iframe',
      provider:'Facebook',
      href,
      src:`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false&width=900`
    };
  }

  const yt=youtubeId(url);
  if(yt&&/^[A-Za-z0-9_-]{6,20}$/.test(yt)){
    return {
      type:'iframe',
      provider:'YouTube',
      href,
      src:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?rel=0`
    };
  }

  if(host==='vimeo.com'||host.endsWith('.vimeo.com')){
    const id=url.pathname.split('/').filter(Boolean).findLast?.(part=>/^\d+$/.test(part))
      ||url.pathname.split('/').filter(Boolean).reverse().find(part=>/^\d+$/.test(part));
    if(id)return {type:'iframe',provider:'Vimeo',href,src:`https://player.vimeo.com/video/${id}`};
  }

  if(/\.(?:mp4|webm|ogg)$/i.test(url.pathname)){
    return {type:'video',provider:'Video',href,src:href};
  }

  return {type:'link',provider:'Nguồn video',href,src:''};
};

export function ProductVideo({url,title='Video thực tế'}){
  const source=productVideoSource(url);
  if(!source)return null;
  const embedded=source.type==='iframe'||source.type==='video';

  return <section className="detail-video-card" aria-label={title}>
    <div className="detail-video-card__head">
      <div><b>{title}</b><span>{embedded?`Phát trực tiếp từ ${source.provider}.`:'Nguồn video này chưa hỗ trợ phát trực tiếp.'}</span></div>
      <a href={source.href} target="_blank" rel="noreferrer">Mở video gốc ↗</a>
    </div>
    {source.type==='iframe'&&<div className="detail-video-embed">
      <iframe
        src={source.src}
        title={title}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>}
    {source.type==='video'&&<div className="detail-video-embed">
      <video src={source.src} controls playsInline preload="metadata" aria-label={title}/>
    </div>}
    {source.type==='link'&&<div className="detail-video-fallback">
      <span>▶</span><p>Link video vẫn được giữ nguyên; mở nguồn gốc nếu nền tảng không cho phép nhúng trực tiếp.</p>
    </div>}
  </section>;
}
