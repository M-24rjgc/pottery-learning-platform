import {useEffect,useRef,useState} from 'react';
import {X,CheckCircle} from '@phosphor-icons/react';
import SensorChart from './Chart';
import {ART,names,colors,request} from './studio';
import './calibration-dialog.css';

export function CalibrationDialog({state:s,error,onClose}){
 const [step,setStep]=useState('fist'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[saved,setSaved]=useState(false);
 const panel=useRef(null),lock=useRef(false);
 const h=s.hardware||{},fresh=!error&&h.connected&&h.sampleFresh&&Date.now()-h.lastSampleAt<3000;
 const blocked=busy||!!h.busy||!h.connected||!!error||h.desynchronized||h.canControl===false||!!s.session;
 useEffect(()=>{
  const previous=document.activeElement,overflow=document.body.style.overflow;
  const background=[...document.querySelectorAll('.workspace,.sidebar')];
  const previousInert=background.map(el=>el.inert);background.forEach(el=>el.inert=true);
  document.body.style.overflow='hidden';panel.current?.querySelector('button')?.focus();
  return()=>{background.forEach((el,i)=>el.inert=previousInert[i]);document.body.style.overflow=overflow;previous?.focus?.();};
 },[]);
 async function command(text,next){
  if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
  try{
   const result=await request('/api/hardware/command',{command:text});
   setMessage('手套已确认：'+result.reply);
   if(next)setStep(next);
   if(text==='SAVE')setSaved(true);
  }catch(e){setMessage(e.name==='TimeoutError'||e.name==='TypeError'?'未收到手套确认，操作可能已生效。请先查看设备状态，不要连续重复点击。':e.message);}
  finally{lock.current=false;setBusy(false);}
 }
 const close=()=>{if(!lock.current)onClose();};
 function keys(e){
  if(e.key==='Escape'){e.preventDefault();close();}
  if(e.key==='Tab'){
   const buttons=[...panel.current.querySelectorAll('button:not(:disabled)')];
   if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}
   else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus();}
  }
 }
 const title=step==='fist'?'自然握拳，保持稳定':step==='open'?'张开五指，保持稳定':saved?'校准已保存':'再握拳、张开，检查变化';
 return <div className="modal-backdrop calibration-backdrop" onClick={close}><section className="modal calibration-dialog" role="dialog" aria-modal="true" aria-labelledby="calibration-title" ref={panel} onClick={e=>e.stopPropagation()} onKeyDown={keys}>
  <button className="modal-close icon-button" aria-label="关闭校准" disabled={busy} onClick={close}><X size={24}/></button>
  <h2 id="calibration-title">手套实时校准</h2><p className="muted">一边做动作，一边观察五指数据。无需离开训练工作台。</p>
  <ol className="quick-cal-steps">{[['fist','握拳'],['open','张开'],['verify','检查与保存']].map(([id,label],i)=><li key={id} aria-current={step===id?'step':undefined} className={step===id?'current':''}><b>{i+1}</b>{label}</li>)}</ol>
  <div className="quick-cal-grid"><div className="quick-cal-pose">
   {step==='verify'?<div className="quick-cal-pair"><img src={ART+'glove-fist.png'} alt="自然握拳示意"/><img src={ART+'glove-open.png'} alt="五指张开示意"/></div>:<img src={ART+(step==='fist'?'glove-fist.png':'glove-open.png')} alt={step==='fist'?'自然握拳示意':'五指张开示意'}/>}
   <h3>{title}</h3><p>{step==='fist'?'五指自然弯曲，拇指收拢，不用用力攥紧。稳定约一秒后点击采集。':step==='open'?'自然伸直五指，拇指也展开。保持约一秒后点击采集。':'观察每一指是否随动作变化：握拳应接近 500，张开应接近 2500。固定在上限不能单凭数值判定传感器损坏。'}</p>
   {step==='fist'&&<button className="primary full" disabled={blocked||!fresh||h.mode!==0} onClick={()=>command('CALIB_MIN','open')}>{busy?'正在采集…':'采集握拳端点'}</button>}
   {step==='open'&&<button className="primary full" disabled={blocked||!fresh||h.mode!==0} onClick={()=>command('CALIB_MAX','verify')}>{busy?'正在采集…':'采集张开端点'}</button>}
   {step==='verify'&&!saved&&<button className="primary full" disabled={blocked||!fresh||h.calibrationStage!=='complete'} onClick={()=>command('SAVE')}>{busy?'正在保存…':'效果确认，保存到手套'}</button>}
   {saved&&<p className="quick-cal-success"><CheckCircle/>已收到保存确认</p>}
   {step!=='fist'&&<button disabled={busy||!!h.busy} onClick={()=>{setStep('fist');setSaved(false);setMessage('请重新握拳，再点击采集。');}}>重新采集握拳</button>}
  </div><div className="quick-cal-data"><div className="panel-heading"><h3>五指实时数据</h3><span className={'badge '+(fresh?'active':'')}>{fresh?'实时更新':'等待采样'}</span></div>
   <div className="quick-cal-values">{names.map((name,i)=><div key={name}><span><i style={{background:colors[i]}}/>{name}</span><strong>{fresh?h.values?.[i]??'—':'—'}</strong><div className="quick-cal-track"><i style={{width:fresh?`${Math.max(0,Math.min(100,((h.values?.[i]??500)-500)/20))}%`:'0%',background:colors[i]}}/></div></div>)}</div>
   <SensorChart samples={fresh?s.samples:[]} seconds={10}/><p className="muted">500–2500 为映射值，不是压力或关节角度。采集后继续观察曲线，确认每一指都能变化。</p>
  </div></div>
  {(!fresh||h.mode!==0||s.session||h.desynchronized||error)&&<p className="notice">{error|| (s.session?'请先结束当前练习，再校准。':h.desynchronized?'设备命令状态待确认，请先检查设备连接。':!h.connected?'请先在设备页连接手套，再进行校准。':h.mode!==0?'请先在设备页切换到采集模式 0。':'暂未收到新采样，恢复数据后才能采集。')}</p>}
  <p className="quick-cal-message" role="status">{message||'等待你做好姿态后手动采集。打开弹窗不会修改校准。'}</p>
  <p className="muted">校准会改变映射，完成后需核对已有软件参考。关闭弹窗不会撤销已采集端点；未点击保存的结果尚未保存到手套。</p>
 </section></div>;
}
