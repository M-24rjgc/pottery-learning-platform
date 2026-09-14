import {useEffect, useRef, useState} from 'react';
import {App as NativeApp} from '@capacitor/app';
import {Share} from '@capacitor/share';
import StudioView from './StudioView.jsx';
import {client, connect, readHost, readCache, saveCache, clearLocal, native} from './api';
import {validateState, reportText, isLive} from './model.mjs';

export default function App() {
 const [host,setHost]=useState(readHost),[state,setState]=useState(null),[cache,setCache]=useState(()=>readCache(readHost())),[connected,setOnline]=useState(false),[error,setError]=useState('');
 const [lastSync,setLastSync]=useState(0),[now,setNow]=useState(Date.now);
 const online=isLive(connected,lastSync,now);
 const [page,setPage]=useState('home'),[sheet,setSheet]=useState(''),[busy,setBusy]=useState(false),[toast,setToast]=useState(''),[draftHost,setDraftHost]=useState(readHost),[selected,setSelected]=useState(null),[notes,setNotes]=useState(''),[video,setVideo]=useState(0),[videoError,setVideoError]=useState(false);
 const [gesture,setGesture]=useState({name:'',kind:'correct',tolerance:300});
 const [learner,setLearner]=useState('');
 const generation=useRef(0),revision=useRef(0),lock=useRef(false),refreshRef=useRef(null),backRef=useRef(null),polling=useRef(false),cacheAt=useRef(0);
 const reports=online?state?.reports||[]:cache?.reports||[];
 const templates=online?state?.templates||[]:cache?.templates||[];
 const cal=online?state?.calibration:cache?.calibration;
 const session=online?state?.session:null, fresh=!!(online&&state?.device?.connected&&state?.hardware?.sampleFresh);
 const hw=online?state?.hardware:null;
 const rep=reports.find(r=>r.id===selected)||null;
 const canWrite=online&&!busy;
 const navigation=useRef([]),restoreScroll=useRef(0);
 const go=(next,root=false)=>{
  setSheet('');setToast('');
  if(root)navigation.current=[];
  if(next===page)return;
  if(!root)navigation.current.push({page,scroll:document.querySelector('.content')?.scrollTop||0});
  restoreScroll.current=0;setPage(next);
 };
 const openConnection=()=>{setDraftHost(host);go('connection');};
 const openReport=r=>{setSelected(r.id);go('report');};
 const back=()=>{
  if(lock.current)return;
  if(sheet){setSheet('');return;}setToast('');
  const previous=navigation.current.pop()||{page:'home',scroll:0};
  restoreScroll.current=previous.scroll;setPage(previous.page);
 };
 backRef.current=()=>{if(lock.current)return;if(page==='home'&&!sheet){if(native)NativeApp.minimizeApp();}else back();};
 useEffect(()=>{const content=document.querySelector('.content');if(content)content.scrollTop=restoreScroll.current;},[page]);

 useEffect(()=>{if(!native)return;const listener=NativeApp.addListener('backButton',()=>backRef.current?.());return()=>{listener.then(l=>l.remove());};},[]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),5500);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>{
  const token=++generation.current;let cancelled=false;polling.current=false;
  setOnline(false);setState(null);setCache(readCache(host));cacheAt.current=0;
  async function poll(){
   if(!host||cancelled||polling.current||document.hidden)return;
   polling.current=true;const requestRevision=revision.current;
   try {const s=validateState(await client(host)('/api/state?client=mobile'));if(cancelled||token!==generation.current||requestRevision!==revision.current)return;
    setState(s);setLastSync(Date.now());setOnline(true);setError('');
    if(Date.now()-cacheAt.current>5000){saveCache(s,host);setCache(readCache(host));cacheAt.current=Date.now();}
   }catch(e){if(!cancelled&&token===generation.current){setOnline(false);setError(e.message);}}
   finally{if(token===generation.current)polling.current=false;}
  }
  refreshRef.current=poll;poll();const timer=setInterval(poll,800);document.addEventListener('visibilitychange',poll);
  return()=>{cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',poll);};
 },[host]);

 async function run(fn){if(lock.current)return;lock.current=true;setBusy(true);try{return await fn();}catch(e){setToast(e.message);}finally{lock.current=false;setBusy(false);}}
 async function act(type,payload={}) {
  if(!online)throw Error('电脑未连接，恢复连接后才能操作');
  revision.current++;
  try {
   const result=await client(host)('/api/action',{type,payload});
   revision.current++;
   if(type!=='finish'){validateState(result);setState(result);saveCache(result,host);setCache(readCache(host));}
   else {const next={...state,session:null,reports:[result,...state.reports.filter(r=>r.id!==result.id)]};setState(next);saveCache(next,host);setCache(readCache(host));setSelected(result.id);}
   await refreshRef.current?.();return result;
  } catch(e) {await refreshRef.current?.();throw e;}
 }
 const start=()=>run(async()=>{if(!session){if(!fresh)throw Error('请先在电脑连接手套并确认有实时采样');await act('start');}go('training');});
 async function shareReport(){const text=reportText(rep);if(native){await Share.share({title:'非遗之手 · 学习报告',text,dialogTitle:'分享练习报告'});}else if(navigator.share){await navigator.share({title:'学习报告',text});}else {await navigator.clipboard.writeText(text);setToast('报告摘要已复制');}}

 const connectHost=()=>run(async()=>{const result=await connect(draftHost);setLastSync(Date.now());setHost(result.host);setDraftHost(result.host);if(result.host===host){setState(result.state);setOnline(true);setError('');setCache(readCache(host));}go('home',true);setToast('已连接电脑工作台');});
 const finish=()=>run(async()=>{await act('finish',{notes});setSheet('');go('report');});
 const forget=()=>{clearLocal();setHost('');setState(null);setCache(null);setOnline(false);setSelected(null);setDraftHost('');setSheet('');setError('');};
 return <StudioView {...{host,state,cache,online,error,reports,templates,cal,session,fresh,hw,rep,busy,page,sheet,toast,draftHost,notes,gesture,learner,video,videoError,canWrite,go,back,openConnection,openReport,start,act,run,connectHost,finish,forget,shareReport,setSheet,setDraftHost,setNotes,setGesture,setLearner,setVideo,setVideoError,setToast}} refresh={()=>refreshRef.current?.()}/>;
}
