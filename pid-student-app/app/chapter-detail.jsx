import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';

const TYPE_CONFIG = {
  video:   { icon: 'play-circle',  color: '#DC2626', bg: '#FEF2F2', label: 'Video Lecture' },
  lecture: { icon: 'play-circle',  color: '#DC2626', bg: '#FEF2F2', label: 'Video Lecture' },
  pdf:     { icon: 'file-pdf',     color: '#1B1464', bg: '#EFF6FF', label: 'PDF Document' },
  notes:   { icon: 'sticky-note',  color: '#059669', bg: '#ECFDF5', label: 'Notes' },
  dpp:     { icon: 'clipboard-list', color: '#7C3AED', bg: '#F5F3FF', label: 'DPP' },
  pyq:     { icon: 'history',      color: '#D97706', bg: '#FFF7ED', label: 'Previous Year Q' },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type?.toLowerCase()] || { icon: 'file', color: '#6B7F99', bg: '#F0F4FA', label: type || 'Material' };
}

export default function ChapterDetail() {
  const router = useRouter();
  const { subject, chapter } = useLocalSearchParams();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { router.replace('/'); return; }
      onSnapshot(collection(db, 'study_materials'), s => {
        const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtered = arr.filter(m =>
          m.subject === subject && (m.chapter || 'General') === chapter
        );
        setMaterials(filtered);
        setLoading(false);
      });
    });
    return unsub;
  }, []);

  function openMaterial(m) {
    const type = m.materialType?.toLowerCase();
    if (type === 'lecture' || type === 'video') {
      router.push({
        pathname: '/lecture',
        params: {
          title: m.title || '',
          description: m.description || '',
          videoUrl: encodeURIComponent(m.videoUrl || m.fileUrl || ''),
          notesUrl: encodeURIComponent(m.notesUrl || m.fileUrl || ''),
        }
      });
    } else if (m.fileUrl) {
      router.push({
        pathname: '/pdf-reader',
        params: { url: encodeURIComponent(m.fileUrl), title: m.title || '' }
      });
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#1B1464" />
      </View>
    );
  }

  const videos = materials.filter(m => ['video', 'lecture'].includes(m.materialType?.toLowerCase()));
  const notes = materials.filter(m => ['notes', 'pdf', 'dpp', 'pyq'].includes(m.materialType?.toLowerCase()));
  const others = materials.filter(m => !['video', 'lecture', 'notes', 'pdf', 'dpp', 'pyq'].includes(m.materialType?.toLowerCase()));

  function MaterialCard({ m }) {
    const tc = getTypeConfig(m.materialType);
    const isVideo = ['video', 'lecture'].includes(m.materialType?.toLowerCase());
    const hasPdf = !!m.fileUrl;
    const [downloading, setDownloading] = useState(false);
    const [downloadedUri, setDownloadedUri] = useState(null);

    const fileName = (String(m.title || 'document')).replace(/[^a-z0-9]/gi, '_') + '.pdf';
    const fileUri = FileSystem.documentDirectory + fileName;

    useEffect(() => {
      if (!hasPdf) return;
      FileSystem.getInfoAsync(fileUri).then(info => {
        if (info.exists) setDownloadedUri(info.uri);
      }).catch(() => {
        setDownloadedUri(null);
      });
    }, [fileUri, hasPdf]);

    async function handleDownload() {
      if (downloading || !m.fileUrl) return;
      setDownloading(true);
      try {
        const result = await FileSystem.downloadAsync(m.fileUrl, fileUri);
        if (result.status === 200 || result.status === 0) {
          setDownloadedUri(result.uri);
        }
      } catch (e) {
        console.error('Download error:', e);
      }
      setDownloading(false);
    }

    async function handleView() {
      if (!m.fileUrl) return;
      let uri = downloadedUri || m.fileUrl;
      
      // If file is already local or hasn't been downloaded yet, try to download only if it's a remote URL
      if (!uri.startsWith('file://') && !downloadedUri) {
        setDownloading(true);
        try {
          const result = await FileSystem.downloadAsync(m.fileUrl, fileUri);
          if (result.status === 200 || result.status === 0) {
            uri = result.uri;
            setDownloadedUri(uri);
          }
        } catch (e) {
          console.error('View download error:', e);
        }
        setDownloading(false);
      }

      if (!uri) return;
      router.push({
        pathname: '/pdf-reader',
        params: { url: encodeURIComponent(uri), title: m.title || '' }
      });
    }

    async function handleDelete() {
      if (!downloadedUri) return;
      try {
        await FileSystem.deleteAsync(downloadedUri, { idempotent: true });
      } catch (e) {
        console.error('Delete error:', e);
      }
      setDownloadedUri(null);
    }

    const cardPress = isVideo ? () => openMaterial(m) : undefined;

    return (
      <View style={styles.materialCard}>
        {/* Main tap area */}
        <TouchableOpacity
          style={styles.materialMain}
          onPress={cardPress}
          activeOpacity={isVideo ? 0.7 : 1}
          disabled={!isVideo}>
          <View style={[styles.materialIconWrap, { backgroundColor: tc.bg }]}> 
            <FontAwesome5 name={tc.icon} size={18} color={tc.color} />
          </View>
          <View style={styles.materialInfo}>
            <Text style={styles.materialTitle}>{m.title}</Text>
            <View style={styles.materialMeta}>
              <View style={[styles.typeBadge, { backgroundColor: tc.bg }]}> 
                <Text style={[styles.typeBadgeText, { color: tc.color }]}>{tc.label}</Text>
              </View>
              {m.duration && (
                <View style={styles.metaChip}>
                  <FontAwesome5 name="clock" size={9} color="#6B7F99" />
                  <Text style={styles.metaChipText}>{m.duration}</Text>
                </View>
              )}
            </View>
            {m.description ? (
              <Text style={styles.materialDesc} numberOfLines={2}>{m.description}</Text>
            ) : null}
          </View>
          {isVideo && <Ionicons name="chevron-forward" size={16} color="#B0C4DC" />}
        </TouchableOpacity>

        {/* Action buttons for PDF — View + Download/Downloaded + Delete */}
        {!isVideo && hasPdf && (
          <View style={styles.pdfActions}> 
            <TouchableOpacity
              style={styles.pdfViewBtn}
              onPress={handleView}>
              <FontAwesome5 name="eye" size={12} color="#1B1464" />
              <Text style={styles.pdfViewBtnText}>
                View{downloadedUri ? ' (Offline)' : ''}
              </Text>
            </TouchableOpacity>
            <View style={styles.pdfActionGroup}>
              <TouchableOpacity
                style={[styles.pdfDownloadBtn, downloadedUri && styles.pdfDownloadedBtn, downloading && { opacity: 0.7 }]}
                onPress={handleDownload}
                disabled={downloading || !!downloadedUri}>
                {downloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <FontAwesome5 name={downloadedUri ? 'check' : 'download'} size={12} color="#fff" />
                    <Text style={styles.pdfDownloadBtnText}>{downloadedUri ? 'Downloaded' : 'Download'}</Text>
                  </>
                )}
              </TouchableOpacity>
              {downloadedUri && (
                <TouchableOpacity style={styles.pdfDeleteBtn} onPress={handleDelete}>
                  <FontAwesome5 name="trash" size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    );
  }

  function Section({ title, icon, color, items }) {
    if (items.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name={icon} size={13} color={color} />
          <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
          <View style={[styles.sectionBadge, { backgroundColor: color + '20' }]}> 
            <Text style={[styles.sectionBadgeText, { color }]}>{items.length}</Text>
          </View>
        </View>
        {items.map(m => <MaterialCard key={m.id} m={m} />)}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{chapter}</Text>
            <Text style={styles.headerSub}>{subject} · {materials.length} materials</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>

          <Section title="Video Lectures" icon="play-circle" color="#DC2626" items={videos} />
          <Section title="Notes & PDFs" icon="file-pdf" color="#1B1464" items={notes} />
          <Section title="Other Materials" icon="folder" color="#6B7F99" items={others} />

          {materials.length === 0 && (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <FontAwesome5 name="folder-open" size={32} color="#B0C4DC" />
              </View>
              <Text style={styles.emptyTitle}>Koi material nahi hai</Text>
              <Text style={styles.emptySub}>Admin ne abhi kuch upload nahi kiya</Text>
            </View>
          )}

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FA' },
  header: { backgroundColor: '#1B1464', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#C9A44E', marginTop: 2 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  sectionBadgeText: { fontSize: 11, fontWeight: '800' },
  materialCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, overflow: 'hidden', elevation: 1 },
  materialMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  materialIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  materialInfo: { flex: 1 },
  materialTitle: { fontSize: 14, fontWeight: '700', color: '#0B1826', marginBottom: 6 },
  materialMeta: { flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F4FA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  metaChipText: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  materialDesc: { fontSize: 12, color: '#6B7F99', lineHeight: 18 },
  pdfActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  pdfViewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 8, borderWidth: 1.5, borderColor: '#1B1464' },
  pdfViewBtnText: { fontSize: 12, fontWeight: '800', color: '#1B1464' },
  pdfActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pdfDownloadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1B1464', borderRadius: 10, paddingVertical: 8 },
  pdfDownloadedBtn: { backgroundColor: '#15803D' },
  pdfDeleteBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  pdfDownloadBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F0F4FA', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#6B7F99' },
  emptySub: { fontSize: 13, color: '#B0C4DC' },
});