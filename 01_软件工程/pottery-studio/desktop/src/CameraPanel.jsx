import {useEffect,useState} from 'react';
import {API,request,action} from './studio';
export function CameraPanel({camera={},session}){
 const[devices,setDevices]=useState([]),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[tick,setTick]=useState(0);
 useEffect(()=>{if(!camera.opened)return;const t=setInterval(()=>setTick(Date.now()),400);return()=>clearInterval(t);},[camera.opened]);
 async function run(fn){setBusy(true);try{await fn();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 async function refresh(){const r=await request('/api/camera/devices');setDevices(r.devices);setSelected(r.devices[0]||'');setMessage(r.devices.length?'选择相机后打开预览':'没有发现摄像头');}
 return <section className="panel" style={{marginTop:20}}><h3>我的动作画面</h3><p className="muted">相机画面用于观察与回放。打开相机后，用下方按钮开始练习可同时录像。</p>
  <div className="button-row"><select aria-label="动作摄像头" value={selected} disabled={camera.opened} onChange={e=>setSelected(e.target.value)}><option value="">选择摄像头</option>{devices.map(n=><option key={n}>{n}</option>)}</select><button disabled={busy||camera.opened} onClick={()=>run(refresh)}>查找摄像头</button>{camera.opened?<button disabled={busy||!!session} onClick={()=>run(()=>request('/api/camera/stop',{}))}>关闭相机</button>:<button disabled={busy||!selected||!!session} onClick={()=>run(()=>request('/api/camera/start',{name:selected}))}>打开相机</button>}</div>
  {camera.opened&&<div style={{marginTop:12}}>{camera.live?<img src={API+'/api/camera/frame?t='+tick} alt="实时动作摄像头画面" style={{width:'100%',maxHeight:420,objectFit:'contain',borderRadius:12}}/>:<p className="notice">相机画面暂未更新</p>}</div>}
  <p role="status">{camera.error||message||'相机尚未打开'}{camera.recording?' · 本次练习录像中':''}</p>
  <button className="primary" disabled={busy||!camera.live||!!session} onClick={()=>run(()=>action('start',{recordCamera:true}))}>开始练习并录像</button>
 </section>;
}
