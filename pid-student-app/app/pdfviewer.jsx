import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

function buildPdfHtmlShell() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: #12141a;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #scrollArea {
      height: 100%;
      width: 100%;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      touch-action: pan-x pan-y pinch-zoom;
    }
    #zoomSizer {
      position: relative;
      display: block;
      min-width: 100%;
      box-sizing: content-box;
    }
    #zoomLayer {
      transform-origin: left top;
      transition: none;
      padding: 12px 12px 48px;
      box-sizing: border-box;
    }
    #pagesContainer { display: flex; flex-direction: column; align-items: center; gap: 14px; }
    .page-slot {
      background: #fff;
      border-radius: 6px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .page-slot canvas { display: block; vertical-align: top; max-width: none; }
    .page-loading { color: #64748b; font-size: 13px; padding: 24px; }
    .error-msg { color: #fecaca; text-align: center; padding: 24px; font-size: 14px; }
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
  <script id="pdf-inline"></script>
</body>
</html>`;
}

export default function PdfReader() {
  const router = useRouter();
  const { url, title } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;

  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [webViewError, setWebViewError] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [orientationLockedLandscape, setOrientationLockedLandscape] = useState(false);

  const showChrome = chromeVisible && !isLandscape;
  const webViewRef = useRef(null);
  const decodedUrl = url ? decodeURIComponent(String(url)) : null;

  const postToWeb = useCallback((msg) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, []);

  useEffect(() => {
    postToWeb({ type: 'reflow' });
  }, [winW, winH, postToWeb]);

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

  useEffect(() => {
    if (!decodedUrl) return;
    let isActive = true;

    const preparePdf = async () => {
      setLoading(true);
      setWebViewError(false);
      setDownloadError(false);

      if (decodedUrl.startsWith('file://') || !decodedUrl.startsWith('http')) {
        try {
          const base64 = await FileSystem.readAsStringAsync(decodedUrl, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (isActive) setPdfData(base64);
        } catch (error) {
          if (isActive) { setWebViewError(true); setDownloadError(true); }
        } finally {
          if (isActive) setLoading(false);
        }
        return;
      }

      const cacheDir = FileSystem.documentDirectory + 'pdf-cache/';
      const localFileName = encodeURIComponent(decodedUrl).replace(/%/g, '') + '.pdf';
      const localUri = cacheDir + localFileName;

      try {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      } catch {}

      try {
        const info = await FileSystem.getInfoAsync(localUri);
        if (!info.exists) { await FileSystem.downloadAsync(decodedUrl, localUri); }
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (isActive) setPdfData(base64);
      } catch (error) {
        if (isActive) { setDownloadError(true); setWebViewError(true); }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    preparePdf();
    return () => { isActive = false; };
  }, [decodedUrl, retryCount]);

  // ─── FIX 1: Zoom sensitivity kam ki, FIX 2: Pinch center correct kiya ───
  const inlinePdfScript = pdfData
    ? `
(function boot(){
  if (typeof pdfjsLib === 'undefined') { setTimeout(boot, 40); return; }
  var pdfBase64 = ${JSON.stringify(pdfData)};
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  var pdfDoc = null;
  var fitScale = 1;
  var scrollArea = document.getElementById('scrollArea');
  var zoomSizer = document.getElementById('zoomSizer');
  var zoomLayer = document.getElementById('zoomLayer');
  var pagesContainer = document.getElementById('pagesContainer');
  var displayScale = 1;
  var pinchStartDist = 0;
  var scaleAtPinchStart = 1;
  var pinchOriginX = 0;  // FIX 2: pinch center X
  var pinchOriginY = 0;  // FIX 2: pinch center Y
  var rafScroll = null;
  var didPinch = false;
  var tapDown = null;
  var tapMoved = false;

  function refreshZoomSizer() {
    if (!zoomSizer || !zoomLayer || !pagesContainer || !scrollArea) return;
    requestAnimationFrame(function () {
      var baseW = Math.max(pagesContainer.scrollWidth, scrollArea.clientWidth);
      var baseH = Math.max(pagesContainer.scrollHeight, scrollArea.clientHeight);
      zoomLayer.style.width = baseW + 'px';
      zoomSizer.style.width = Math.ceil(baseW * displayScale) + 'px';
      zoomSizer.style.height = Math.ceil(baseH * displayScale) + 'px';
    });
  }

  function post(o) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {}
  }

  function base64ToUint8Array(b64) {
    var raw = atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function getDist(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // FIX 1 + FIX 2: Smooth zoom with correct origin
  function applyDisplayScale(newScale, originX, originY) {
    var minScale = 0.5;
    var maxScale = 4.0;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    if (originX !== undefined && originY !== undefined) {
      // FIX 2: Scroll adjust karo taaki pinch center stable rahe
      var oldScale = displayScale;
      var scaleRatio = newScale / oldScale;

      // Current scroll position + pinch origin se real position nikalo
      var realX = scrollArea.scrollLeft + originX;
      var realY = scrollArea.scrollTop + originY;

      displayScale = newScale;
      zoomLayer.style.transformOrigin = '0 0'; // FIX 2: hamesha 0,0 origin rakho
      zoomLayer.style.transform = 'scale(' + displayScale + ')';

      // FIX 2: Scroll position adjust karo
      scrollArea.scrollLeft = realX * scaleRatio - originX;
      scrollArea.scrollTop = realY * scaleRatio - originY;
    } else {
      displayScale = newScale;
      zoomLayer.style.transformOrigin = '0 0';
      zoomLayer.style.transform = 'scale(' + displayScale + ')';
    }

    post({ type: 'zoomPct', value: Math.round(displayScale * 100) });
    refreshZoomSizer();
  }

  function updateVisiblePage() {
    var slots = pagesContainer.querySelectorAll('.page-slot');
    var vr = scrollArea.getBoundingClientRect();
    var best = 1;
    var bestOverlap = -1;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var r = slot.getBoundingClientRect();
      var overlap = Math.max(0, Math.min(r.bottom, vr.bottom) - Math.max(r.top, vr.top));
      if (overlap > bestOverlap) { bestOverlap = overlap; best = parseInt(slot.dataset.page, 10) || best; }
    }
    post({ type: 'visiblePage', value: best });
  }

  scrollArea.addEventListener('scroll', function () {
    if (rafScroll) cancelAnimationFrame(rafScroll);
    rafScroll = requestAnimationFrame(updateVisiblePage);
  }, { passive: true });

  scrollArea.addEventListener('touchstart', function (e) {
    if (e.touches.length >= 2) {
      didPinch = true;
      tapDown = null;
      pinchStartDist = getDist(e.touches);
      scaleAtPinchStart = displayScale;

      // FIX 2: Dono fingers ka center calculate karo screen pe
      var rect = scrollArea.getBoundingClientRect();
      pinchOriginX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
      pinchOriginY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

    } else if (e.touches.length === 1) {
      tapMoved = false;
      tapDown = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }
  }, { passive: true });

  scrollArea.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2 && pinchStartDist > 0) {
      e.preventDefault();
      var d = getDist(e.touches);
      var rawRatio = d / pinchStartDist;

      // FIX 1: Zoom sensitivity bahut kam karo — pow 0.4 se smooth ho gaya
      var smoothRatio = Math.pow(rawRatio, 0.4);
      var newScale = scaleAtPinchStart * smoothRatio;

      // FIX 2: Pinch center pass karo
      applyDisplayScale(newScale, pinchOriginX, pinchOriginY);
      return;
    }
    if (e.touches.length === 1 && tapDown) {
      var mx = Math.abs(e.touches[0].clientX - tapDown.x);
      var my = Math.abs(e.touches[0].clientY - tapDown.y);
      if (mx > 14 || my > 14) tapMoved = true;
    }
  }, { passive: false });

  scrollArea.addEventListener('touchend', function (e) {
    if (e.touches.length < 2) pinchStartDist = 0;
    if (e.touches.length === 0) {
      if (!didPinch && tapDown && !tapMoved && e.changedTouches.length === 1) {
        var dt = Date.now() - tapDown.t;
        if (dt < 450) post({ type: 'toggleChrome' });
      }
      didPinch = false;
      tapDown = null;
    }
  }, { passive: true });

  function receiveMessage(ev) {
    var raw = ev.data || ev.detail || (ev.nativeEvent && ev.nativeEvent.data);
    var data;
    try { data = JSON.parse(raw); } catch (x) { return; }
    if (!data || !data.type) return;

    // Button zoom: center of screen se
    var cx = scrollArea.clientWidth / 2;
    var cy = scrollArea.clientHeight / 2;
    if (data.type === 'zoomIn') applyDisplayScale(displayScale * 1.15, cx, cy);
    if (data.type === 'zoomOut') applyDisplayScale(displayScale / 1.15, cx, cy);
    if (data.type === 'zoomReset') applyDisplayScale(1, cx, cy);
    if (data.type === 'setZoomPct' && typeof data.value === 'number') {
      applyDisplayScale(Math.max(50, Math.min(400, data.value)) / 100, cx, cy);
    }
    if (data.type === 'reflow') refreshZoomSizer();
  }
  document.addEventListener('message', receiveMessage);
  window.addEventListener('message', receiveMessage);

  var rendered = {};

  function renderSlot(pageNum, el) {
    if (!pdfDoc || rendered[pageNum] || el.dataset.rendering === '1') return;
    el.dataset.rendering = '1';
    pdfDoc.getPage(pageNum).then(function (page) {
      var dpr = window.devicePixelRatio || 1;
      var viewport = page.getViewport({ scale: fitScale * dpr });
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = Math.floor(viewport.width / dpr) + 'px';
      canvas.style.height = Math.floor(viewport.height / dpr) + 'px';
      el.innerHTML = '';
      el.appendChild(canvas);
      rendered[pageNum] = true;
      return page.render({ canvasContext: ctx, viewport: viewport }).promise;
    }).catch(function (err) {
      el.innerHTML = '<div class="page-loading">Error</div>';
      post({ type: 'error', value: String(err) });
    });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var pn = parseInt(el.dataset.page, 10);
      renderSlot(pn, el);
    });
  }, { root: scrollArea, rootMargin: '600px 0px', threshold: 0 });

  pdfjsLib.getDocument({ data: base64ToUint8Array(pdfBase64) }).promise.then(function (doc) {
    pdfDoc = doc;
    post({ type: 'totalPages', value: doc.numPages });
    var cw = Math.max(160, window.innerWidth - 24);
    return doc.getPage(1).then(function (first) {
      var rawVp = first.getViewport({ scale: 1 });
      fitScale = cw / rawVp.width;
      var chain = Promise.resolve();
      for (var i = 1; i <= doc.numPages; i++) {
        (function (pageNum) {
          chain = chain.then(function () {
            return doc.getPage(pageNum).then(function (page) {
              var vpCss = page.getViewport({ scale: fitScale });
              var slot = document.createElement('div');
              slot.className = 'page-slot';
              slot.dataset.page = String(pageNum);
              slot.style.width = vpCss.width + 'px';
              slot.style.height = vpCss.height + 'px';
              slot.innerHTML = '<div class="page-loading">Page ' + pageNum + '</div>';
              pagesContainer.appendChild(slot);
              io.observe(slot);
            });
          });
        })(i);
      }
      return chain.then(function () {
        var firstSlot = pagesContainer.querySelector('.page-slot');
        if (firstSlot) renderSlot(1, firstSlot);
        applyDisplayScale(1);
        updateVisiblePage();
        if (typeof ResizeObserver !== 'undefined') {
          try { new ResizeObserver(function () { refreshZoomSizer(); }).observe(pagesContainer); } catch (er) {}
        }
        refreshZoomSizer();
        post({ type: 'loadingEnd' });
      });
    });
  }).catch(function (err) {
    pagesContainer.innerHTML = '<div class="error-msg">PDF load failed.</div>';
    post({ type: 'error', value: String(err) });
  });
})();
true;
`
    : '';

  const htmlSource = pdfData ? { html: buildPdfHtmlShell(), baseUrl: '' } : null;

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
      else if (data.type === 'loadingEnd') setLoading(false);
      else if (data.type === 'toggleChrome') {
        const { width: w, height: h } = Dimensions.get('window');
        if (w <= h) setChromeVisible((v) => !v);
      } else if (data.type === 'error') {
        setWebViewError(true);
        setLoading(false);
      }
    } catch {}
  }, []);

  // FIX 3: Landscape back → pehle portrait karo, tab router.back()
  const handleLandscapeBack = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setOrientationLockedLandscape(false);
      // Thoda wait karo orientation settle hone do
      setTimeout(() => {
        router.back();
      }, 350);
    } catch (e) {
      console.warn('Orientation unlock error:', e);
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
    } catch (e) {
      console.warn('Orientation:', e);
    }
  }, [orientationLockedLandscape]);

  const handleZoomIn = () => postToWeb({ type: 'zoomIn' });
  const handleZoomOut = () => postToWeb({ type: 'zoomOut' });
  const handleZoomReset = () => postToWeb({ type: 'zoomReset' });

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

  return (
    <SafeAreaView style={styles.safe} edges={showChrome ? ['top'] : []}>
      <StatusBar style="light" hidden={statusHidden} />

      <View style={styles.container}>
        {showChrome && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <View style={styles.headerTools}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleZoomOut} accessibilityLabel="Zoom out">
                <Ionicons name="remove" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomChip} onPress={handleZoomReset} accessibilityLabel="Reset zoom">
                <Text style={styles.zoomChipText}>{zoomPct}%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleZoomIn} accessibilityLabel="Zoom in">
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, orientationLockedLandscape && styles.iconBtnOn]}
                onPress={toggleOrientationLock}
                accessibilityLabel="Landscape reading">
                <Ionicons name="phone-landscape-outline" size={17} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#C9A44E" />
            <Text style={styles.loadingText}>PDF khul raha hai...</Text>
          </View>
        )}

        {!webViewError && htmlSource ? (
          <>
            <WebView
              ref={webViewRef}
              source={htmlSource}
              style={[
                styles.webview,
                !showChrome && !isLandscape && { marginTop: -insets.top },
              ]}
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

            {showChrome && totalPages > 0 && (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Page {currentPage} / {totalPages}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, {
                    width: `${totalPages ? Math.max(4, (currentPage / totalPages) * 100) : 0}%`,
                  }]} />
                </View>
              </View>
            )}
          </>
        ) : null}

        {webViewError && !loading && (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={48} color="#DC2626" />
            <Text style={styles.errorTitle}>PDF nahi khul raha</Text>
            <Text style={styles.errorSub}>
              {downloadError ? 'Download / storage issue ho sakta hai' : 'Network ya file check karein'}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => {
              setWebViewError(false);
              setLoading(true);
              setRetryCount((p) => p + 1);
            }}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* FIX 3: Landscape back button → pehle portrait, tab back */}
      {isLandscape && (
        <TouchableOpacity
          style={[styles.landscapeBack, { top: Math.max(insets.top, 6) + 4 }]}
          onPress={handleLandscapeBack}
          activeOpacity={0.85}
          accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#12141a' },
  header: {
    backgroundColor: '#1B1464',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700', minWidth: 0 },
  headerTools: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnOn: { backgroundColor: '#C9A44E' },
  zoomChip: {
    minWidth: 44, paddingHorizontal: 6, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  zoomChipText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  webview: { flex: 1, backgroundColor: '#12141a' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(18,20,26,0.92)', zIndex: 20,
  },
  loadingText: { marginTop: 12, color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  errorSub: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  retryBtn: { marginTop: 12, backgroundColor: '#1B1464', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  footer: {
    backgroundColor: '#1B1464',
    paddingHorizontal: 14, paddingVertical: 6, gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#C9A44E', borderRadius: 2 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#64748b' },
  landscapeBack: {
    position: 'absolute', left: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(27,20,100,0.88)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 50, elevation: 10,
  },
});
