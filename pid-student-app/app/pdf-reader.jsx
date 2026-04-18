import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// ─── HTML Shell — Night mode support ───
function buildPdfHtmlShell(nightMode) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    html, body {
      width:100%; height:100%;
      background:${nightMode ? '#111827' : '#1e1e2e'};
      overflow:hidden;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    }
    #scrollArea {
      height:100%; width:100%;
      overflow:auto;
      -webkit-overflow-scrolling:touch;
      overscroll-behavior:contain;
      touch-action:pan-x pan-y;
    }
    #zoomSizer { position:relative; display:block; min-width:100%; box-sizing:content-box; }
    #zoomLayer { transform-origin:0 0; padding:12px 10px 60px; box-sizing:border-box; }
    #pagesContainer { display:flex; flex-direction:column; align-items:center; gap:14px; }
    .page-slot {
      background:${nightMode ? '#1f2937' : '#fff'};
      border-radius:8px;
      box-shadow:0 4px 24px rgba(0,0,0,0.5);
      overflow:hidden;
      display:flex; align-items:center; justify-content:center;
      position:relative;
    }
    .page-slot canvas {
      display:block; vertical-align:top; max-width:none;
      ${nightMode ? 'filter:invert(1) hue-rotate(180deg) brightness(0.88);' : ''}
    }
    .page-num {
      position:absolute; bottom:6px; right:8px;
      background:rgba(0,0,0,0.5); color:#fff;
      font-size:10px; padding:2px 8px; border-radius:10px;
      pointer-events:none; font-family:monospace;
    }
    .page-loading {
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:10px;
      padding:36px; color:#64748b; font-size:13px; min-height:160px;
    }
    .spin {
      width:24px; height:24px;
      border:3px solid rgba(201,164,78,0.2);
      border-top-color:#C9A44E;
      border-radius:50%;
      animation:sp 0.8s linear infinite;
    }
    @keyframes sp { to { transform:rotate(360deg); } }
    .error-msg { color:#fca5a5; text-align:center; padding:24px; font-size:13px; }
  </style>
</head>
<body>
  <div id="scrollArea">
    <div id="zoomSizer">
      <div id="zoomLayer">
        <div id="pagesContainer"></div>
      </div>
    </div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</body>
</html>`;
}

// ─── Inline PDF Script ───
function buildInlineScript(pdfData) {
  return `
(function boot(){
  if(typeof pdfjsLib==='undefined'){setTimeout(boot,40);return;}
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  var pdfBase64=${JSON.stringify(pdfData)};
  var pdfDoc=null, fitScale=1, displayScale=1;
  var pinchStartDist=0, scaleAtPinchStart=1, pinchOriginX=0, pinchOriginY=0;
  var lastTap=0, tapTimer=null, tapDown=null, tapMoved=false, didPinch=false, rafScroll=null;
  var rendered={};

  var scrollArea=document.getElementById('scrollArea');
  var zoomSizer=document.getElementById('zoomSizer');
  var zoomLayer=document.getElementById('zoomLayer');
  var pagesContainer=document.getElementById('pagesContainer');

  function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}

  function base64ToUint8Array(b64){
    var raw=atob(b64), arr=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
    return arr;
  }

  function getDist(t){
    var dx=t[0].clientX-t[1].clientX, dy=t[0].clientY-t[1].clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }

  function refreshZoomSizer(){
    if(!zoomSizer||!zoomLayer||!pagesContainer||!scrollArea) return;
    requestAnimationFrame(function(){
      var baseW=Math.max(pagesContainer.scrollWidth, scrollArea.clientWidth);
      var baseH=Math.max(pagesContainer.scrollHeight, scrollArea.clientHeight);
      zoomLayer.style.width=baseW+'px';
      zoomSizer.style.width=Math.ceil(baseW*displayScale)+'px';
      zoomSizer.style.height=Math.ceil(baseH*displayScale)+'px';
    });
  }

  // FIX 1: Correct pinch-origin zoom + FIX 2: Smooth (pow 0.38)
  function applyDisplayScale(newScale, ox, oy){
    newScale=Math.max(0.5, Math.min(5.0, newScale));
    if(ox!==undefined && oy!==undefined){
      var ratio=newScale/displayScale;
      var rx=scrollArea.scrollLeft+ox;
      var ry=scrollArea.scrollTop+oy;
      displayScale=newScale;
      zoomLayer.style.transformOrigin='0 0';
      zoomLayer.style.transform='scale('+displayScale+')';
      scrollArea.scrollLeft=rx*ratio-ox;
      scrollArea.scrollTop=ry*ratio-oy;
    } else {
      displayScale=newScale;
      zoomLayer.style.transformOrigin='0 0';
      zoomLayer.style.transform='scale('+displayScale+')';
    }
    post({type:'zoomPct', value:Math.round(displayScale*100)});
    refreshZoomSizer();
  }

  function goToPage(pageNum){
    var slot=pagesContainer.querySelector('[data-page="'+pageNum+'"]');
    if(slot){
      var r=slot.getBoundingClientRect(), sr=scrollArea.getBoundingClientRect();
      scrollArea.scrollTop+=(r.top-sr.top)-16;
    }
  }

  function updateVisiblePage(){
    var slots=pagesContainer.querySelectorAll('.page-slot');
    var vr=scrollArea.getBoundingClientRect();
    var best=1, bestOverlap=-1;
    for(var i=0;i<slots.length;i++){
      var r=slots[i].getBoundingClientRect();
      var overlap=Math.max(0,Math.min(r.bottom,vr.bottom)-Math.max(r.top,vr.top));
      if(overlap>bestOverlap){bestOverlap=overlap; best=parseInt(slots[i].dataset.page,10)||best;}
    }
    post({type:'visiblePage', value:best});
  }

  scrollArea.addEventListener('scroll',function(){
    if(rafScroll) cancelAnimationFrame(rafScroll);
    rafScroll=requestAnimationFrame(updateVisiblePage);
  },{passive:true});

  // Touch events
  scrollArea.addEventListener('touchstart',function(e){
    if(e.touches.length>=2){
      didPinch=true; tapDown=null;
      pinchStartDist=getDist(e.touches);
      scaleAtPinchStart=displayScale;
      var rect=scrollArea.getBoundingClientRect();
      // FIX: Dono fingers ka center — scroll position consider karo
      pinchOriginX=((e.touches[0].clientX+e.touches[1].clientX)/2)-rect.left;
      pinchOriginY=((e.touches[0].clientY+e.touches[1].clientY)/2)-rect.top;
    } else if(e.touches.length===1){
      tapMoved=false;
      tapDown={x:e.touches[0].clientX, y:e.touches[0].clientY, t:Date.now()};
    }
  },{passive:true});

  scrollArea.addEventListener('touchmove',function(e){
    if(e.touches.length===2 && pinchStartDist>0){
      e.preventDefault();
      var d=getDist(e.touches);
      // FIX: pow(0.38) = bahut smooth zoom
      var smooth=Math.pow(d/pinchStartDist, 0.38);
      applyDisplayScale(scaleAtPinchStart*smooth, pinchOriginX, pinchOriginY);
      return;
    }
    if(e.touches.length===1 && tapDown){
      var mx=Math.abs(e.touches[0].clientX-tapDown.x);
      var my=Math.abs(e.touches[0].clientY-tapDown.y);
      if(mx>12||my>12) tapMoved=true;
    }
  },{passive:false});

  scrollArea.addEventListener('touchend',function(e){
    if(e.touches.length<2) pinchStartDist=0;
    if(e.touches.length===0){
      if(!didPinch && tapDown && !tapMoved && e.changedTouches.length===1){
        var dt=Date.now()-tapDown.t;
        if(dt<400){
          var now=Date.now();
          if(now-lastTap<280){
            // Double tap: zoom toggle
            clearTimeout(tapTimer);
            var rect2=scrollArea.getBoundingClientRect();
            var ox=e.changedTouches[0].clientX-rect2.left;
            var oy=e.changedTouches[0].clientY-rect2.top;
            applyDisplayScale(displayScale>1.2?1.0:2.2, ox, oy);
            lastTap=0;
          } else {
            lastTap=now;
            tapTimer=setTimeout(function(){
              // Single tap: chrome toggle
              post({type:'toggleChrome'});
            },280);
          }
        }
      }
      didPinch=false; tapDown=null;
    }
  },{passive:true});

  // Messages from React Native
  function receiveMessage(ev){
    var raw=ev.data||ev.detail||(ev.nativeEvent&&ev.nativeEvent.data);
    var data; try{data=JSON.parse(raw);}catch(x){return;}
    if(!data||!data.type) return;
    var cx=scrollArea.clientWidth/2, cy=scrollArea.clientHeight/2;
    if(data.type==='zoomIn') applyDisplayScale(displayScale*1.2, cx, cy);
    if(data.type==='zoomOut') applyDisplayScale(displayScale/1.2, cx, cy);
    if(data.type==='zoomReset') applyDisplayScale(1.0, cx, cy);
    if(data.type==='goToPage' && data.value) goToPage(data.value);
    if(data.type==='reflow') refreshZoomSizer();
    if(data.type==='nightToggle'){
      var canvases=document.querySelectorAll('.page-slot canvas');
      var f=data.value?'invert(1) hue-rotate(180deg) brightness(0.88)':'none';
      canvases.forEach(function(c){c.style.filter=f;});
      document.body.style.background=data.value?'#111827':'#1e1e2e';
    }
  }
  document.addEventListener('message', receiveMessage);
  window.addEventListener('message', receiveMessage);

  var rendered={};

  function renderSlot(pageNum, el){
    if(!pdfDoc||rendered[pageNum]||el.dataset.rendering==='1') return;
    el.dataset.rendering='1';
    pdfDoc.getPage(pageNum).then(function(page){
      var dpr=window.devicePixelRatio||1;
      var viewport=page.getViewport({scale:fitScale*dpr});
      var canvas=document.createElement('canvas');
      var ctx=canvas.getContext('2d');
      canvas.width=Math.floor(viewport.width);
      canvas.height=Math.floor(viewport.height);
      canvas.style.width=Math.floor(viewport.width/dpr)+'px';
      canvas.style.height=Math.floor(viewport.height/dpr)+'px';
      el.innerHTML='';
      el.appendChild(canvas);
      // Page number badge
      var badge=document.createElement('div');
      badge.className='page-num';
      badge.textContent=pageNum;
      el.appendChild(badge);
      rendered[pageNum]=true;
      return page.render({canvasContext:ctx, viewport:viewport}).promise;
    }).catch(function(err){
      el.innerHTML='<div class="error-msg">Page load failed</div>';
      post({type:'error', value:String(err)});
    });
  }

  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting) return;
      renderSlot(parseInt(entry.target.dataset.page,10), entry.target);
    });
  },{root:scrollArea, rootMargin:'700px 0px', threshold:0});

  pdfjsLib.getDocument({data:base64ToUint8Array(pdfBase64)}).promise.then(function(doc){
    pdfDoc=doc;
    post({type:'totalPages', value:doc.numPages});
    var cw=Math.max(160, window.innerWidth-24);
    return doc.getPage(1).then(function(first){
      var rawVp=first.getViewport({scale:1});
      fitScale=cw/rawVp.width;
      var chain=Promise.resolve();
      for(var i=1;i<=doc.numPages;i++){
        (function(pageNum){
          chain=chain.then(function(){
            return doc.getPage(pageNum).then(function(page){
              var vpCss=page.getViewport({scale:fitScale});
              var slot=document.createElement('div');
              slot.className='page-slot';
              slot.dataset.page=String(pageNum);
              slot.style.width=vpCss.width+'px';
              slot.style.height=vpCss.height+'px';
              slot.innerHTML='<div class="page-loading"><div class="spin"></div><span>Page '+pageNum+'</span></div>';
              pagesContainer.appendChild(slot);
              io.observe(slot);
            });
          });
        })(i);
      }
      return chain.then(function(){
        var firstSlot=pagesContainer.querySelector('.page-slot');
        if(firstSlot) renderSlot(1, firstSlot);
        applyDisplayScale(1);
        updateVisiblePage();
        if(typeof ResizeObserver!=='undefined'){
          try{new ResizeObserver(function(){refreshZoomSizer();}).observe(pagesContainer);}catch(er){}
        }
        refreshZoomSizer();
        post({type:'loadingEnd'});
      });
    });
  }).catch(function(err){
    pagesContainer.innerHTML='<div class="error-msg">PDF load failed.<br>'+err.message+'</div>';
    post({type:'error', value:String(err)});
  });
})();
true;`;
}

export default function PdfReader() {
  const router = useRouter();
  const { url, title } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;

  // ─── States ───
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [webViewError, setWebViewError] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [orientationLockedLandscape, setOrientationLockedLandscape] = useState(false);

  // New features
  const [nightMode, setNightMode] = useState(false);
  const [pageJumpModal, setPageJumpModal] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [localFileUri, setLocalFileUri] = useState(null);

  const showChrome = chromeVisible && !isLandscape;
  const webViewRef = useRef(null);
  const decodedUrl = url ? decodeURIComponent(String(url)) : null;

  const postToWeb = useCallback((msg) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  // ─── Cleanup ───
  useEffect(() => {
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, []);

  // ─── Reflow on resize ───
  useEffect(() => {
    postToWeb({ type: 'reflow' });
  }, [winW, winH, postToWeb]);

  // ─── Hardware back ───
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (orientationLockedLandscape) {
        handleLandscapeBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [orientationLockedLandscape]);

  // ─── Night mode live toggle ───
  useEffect(() => {
    if (pdfData) postToWeb({ type: 'nightToggle', value: nightMode });
  }, [nightMode]);

  // ─── PDF Load ───
  useEffect(() => {
    if (!decodedUrl) return;
    let isActive = true;

    const preparePdf = async () => {
      setLoading(true);
      setLoadProgress(10);
      setWebViewError(false);
      setDownloadError(false);

      // Local file
      if (decodedUrl.startsWith('file://') || !decodedUrl.startsWith('http')) {
        try {
          setLoadProgress(50);
          const base64 = await FileSystem.readAsStringAsync(decodedUrl, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setLoadProgress(95);
          if (isActive) {
            setPdfData(base64);
            setLocalFileUri(decodedUrl);
            setDownloaded(true);
          }
        } catch (error) {
          if (isActive) { setWebViewError(true); setDownloadError(true); }
        } finally {
          if (isActive) setLoading(false);
        }
        return;
      }

      // Remote file — cache check
      const cacheDir = FileSystem.documentDirectory + 'pdf-cache/';
      const localFileName = encodeURIComponent(decodedUrl).replace(/%/g, '') + '.pdf';
      const localUri = cacheDir + localFileName;

      try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}

      try {
        const info = await FileSystem.getInfoAsync(localUri);
        if (!info.exists) {
          // Download with progress
          const dl = FileSystem.createDownloadResumable(
            decodedUrl, localUri, {},
            (prog) => {
              if (prog.totalBytesExpectedToWrite > 0) {
                const pct = Math.round((prog.totalBytesWritten / prog.totalBytesExpectedToWrite) * 70) + 10;
                if (isActive) setLoadProgress(pct);
              }
            }
          );
          await dl.downloadAsync();
        }
        setLoadProgress(88);
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setLoadProgress(96);
        if (isActive) { setPdfData(base64); setLocalFileUri(localUri); }
      } catch (error) {
        if (isActive) { setDownloadError(true); setWebViewError(true); }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    preparePdf();
    return () => { isActive = false; };
  }, [decodedUrl, retryCount]);

  const inlinePdfScript = pdfData ? buildInlineScript(pdfData) : '';
  const htmlSource = pdfData ? { html: buildPdfHtmlShell(nightMode), baseUrl: '' } : null;

  const onWebViewLoadEnd = useCallback(() => {
    if (!pdfData || !inlinePdfScript) return;
    webViewRef.current?.injectJavaScript(inlinePdfScript);
  }, [pdfData, inlinePdfScript]);

  const handleWebViewMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'totalPages') setTotalPages(data.value);
      else if (data.type === 'visiblePage') setCurrentPage(data.value);
      else if (data.type === 'zoomPct') setZoomPct(data.value);
      else if (data.type === 'loadingEnd') { setLoading(false); setLoadProgress(100); }
      else if (data.type === 'toggleChrome') {
        const { width: w, height: h } = Dimensions.get('window');
        if (w <= h) setChromeVisible((v) => !v);
      } else if (data.type === 'error') {
        setWebViewError(true);
        setLoading(false);
      }
    } catch {}
  }, []);

  // ─── FIX: Landscape back — pehle portrait, tab back ───
  const handleLandscapeBack = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setOrientationLockedLandscape(false);
      setTimeout(() => router.back(), 350);
    } catch {
      router.back();
    }
  }, [router]);

  const toggleOrientationLock = useCallback(async () => {
    try {
      if (orientationLockedLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setOrientationLockedLandscape(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        setOrientationLockedLandscape(true);
      }
    } catch (e) { console.warn('Orientation:', e); }
  }, [orientationLockedLandscape]);

  // ─── Page Jump ───
  const handlePageJump = () => {
    const pg = parseInt(pageJumpInput);
    if (pg >= 1 && pg <= totalPages) {
      postToWeb({ type: 'goToPage', value: pg });
      setCurrentPage(pg);
    } else {
      Alert.alert('Invalid', `1 se ${totalPages} ke beech page number daalo`);
    }
    setPageJumpModal(false);
    setPageJumpInput('');
  };

  // ─── Download ───
  const handleDownload = async () => {
    if (downloaded) { Alert.alert('✓ Already Saved', 'PDF pehle se download ho chuka hai!'); return; }
    if (!decodedUrl) return;
    setDownloading(true);
    try {
      const fileName = String(title || 'document').replace(/[^a-z0-9]/gi, '_') + '.pdf';
      const fileUri = FileSystem.documentDirectory + fileName;
      const result = await FileSystem.downloadAsync(decodedUrl, fileUri);
      if (result.status === 200 || result.status === 0) {
        setDownloaded(true);
        setLocalFileUri(result.uri);
        Alert.alert('Downloaded!', 'PDF phone mein save ho gaya!');
      }
    } catch { Alert.alert('Error', 'Download nahi hua. Dobara try karo.'); }
    setDownloading(false);
  };

  // ─── Share ───
  const handleShare = async () => {
    if (!localFileUri) {
      Alert.alert('Pehle Save Karo', 'Share ke liye Save button dabao pehle.');
      return;
    }
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(localFileUri, { mimeType: 'application/pdf' });
      else Alert.alert('Share unavailable', 'Is device pe sharing support nahi hai.');
    } catch (e) { console.error('Share error:', e); }
  };

  const handleZoomIn = () => postToWeb({ type: 'zoomIn' });
  const handleZoomOut = () => postToWeb({ type: 'zoomOut' });
  const handleZoomReset = () => postToWeb({ type: 'zoomReset' });

  // ─── No URL ───
  if (!decodedUrl) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>PDF Reader</Text>
          </View>
          <View style={styles.emptyBox}>
            <FontAwesome5 name="file-pdf" size={48} color="#DC2626" />
            <Text style={styles.emptyTitle}>PDF URL nahi mili</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const statusHidden = !showChrome || isLandscape;
  const readProgress = totalPages > 0 ? Math.max(4, (currentPage / totalPages) * 100) : 0;

  return (
    <SafeAreaView style={[styles.safe, nightMode && styles.safeNight]} edges={showChrome ? ['top', 'bottom'] : ['bottom']}>
      <StatusBar style="light" hidden={statusHidden} />

      <View style={styles.container}>

        {/* ─── HEADER ─── */}
        {showChrome && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>

            {/* Page indicator — tap = jump modal */}
            {totalPages > 0 && (
              <TouchableOpacity
                style={styles.pageChip}
                onPress={() => { setPageJumpModal(true); setPageJumpInput(String(currentPage)); }}>
                <Ionicons name="bookmark-outline" size={11} color="#C9A44E" />
                <Text style={styles.pageChipText}>{currentPage}/{totalPages}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.headerTools}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleZoomOut}>
                <Ionicons name="remove" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomChip} onPress={handleZoomReset}>
                <Text style={styles.zoomChipText}>{zoomPct}%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleZoomIn}>
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, orientationLockedLandscape && styles.iconBtnOn]}
                onPress={toggleOrientationLock}>
                <Ionicons name="phone-landscape-outline" size={17} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── LOADING ─── */}
        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#C9A44E" />
            <Text style={styles.loadingText}>
              {loadProgress < 88 ? `Download ho raha hai... ${loadProgress}%` : 'PDF render ho raha hai...'}
            </Text>
            <View style={styles.loadProgressBg}>
              <View style={[styles.loadProgressFill, { width: `${loadProgress}%` }]} />
            </View>
          </View>
        )}

        {/* ─── WEBVIEW ─── */}
        {!webViewError && htmlSource ? (
          <>
            <WebView
              ref={webViewRef}
              source={htmlSource}
              style={[styles.webview, !showChrome && !isLandscape && { marginTop: -insets.top }]}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              allowFileAccess
              mixedContentMode="always"
              onMessage={handleWebViewMessage}
              onLoadEnd={onWebViewLoadEnd}
              nestedScrollEnabled
              androidLayerType="hardware"
              cacheEnabled
              automaticallyAdjustContentInsets={false}
              scalesPageToFit={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            />

            {/* ─── FOOTER TOOLBAR ─── */}
            {showChrome && !loading && (
              <View style={styles.footer}>
                {/* Reading progress bar */}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${readProgress}%` }]} />
                </View>

                {/* Action buttons */}
                <View style={styles.footerRow}>

                  {/* Night Mode */}
                  <TouchableOpacity
                    style={[styles.footerBtn, nightMode && styles.footerBtnOn]}
                    onPress={() => setNightMode(v => !v)}>
                    <Ionicons name={nightMode ? 'moon' : 'moon-outline'} size={15} color={nightMode ? '#C9A44E' : '#94a3b8'} />
                    <Text style={[styles.footerLabel, nightMode && styles.footerLabelOn]}>Night</Text>
                  </TouchableOpacity>

                  {/* Save/Download */}
                  <TouchableOpacity
                    style={[styles.footerBtn, downloaded && styles.footerBtnOn]}
                    onPress={handleDownload}>
                    {downloading
                      ? <ActivityIndicator size="small" color="#C9A44E" />
                      : <Ionicons
                          name={downloaded ? 'checkmark-circle' : 'download-outline'}
                          size={15}
                          color={downloaded ? '#C9A44E' : '#94a3b8'} />
                    }
                    <Text style={[styles.footerLabel, downloaded && styles.footerLabelOn]}>
                      {downloading ? 'Saving...' : downloaded ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>

                  {/* Share */}
                  <TouchableOpacity style={styles.footerBtn} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={15} color="#94a3b8" />
                    <Text style={styles.footerLabel}>Share</Text>
                  </TouchableOpacity>

                  {/* Page Jump */}
                  <TouchableOpacity
                    style={styles.footerBtn}
                    onPress={() => { setPageJumpModal(true); setPageJumpInput(String(currentPage)); }}>
                    <Ionicons name="navigate-outline" size={15} color="#94a3b8" />
                    <Text style={styles.footerLabel}>Go To</Text>
                  </TouchableOpacity>

                </View>
              </View>
            )}
          </>
        ) : null}

        {/* ─── ERROR ─── */}
        {webViewError && !loading && (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={48} color="#DC2626" />
            <Text style={styles.errorTitle}>PDF nahi khul raha</Text>
            <Text style={styles.errorSub}>
              {downloadError ? 'Download / storage issue ho sakta hai' : 'Network ya file check karein'}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => {
              setWebViewError(false); setLoading(true); setRetryCount(p => p + 1);
            }}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── LANDSCAPE FLOATING CONTROLS ─── */}
      {isLandscape && (
        <View style={[styles.landscapeControls, { top: Math.max(insets.top, 6) + 4 }]}>
          {/* FIX: Landscape back = pehle portrait, tab back */}
          <TouchableOpacity style={styles.landscapeBtn} onPress={handleLandscapeBack}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.landscapeBtn} onPress={() => setNightMode(v => !v)}>
            <Ionicons name={nightMode ? 'moon' : 'moon-outline'} size={16} color={nightMode ? '#C9A44E' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.landscapeBtn} onPress={handleZoomIn}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.landscapeBtn} onPress={handleZoomOut}>
            <Ionicons name="remove" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── PAGE JUMP MODAL ─── */}
      <Modal
        visible={pageJumpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPageJumpModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📄 Page pe Jao</Text>
            <Text style={styles.modalSub}>1 se {totalPages} ke beech number daalo</Text>
            <TextInput
              style={styles.modalInput}
              value={pageJumpInput}
              onChangeText={setPageJumpInput}
              keyboardType="number-pad"
              autoFocus
              maxLength={5}
              placeholder={`1 — ${totalPages}`}
              placeholderTextColor="#B0C4DC"
              onSubmitEditing={handlePageJump}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPageJumpModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalGoBtn} onPress={handlePageJump}>
                <Text style={styles.modalGoText}>Jao →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  safeNight: { backgroundColor: '#0d0d1a' },
  container: { flex: 1, backgroundColor: '#12141a' },

  // Header
  header: {
    backgroundColor: '#1B1464',
    paddingHorizontal: 8, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    elevation: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '700', minWidth: 0 },
  headerTools: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnOn: { backgroundColor: '#C9A44E' },
  pageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5,
    backgroundColor: 'rgba(201,164,78,0.15)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201,164,78,0.35)',
  },
  pageChipText: { color: '#C9A44E', fontSize: 11, fontWeight: '800' },
  zoomChip: {
    minWidth: 44, paddingHorizontal: 6, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  zoomChipText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // WebView
  webview: { flex: 1, backgroundColor: '#12141a' },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(18,20,26,0.95)', zIndex: 20, gap: 14,
  },
  loadingText: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  loadProgressBg: {
    width: 200, height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2, overflow: 'hidden',
  },
  loadProgressFill: { height: '100%', backgroundColor: '#C9A44E', borderRadius: 2 },

  // Footer
  footer: {
    backgroundColor: '#1B1464',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 8,
  },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#C9A44E' },
  footerRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 3, paddingHorizontal: 8,
  },
  footerBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 2, paddingHorizontal: 10,
    gap: 2, borderRadius: 8, minWidth: 48,
  },
  footerBtnOn: { backgroundColor: 'rgba(201,164,78,0.15)' },
  footerLabel: { color: '#94a3b8', fontSize: 8, fontWeight: '700' },
  footerLabelOn: { color: '#C9A44E' },

  // Error
  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  errorSub: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  retryBtn: { marginTop: 12, backgroundColor: '#1B1464', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Empty
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#64748b' },

  // Landscape floating controls
  landscapeControls: {
    position: 'absolute', left: 8,
    flexDirection: 'column', gap: 8, zIndex: 50,
  },
  landscapeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(27,20,100,0.88)',
    alignItems: 'center', justifyContent: 'center',
    elevation: 10,
  },

  // Page Jump Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 28,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 320,
    elevation: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0B1826', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#6B7F99', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#F0F4FA', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 28, fontWeight: '900', color: '#0B1826',
    textAlign: 'center', borderWidth: 1.5, borderColor: '#E0E8F4',
    marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, backgroundColor: '#F0F4FA', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  modalCancelText: { color: '#6B7F99', fontWeight: '700', fontSize: 15 },
  modalGoBtn: {
    flex: 1, backgroundColor: '#1B1464', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  modalGoText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
