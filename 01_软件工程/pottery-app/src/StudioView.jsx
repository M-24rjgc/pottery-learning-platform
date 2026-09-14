import {useEffect, useRef, useState} from 'react';
import {House, Hand, User, Gear, CaretLeft, CaretRight, ArrowRight, ArrowClockwise, WifiHigh, WifiSlash, Play, Pause, Check, CheckCircle, FlowerLotus, ChartLine, Clock, FileText, X, ShareNetwork, Desktop, Info, Plus, ArrowUpRight, CheckSquare, CircleNotch} from '@phosphor-icons/react';
import {fingerNames, fingerColors, fmt, date} from './model.mjs';

const art=name=>`./art/${name}.png`;
const titles={home:'非遗之手',device:'设备',training:'揉泥练习',history:'我的学习',report:'练习报告',connection:'连接主机',calibrate:'个人校准',templates:'参考姿态'};
function Mark(){return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M10 7q6-3 12 0l-2 5q9 13-4 14Q3 25 12 12Z" stroke="currentColor" strokeWidth="1.6"/><path d="M11 9q5 2 10 0M9 20q7 4 14 0" stroke="currentColor" strokeWidth="1.5"/></svg>;}
function FingerReadings({values,fresh,compact=false}){return <div className={'finger-readings '+(compact?'compact':'')}>{fingerNames.map((name,i)=><div key={name} style={{'--finger':fingerColors[i]}}><span className="finger-label"><i/>{name}</span><div className="finger-track"><span style={{height:fresh&&values?`${Math.max(0,Math.min(100,(values[i]-500)/20))}%`:'0%'}}/></div><b>{fresh&&values?values[i]:'—'}</b></div>)}</div>;}
function Trace({samples,fresh}){const points=(samples||[]).slice(-70);return <div className="trace"><svg viewBox="0 0 320 110" role="img" aria-label="五指最近采样曲线">{[10,55,100].map(y=><line key={y} x1="0" x2="320" y1={y} y2={y} stroke="#e7eae4"/>)}{fresh&&points.length>1&&fingerColors.map((c,i)=><polyline key={c} fill="none" strokeWidth="2" stroke={c} points={points.map((p,j)=>`${j*320/(points.length-1)},${100-Math.max(0,Math.min(2000,p.values[i]-500))*90/2000}`).join(' ')}/>)}</svg><div className="trace-labels"><span>较早</span><span>{fresh?'当前':'等待实时采样'}</span></div></div>;}
function Readiness({online,fresh,cal}){return <div className="readiness">{[[online,'主机'],[fresh,'手套'],[cal?.completed,'校准']].map(([ready,label],i)=><span key={label} className={ready?'ready':''}>{ready?<Check size={12} weight="bold"/>:<i>{i+1}</i>}{label}</span>)}</div>;}
function Empty({title,body,Icon=FlowerLotus,children}){return <div className="empty-state"><div className="empty-symbol"><Icon size={32} weight="light"/></div><h3>{title}</h3><p>{body}</p>{children}</div>;}

export default function StudioView(p){
 const {host,state,cache,online,error,reports,templates,cal,session,fresh,hw,rep,busy,page,sheet,toast,draftHost,notes,gesture,learner,video,videoError,canWrite,go,back,openConnection,openReport,start,act,run,connectHost,finish,forget,shareReport,setSheet,setDraftHost,setNotes,setGesture,setLearner,setVideo,setVideoError,setToast,refresh}=p;
 const tabs=['home','device','history'].includes(page), inProgress=!!session;
 const sheetRef=useRef(null), priorFocus=useRef(null);
 const [filter,setFilter]=useState('all');
 const usableTemplates=templates.filter(t=>!t.needsReview).length;
 useEffect(()=>{
  if(!sheet)return;
  priorFocus.current=document.activeElement;
  const id=requestAnimationFrame(()=>sheetRef.current?.querySelector('button')?.focus());
  return()=>{cancelAnimationFrame(id);priorFocus.current?.focus?.();};
 },[sheet]);
 function trapKeys(e){
  if(e.key==='Escape'){if(!busy)setSheet('');return;}
  if(e.key!=='Tab')return;
  const nodes=Array.from(sheetRef.current.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]'));
  if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}
  else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}
 }
 const nextLabel=!online?'连接电脑主机':!fresh?'查看手套连接':inProgress?'返回当前练习':'进入练习';
 const prepare=()=>!online?openConnection():!fresh?go('device'):go('training');
 const testReport=r=>/联调|合成|测试/.test(r.notes||'');
 const visibleReports=reports.filter(r=>filter!=='practice'||!testReport(r));
 const totalSeconds=reports.reduce((sum,r)=>sum+r.duration,0);
 const recordRows=(rs,limit=50)=>rs.slice(0,limit).map(r=><button className="record-row" key={r.id} onClick={()=>openReport(r)}><span className="record-icon"><FileText size={23} weight="duotone"/></span><span className="record-copy"><b>{r.lesson}</b><small>{date(r.startedAt)}{testReport(r)&&<em>联调</em>}</small></span><span className="record-duration">{fmt(r.duration)}<CaretRight size={15}/></span></button>);
 const busyIcon=busy?<CircleNotch className="spin"/>:null;
 return <div className="app-shell">
  <div className="app-body" inert={sheet?true:undefined} aria-hidden={sheet?true:undefined}>
  <header className={'header '+(page==='home'?'brand-header':'')}>
   {!tabs&&<button className="icon-button back-button" aria-label="返回" disabled={busy} onClick={back}><CaretLeft size={23}/></button>}
   {page==='home'&&<span className="brand-mark"><Mark/></span>}<h1>{titles[page]}</h1>
   {page==='home'?<button className={'host-pill '+(online?'online':'')} onClick={openConnection} disabled={busy}><i/>{online?'主机在线':'连接主机'}<CaretRight size={12}/></button>:<button className="icon-button" aria-label="连接设置" disabled={busy} onClick={openConnection}><Gear size={22}/></button>}
  </header>
  <main key={page} className={'content '+page+(tabs?' with-tabs':'')+(page==='training'?' with-controls':'')}>
   {host&&!online&&page!=='connection'&&<button className="offline-banner" onClick={openConnection}><WifiSlash size={18}/><span>{cache?'已离线，历史记录仍可查看':'暂时无法连接主机'}</span><b>重连 <ArrowRight size={13}/></b></button>}
   {page==='home'&&<>
    <section className="home-intro"><div><span className="eyebrow">陶艺学习空间</span><h2>把手艺，<br/>练进日常。</h2></div><div className="intro-seal"><Mark/><span>手 作 日 常</span></div></section>
    {session&&<button className="session-resume" onClick={()=>go('training')}><span className="live-indicator"/><span><b>有一场{session.paused?'暂停中':'进行中'}的练习</b><small>{fmt(session.elapsed)} · 点击回到练习</small></span><ArrowUpRight/></button>}
    <button className="course-card" onClick={()=>go('training')} aria-label="查看揉泥基础课程"><div className="course-copy"><span className="course-number">01 <i/> 基础课程</span><h3>揉泥基础</h3><p>先找到节奏，<br/>再感受手与泥的配合。</p><span className="course-link">进入课程 <span><ArrowUpRight size={20}/></span></span></div><img src={art('pottery-hands')} alt="揉泥手法"/></button>
    <section className="preparation-card"><div className="section-heading"><h3>{fresh?'可以开始了':'练习前，准备一下'}</h3><span className="micro-label">设备准备</span></div><Readiness {...{online,fresh,cal}}/><button className="primary" onClick={prepare}>{nextLabel}<ArrowRight size={19}/></button></section>
    <div className="section-heading"><h3>最近练习</h3><button className="text-link" onClick={()=>go('history')}>查看全部 <ArrowUpRight size={16}/></button></div>{reports.length?<section className="records-card">{recordRows(reports,2)}</section>:<Empty title="第一份记录，等你开始" body="完成练习后，在这里回顾你的变化。"/>}
    <p className="page-footnote"><FlowerLotus size={16}/> 每一次练习，都是手感的积累</p>
   </>}
   {page==='device'&&<>
    <div className="page-intro"><span className="eyebrow">你的练习搭档</span><h2>手套准备好了吗？</h2><p>佩戴、连接，然后开始感受。</p></div>
    <section className="device-hero"><div className="device-hero-copy"><span className={'status-tag '+(fresh?'success':'')}>{fresh?'采样更新中':hw?.connected?'等待采样':'未连接'}</span><h3>陶艺手套</h3><p>五指感知 · 个人适配</p><span className="device-model">五指弯曲传感器</span></div><img src={art('glove-open')} alt="陶艺学习手套"/></section>
    <div className="connection-chain"><span className={online?'active':''}><Desktop/>{online?'主机在线':'主机离线'}</span><i/><span className={fresh?'active':''}><Hand/>{fresh?'手套就绪':'等待手套'}</span></div>
    {!fresh&&<section className="guidance-card"><Info size={21}/><div><h3>{!online?'先连接电脑主机':hw?.mode===1?'请切回采集模式':'在电脑上连接手套'}</h3><p>{!online?'手机与电脑连接同一 Wi-Fi 后，填写主机地址。':hw?.mode===1?'识别模式不会持续发送五指数据。在电脑切换后，这里会自动更新。':'打开手套电源，在电脑工作台扫描并连接 Glove。'}</p>{!online&&<button className="text-link" onClick={openConnection}>连接主机 <ArrowRight/></button>}</div></section>}
    <section className="surface"><div className="section-heading"><h3>五指状态</h3><span className={'micro-label '+(fresh?'live-text':'')}>{fresh?'实时':'等待数据'}</span></div><FingerReadings values={state?.device.values} fresh={fresh}/><details className="disclosure"><summary>查看采样曲线与说明</summary><Trace samples={state?.samples} fresh={fresh}/><p>数值范围 500–2500，表示传感器映射值，不是压力或关节角度。</p></details></section>
    <section className="menu-card"><button onClick={()=>go('calibrate')}><span className="menu-icon"><Gear/></span><span><b>个人校准</b><small>{cal?.completed?'已完成 · 重新佩戴后建议校准':'适配你的手型'}</small></span><CaretRight/></button><button onClick={()=>go('templates')}><span className="menu-icon clay"><Hand/></span><span><b>参考姿态</b><small>{usableTemplates} 个可用参考</small></span><CaretRight/></button></section>
   </>}
   {page==='connection'&&<>
    <div className="connection-illustration"><span><Desktop size={42} weight="light"/></span><i/><WifiHigh size={25}/><i/><span><Hand size={38} weight="light"/></span></div>
    <div className="page-intro"><span className="eyebrow">电脑采集，手机陪伴</span><h2>连接你的工作台</h2><p>同步手套状态、练习进度和每一份报告。</p></div>
    <form className="surface connection-form" onSubmit={e=>{e.preventDefault();connectHost();}}><label htmlFor="host">电脑主机地址</label><div className="input-wrap"><Desktop size={20}/><input id="host" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck="false" enterKeyHint="go" value={draftHost} onChange={e=>setDraftHost(e.target.value)} placeholder="192.168.1.20:4180"/></div><p className="field-help">在电脑工作台的「设置」中查看局域网地址。</p><button className="primary" disabled={busy} type="submit">{busyIcon}{busy?'正在连接…':online&&draftHost===host?'重新同步':'连接工作台'}{!busy&&<ArrowRight size={19}/>}</button>{toast&&<p className="form-result" role="status">{toast}</p>}</form>
    {host&&<div className={'saved-host '+(online?'connected':'')}><span className="status-dot"/><span><b>{online?'已连接此电脑':'上次使用的电脑'}</b><small>{host}</small></span>{online&&<CheckCircle size={21}/>}</div>}
    {!online&&error&&host&&<p className="inline-error">{error}</p>}
    <section className="connection-tips"><div><span>01</span><p><b>连接同一 Wi-Fi</b><small>确保手机与电脑在同一个局域网。</small></p></div><div><span>02</span><p><b>保持电脑工作台运行</b><small>手套的数据由电脑接收和保存。</small></p></div></section>
    <details className="disclosure help-details"><summary>还是连不上？</summary><p>手机不能使用 localhost；请填写电脑的局域网 IP 和端口。校园网络可能隔离设备，可尝试同一热点，并检查电脑防火墙是否允许工作台访问局域网。</p></details>
    {host&&<button className="text-link forget-link" onClick={()=>setSheet('forget')}>移除本机连接与缓存</button>}
   </>}
   {page==='calibrate'&&<>
    <div className="page-intro"><span className="eyebrow">让数据适应你的手</span><h2>{cal?.completed?'个人校准已完成':'找到你的活动范围'}</h2><p>{cal?.at?`最近更新 ${date(cal.at)}`:'重新佩戴手套后，先做一次自然的握拳与张开。'}</p></div>
    <div className="calibration-visual"><img src={art(cal?.completed?'glove-open':'glove-fist')} alt="手套校准姿态"/>{cal?.completed&&<span><CheckCircle weight="fill"/> 已校准</span>}</div>
    <section className="surface"><div className="section-heading"><h3>在电脑上完成三步</h3><Desktop size={19}/></div><ol className="calibration-steps">{[['自然握拳','手臂放松，采集握拳端点'],['张开五指','自然伸直，采集张开端点'],['保存校准','确认后保存到手套']].map(([title,desc],i)=><li key={title}><span>{i+1}</span><div><b>{title}</b><small>{desc}</small></div></li>)}</ol></section><button className="primary" onClick={()=>go('templates')}>查看参考姿态 <ArrowRight/></button><p className="field-help">校准完成后，请核对已有软件参考是否仍然适用。</p>
   </>}
   {page==='templates'&&<>
    <div className="page-intro"><span className="eyebrow">留下一个清晰的动作</span><h2>你的参考姿态</h2><p>练习时，与这些五指数据进行比较。</p></div>
    {templates.length?templates.map((t,i)=><article className="template-card" key={t.id}><span className="template-index">{String(i+1).padStart(2,'0')}</span><div><span className={'template-kind '+(t.kind==='incorrect'?'clay-text':'')}>{t.kind==='correct'?'参考姿态':'待纠正姿态'}</span><h3>{t.name}</h3><small>匹配容差 {t.tolerance}</small>{t.needsReview&&<p className="inline-error">校准已变化，请在电脑核对该参考。</p>}</div><Hand size={29} weight="light"/></article>):<Empty title="还没有参考姿态" body="连接手套，保持动作，保存五指数据作为参考。" Icon={Hand}/>}
    {!fresh&&<p className="inline-help"><Info/> 连接手套后才能采集新参考。</p>}{session&&<p className="inline-help"><Info/> 请先结束当前练习，再录入参考。</p>}
    <button className="primary" disabled={!canWrite||!fresh||!!session} onClick={()=>{setGesture({name:'',kind:'correct',tolerance:300});setSheet('template');}}><Plus/> 新增参考姿态</button><p className="field-help">只保存在电脑软件中，不覆盖手套硬件槽位。</p>
   </>}
   {page==='training'&&<>
    <div className="training-heading"><span className="eyebrow">{session?'专注这一次练习':'先观察，再练习'}</span><span className={'recording-status '+(session&&!session.paused?'live-text':'')}>{session?<><i/>{session.paused?'已暂停':'记录中'}</>:'尚未开始'}</span></div>
    <div className="lesson-container">{online&&!videoError?<video key={`${host}-${video}`} className="lesson" src={`${host}/media/lesson-${video}.mp4`} poster={art('pottery-hands')} controls playsInline preload="metadata" onError={()=>setVideoError(true)}/>:<div className="lesson-placeholder"><img src={art('pottery-hands')} alt="揉泥动作"/><span>{online?<button className="video-retry" onClick={()=>setVideoError(false)}><ArrowClockwise size={21}/> 视频暂不可用，点击重试</button>:<><Play size={22} weight="fill"/>连接主机后观看示范</>}</span></div>}</div>
    <div className="segmented" aria-label="示范角度">{['正面','侧面','近景'].map((v,i)=><button key={v} className={video===i?'active':''} aria-pressed={video===i} onClick={()=>{setVideo(i);setVideoError(false);}}>{v}示范</button>)}</div>
    {session?<section className={'practice-panel '+(session.paused?'paused':'')}><div className="practice-timer"><span>本次练习</span><strong>{fmt(session.elapsed)}</strong></div><div className="practice-metrics"><div><b>{session.matches}</b><small>姿态匹配</small></div><div><b>{session.sampleCount}</b><small>采集帧数</small></div></div><div className="practice-feedback"><span className="feedback-icon">{session.paused?<Pause/>:fresh&&state.feedback.kind==='match'?<Check/>:<Hand/>}</span><div><h3>{session.paused?'休息一下，再继续':fresh?state.feedback.text:'等待手套恢复采样'}</h3><p>{fresh&&state?.feedback.template?state.feedback.template:'请保持手套与电脑连接'}</p></div></div></section>:<section className="training-ready"><div className="section-heading"><h3>{fresh?'准备好，开始这一次':'开始前，检查设备'}</h3><Hand size={23}/></div><Readiness {...{online,fresh,cal}}/><p>{!online?'先连接电脑工作台，示范视频与练习数据就会同步。':!fresh?'请在电脑连接手套；采样恢复后，就可以开始记录。':usableTemplates?'按自己的节奏练习，软件会比对已保存的参考姿态。':'可以记录五指变化；先录入参考姿态，才能进行匹配。'}</p></section>}
    <details className="surface sensor-details"><summary><span><ChartLine/> 五指数据</span><small>{fresh?'实时更新':'等待采样'}</small></summary><FingerReadings values={state?.device.values} fresh={fresh} compact/><Trace samples={state?.samples} fresh={fresh}/><p className="field-help">映射值用于比较姿态，不代表压力或专业评分。</p></details>
    <p className="page-footnote">关闭手机页面不会结束电脑上的练习</p>
   </>}
   {page==='history'&&<>
    <button className="profile" onClick={()=>{setLearner(online?state.settings.learner:cache?.learner||'');setSheet('profile');}}><span className="avatar"><User size={29} weight="duotone"/></span><span><small>你好，学习者</small><h2>{online?state.settings.learner:cache?.learner||'陶艺学习者'}</h2></span><Gear size={21}/></button>
    <section className="learning-summary"><div><span>练习积累</span><strong>{Math.floor(totalSeconds/60)}<small> 分钟</small></strong></div><div><strong>{reports.length}<small> 次</small></strong><span>已保存练习</span></div><span className="summary-symbol"><Mark/></span></section>
    <div className="section-heading"><h3>练习记录</h3><button className="icon-button" aria-label="刷新练习记录" onClick={refresh}><ArrowClockwise size={20}/></button></div><div className="filter-row"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>全部记录 <span>{reports.length}</span></button><button className={filter==='practice'?'active':''} onClick={()=>setFilter('practice')}>隐藏联调记录</button></div>
    {visibleReports.length?<section className="records-card">{recordRows(visibleReports)}</section>:<Empty title={filter==='practice'?'还没有日常练习记录':'每次练习，都值得留下'} body={filter==='practice'?'联调记录已隐藏，可切回全部查看。':'完成第一次练习后，来这里回顾。'} Icon={FileText}/>}
    <p className="sync-caption"><span className={'status-dot '+(online?'online':'')}/>{online?'已同步电脑工作台':cache?`本机缓存 · ${date(cache.savedAt)}`:'连接电脑后同步记录'}</p>
   </>}
   {page==='report'&&(rep?<>
    <section className="report-cover"><span className="report-mark"><Mark/></span><span className="eyebrow">{testReport(rep)?'联调记录':'练习已完成'}</span><h2>{rep.lesson}</h2><p>{date(rep.startedAt)}</p><div className="report-time"><strong>{fmt(rep.duration)}</strong><span>本次练习时长</span></div></section>
    <div className="report-metrics"><div><span className="metric-icon"><ChartLine/></span><b>{rep.sampleCount}</b><small>采集帧数</small></div><div><span className="metric-icon clay"><CheckCircle/></span><b>{rep.matches}</b><small>匹配次数</small></div></div>
    <section className="surface"><div className="section-heading"><h3>姿态匹配轨迹</h3><Clock size={18}/></div>{rep.sampleCount?<><div className="timeline">{rep.timeline?.map((point,i)=><i key={i} className={point.matched?'matched':''}/>)}</div><div className="trace-labels"><span>00:00</span><span>{fmt(rep.duration)}</span></div><div className="legend"><span><i className="matched"/>匹配参考</span><span><i/>尚未匹配</span></div></>:<p className="field-help">本次没有采集到手套数据，仅记录了练习时长。</p>}</section>
    {rep.notes&&<section className="note-card"><span><FileText size={19}/> 练习手记</span><p>{rep.notes}</p></section>}
    <p className="inline-help"><Info/>姿态匹配用于练习参考，不代表专业陶艺评分。</p><div className="report-actions"><button className="secondary" disabled={busy} onClick={()=>run(shareReport)}><ShareNetwork/> 分享</button><button className="primary" onClick={()=>go('training')}>再练一次 <ArrowRight/></button></div>
   </>:<Empty title="暂时找不到这份记录" body="返回学习记录，查看已经同步的报告。" Icon={FileText}><button className="secondary" onClick={()=>go('history')}>返回记录</button></Empty>)}
  </main>
  {page==='training'&&<div className="training-controls">{session?<><div className="control-caption"><span className="status-dot online"/>{session.paused?'暂停期间不累计采样':'由电脑持续记录'}</div><div className="control-buttons"><button className="secondary" disabled={!canWrite} onClick={()=>run(()=>act(session.paused?'resume':'pause'))}>{busyIcon|| (session.paused?<Play weight="fill"/>:<Pause weight="fill"/>)}{session.paused?'继续':'暂停'}</button><button className="primary" disabled={!canWrite} onClick={()=>{setNotes('');setSheet('finish');}}>结束并保存 <CheckSquare size={20}/></button></div></>:<><span className="control-caption">{!online?'连接电脑后开始记录':!fresh?'等待手套连接':usableTemplates?'设备已就绪，可以开始':'可记录数据，暂未配置匹配参考'}</span><button className="primary" disabled={busy} onClick={()=>fresh?start():!online?openConnection():go('device')}>{busyIcon||(fresh?<Play weight="fill"/>:!online?<Desktop/>:<Hand/>)}{fresh?'开始练习':!online?'连接电脑主机':'检查手套连接'}</button></>}</div>}
  {tabs&&<nav className="tabs" aria-label="底部导航">{[['home','学习',House],['device','设备',Hand],['history','我的',User]].map(([id,label,Icon])=><button key={id} className={page===id?'active':''} aria-current={page===id?'page':undefined} onClick={()=>go(id,true)}><span><Icon size={23} weight={page===id?'fill':'regular'}/></span>{label}</button>)}</nav>}
  </div>
  {sheet&&<div className="scrim" onClick={()=>!busy&&setSheet('')}><section ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onKeyDown={trapKeys} onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="section-heading"><h2 id="sheet-title">{{finish:'收好这一次练习',template:'留下参考姿态',profile:'学习者设置',forget:'移除本机连接'}[sheet]}</h2><button className="icon-button" aria-label="关闭" disabled={busy} onClick={()=>setSheet('')}><X size={22}/></button></div>
   {sheet==='finish'&&<><div className="finish-summary"><Clock size={21}/><b>{fmt(session?.elapsed)}</b><span>{session?.sampleCount||0} 帧已采集</span></div><label>练习手记 <small>选填</small><textarea value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)} placeholder="这次有什么新感受？"/></label><p className="field-help">结束后，报告会保存在电脑并同步到手机。</p><button className="primary" disabled={!canWrite} onClick={finish}>{busyIcon}{busy?'正在保存…':'结束练习并保存'}</button></>}
   {sheet==='template'&&<><p className="sheet-description">保持一个自然、稳定的动作，采集当前五指数据。</p><label>姿态名称<input value={gesture.name} maxLength={40} onChange={e=>setGesture({...gesture,name:e.target.value})} placeholder="例如：自然张开"/></label><div className="segmented">{[['correct','参考姿态'],['incorrect','待纠正姿态']].map(([kind,label])=><button key={kind} className={gesture.kind===kind?'active':''} aria-pressed={gesture.kind===kind} onClick={()=>setGesture({...gesture,kind})}>{label}</button>)}</div><label>匹配容差<input type="number" min="1" max="5000" value={gesture.tolerance} onChange={e=>setGesture({...gesture,tolerance:Number(e.target.value)})}/></label><p className="field-help">保存在软件中，不会改动手套原有模板。</p><button className="primary" disabled={!canWrite||!fresh||!!session||!gesture.name.trim()} onClick={()=>run(async()=>{await act('template',gesture);setSheet('');setToast('参考姿态已保存');})}>{busyIcon}采集并保存</button></>}
   {sheet==='profile'&&<><label>你的称呼<input value={learner} maxLength={40} onChange={e=>setLearner(e.target.value)} placeholder="怎么称呼你？"/></label><p className="field-help">同步到当前电脑工作台。</p><button className="primary" disabled={!canWrite||!learner.trim()} onClick={()=>run(async()=>{await act('settings',{learner:learner.trim()});setSheet('');setToast('称呼已更新');})}>{busyIcon}保存设置</button></>}
   {sheet==='forget'&&<><p className="sheet-description">移除这台手机的电脑地址和报告缓存。电脑上的原始记录与正在进行的练习都会保留。</p><button className="primary destructive" onClick={forget}>移除本机数据</button><button className="secondary" onClick={()=>setSheet('')}>继续保留</button></>}
  </section></div>}
  {toast&&page!=='connection'&&<div className="toast" role="status"><Info size={18}/><span>{toast}</span><button aria-label="关闭提示" onClick={()=>setToast('')}><X size={16}/></button></div>}
 </div>;
}
