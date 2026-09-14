import {useEffect,useState} from 'react';
import {API,request} from './studio';

export function HardwarePanel({hardware:h={},session}){
 const[ports,setPorts]=useState([]),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[slot,setSlot]=useState(0),[tolerance,setTolerance]=useState(100);
 async function run(fn){setBusy(true);try{await fn();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 async function refresh(ble=false){const d=await request('/api/hardware/ports'+(ble?'?transport=ble':''));setPorts(d.ports);setSelected(old=>d.ports.some(p=>p.path===old)?old:(d.ports[0]?.path||''));setMessage(d.ports.length?'已找到设备，选择后连接。':ble?'未发现手套，请确认手套和电脑蓝牙都已开启。':'可扫描蓝牙手套，或接USB线后刷新串口。');}
 useEffect(()=>{refresh().catch(e=>setMessage(e.message));},[]);
 async function command(text){
  const res=await fetch(API+'/api/hardware/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:text}),signal:AbortSignal.timeout(8000)});
  const d=await res.json();if(!res.ok)throw Error(d.error||'设备操作失败');setMessage('设备已确认：'+d.reply);
 }
 const linkDisabled=busy||!!h.busy||!h.connected||h.desynchronized;
 const disabled=linkDisabled||h.canControl===false;
 const setupDisabled=disabled||!!session;
 return <section id="hardware-panel" className="panel" style={{marginBottom:20}} aria-label="真实手套接入">
  <div className="panel-heading"><div><h3>真实手套接入</h3><p className="muted">电脑主机连接手套，小程序共享同一设备与练习记录。</p></div><span className={'badge '+(h.connected?'active':'')}>{h.connected?(h.transport==='ble'?'手套蓝牙已连接':`${h.path} 串口已打开`):'尚未连接'}</span></div>
  <div className="button-row"><select aria-label="手套连接设备" value={selected} onChange={e=>setSelected(e.target.value)} disabled={h.connected}>{!ports.length&&<option value="">请先扫描或刷新</option>}{ports.map(p=><option key={p.path} value={p.path}>{p.transport==='ble'?'蓝牙手套':p.path} {p.manufacturer}</option>)}</select><button disabled={busy||h.connected} onClick={()=>run(()=>refresh(true))}>{busy?'请稍候…':'扫描蓝牙手套'}</button><button disabled={busy||h.connected} onClick={()=>run(()=>refresh())}>刷新串口</button>{h.connected?<button disabled={busy} onClick={()=>run(async()=>{await request('/api/hardware/disconnect',{});setMessage('已断开主机连接');})}>断开主机连接</button>:<button className="primary" disabled={busy||!selected||!!session} onClick={()=>run(async()=>{await request('/api/hardware/connect',{path:selected});setMessage('设备已连接，等待真实五指数据。');})}>{selected.startsWith('BLE:')?'连接蓝牙手套':'连接手套（9600）'}</button>}</div>
  <p>采样：{h.connected&&h.sampleFresh?'正在更新':h.connected&&h.mode===1?'识别模式不输出连续五指数据':'等待数据'}　模式：{h.mode===0?'0 采集':h.mode===1?'1 识别':'待确认'}　配置：{h.unsaved?'已修改，尚未保存到手套':'暂无待保存修改'}</p>
  {h.transport==='ble'&&<p className="notice">蓝牙已支持模式、校准、录入与保存。校准时先握拳保持约一秒，再张开保持约一秒；原固件不返回已有模板清单，录入会覆盖你选择的槽位。</p>}
  <div className="button-row"><button disabled={linkDisabled} onClick={()=>run(()=>command('MODE 0'))}>采集模式0</button><button disabled={linkDisabled} onClick={()=>run(()=>command('MODE 1'))}>识别模式1</button><button disabled={linkDisabled} onClick={()=>run(()=>command('STATUS'))}>查询设备模式</button><button disabled={disabled||h.transport==='ble'} onClick={()=>run(()=>command('LIST'))}>读取手套模板</button></div>
  <div className="button-row" style={{marginTop:12}}><button disabled={setupDisabled} onClick={()=>run(()=>command('CALIB_MIN'))}>手套校准：握拳</button><button disabled={setupDisabled} onClick={()=>run(()=>command('CALIB_MAX'))}>手套校准：张开</button><button disabled={disabled} onClick={()=>run(()=>command('SAVE'))}>保存到手套</button><button disabled={setupDisabled} onClick={()=>run(()=>command('LOAD'))}>从手套加载</button></div>
  <div className="button-row" style={{marginTop:12}}><label>硬件模板槽位 <select aria-label="硬件模板槽位" value={slot} onChange={e=>setSlot(Number(e.target.value))}>{Array.from({length:10},(_,i)=><option key={i} value={i}>{i} · {i<5?'正确姿态':'错误姿态'}</option>)}</select></label><label>容差 <input aria-label="硬件模板容差" type="number" min="1" max="1000" value={tolerance} onChange={e=>setTolerance(e.target.value)} style={{width:90}}/></label><button disabled={setupDisabled} onClick={()=>run(()=>command(`RECORD ${slot} ${tolerance}`))}>录入所选槽位</button></div>
  <p className="hint">录入会覆盖所选硬件槽位；请先读取模板确认。硬件录入确认后会在软件中建立同槽位的参考姿态。既有硬件模板无法通过蓝牙读取；软件记录的五路值取自发送命令前的稳定采样。</p>
  {h.mode===1&&<p className="notice">硬件识别：{h.recognition?(h.recognition.kind==='correct'?`正确模板 ${h.recognition.id}`:h.recognition.id!==null?`错误模板 ${h.recognition.id}`:'匹配错误模板；当前USB协议不提供模板ID'):'当前没有新的识别结果'}。连续曲线需要后续固件适配。</p>}
  <p role="status">{h.error||message||'连接后先确认逐指数据，再进行标定。'}</p>
  <details><summary>设备命令与回执</summary><pre style={{whiteSpace:'pre-wrap',maxHeight:230,overflow:'auto',fontSize:12}}>{(h.logs||[]).map(x=>`${new Date(x.at).toLocaleTimeString()} [${x.kind}] ${x.text}`).join('\n')||'暂无设备日志'}</pre></details>
 </section>;
}
