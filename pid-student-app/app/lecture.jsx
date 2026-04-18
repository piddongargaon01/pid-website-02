import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Dimensions,
    ScrollView, StyleSheet,
    Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');

function getYoutubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([^&?]+)/,
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1].split('?')[0].split('&')[0];
  }
  return null;
}

export default function Lecture() {
  const router = useRouter();
  const { title, description, videoUrl, notesUrl } = useLocalSearchParams();
  const [webViewError, setWebViewError] = useState(false);

  // videoUrl YouTube link hai, notesUrl PDF hai
  const actualVideoUrl = videoUrl && (videoUrl.includes('youtube') || videoUrl.includes('youtu.be')) ? videoUrl : null;
  const actualNotesUrl = notesUrl && notesUrl.startsWith('http') ? notesUrl : null;

  const youtubeId = getYoutubeId(actualVideoUrl || '');
  const embedUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?rel=0&autoplay=0&modestbranding=1`
    : null;

  return (
    <View style={styles.container}>

      {/* Video Player */}
      <View style={styles.videoBox}>
        {embedUrl && !webViewError ? (
          <WebView
            source={{ uri: embedUrl }}
            style={{ width, height: width * 9 / 16 }}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            onError={() => setWebViewError(true)}
            onHttpError={() => setWebViewError(true)}
          />
        ) : (
          <View style={styles.videoError}>
            <FontAwesome5 name="play-circle" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.videoErrorText}>Video load nahi hua</Text>
            <Text style={styles.videoErrorSub}>YouTube link check karo</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1826' }} edges={['bottom']}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

          {/* Header area */}
          <View style={styles.headerArea}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.lectureTitle} numberOfLines={2}>{title}</Text>
            </View>
          </View>

          <View style={styles.content}>

            {/* Description */}
            {!!description && (
              <View style={styles.descCard}>
                <View style={styles.descHeader}>
                  <FontAwesome5 name="info-circle" size={13} color="#C9A44E" />
                  <Text style={styles.descLabel}>Description</Text>
                </View>
                <Text style={styles.descText}>{description}</Text>
              </View>
            )}

            {/* Attached Notes PDF */}
            {!!actualNotesUrl && (
              <TouchableOpacity
                style={styles.notesCard}
                onPress={() => router.push({ pathname: '/pdf-reader', params: { url: actualNotesUrl, title: (title || '') + ' - Notes' } })}>
                <View style={styles.notesIconWrap}>
                  <FontAwesome5 name="file-pdf" size={20} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notesTitle}>Lecture Notes</Text>
                  <Text style={styles.notesSub}>PDF dekhne ke liye tap karo</Text>
                </View>
                <View style={styles.notesViewBtn}>
                  <Text style={styles.notesViewBtnText}>View</Text>
                  <FontAwesome5 name="chevron-right" size={11} color="#1B1464" />
                </View>
              </TouchableOpacity>
            )}

          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1826' },
  videoBox: { width, height: width * 9 / 16, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  videoError: { alignItems: 'center', gap: 10 },
  videoErrorText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  videoErrorSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  headerArea: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingTop: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lectureTitle: { fontSize: 16, fontWeight: '800', color: '#fff', lineHeight: 24 },
  content: { paddingHorizontal: 16, paddingBottom: 30 },
  descCard: { backgroundColor: '#162544', borderRadius: 16, padding: 14, marginBottom: 12 },
  descHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  descLabel: { fontSize: 13, fontWeight: '800', color: '#C9A44E' },
  descText: { fontSize: 13, color: '#B0C4DC', lineHeight: 22 },
  notesCard: { backgroundColor: '#162544', borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  notesIconWrap: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  notesTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 2 },
  notesSub: { fontSize: 11, color: '#6B7F99' },
  notesViewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#C9A44E', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  notesViewBtnText: { fontSize: 12, fontWeight: '800', color: '#1B1464' },
});