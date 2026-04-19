import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { studentMatchesBatch } from '../utils/batchMatcher';

function BottomNav({ active }) {
  const router = useRouter();
  const unreadCount = useUnreadCount();
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'home', lib: 'ion' },
    { id: 'batches', label: 'Batches', icon: 'chalkboard-teacher', lib: 'fa5' },
    { id: 'ai', label: 'AI', icon: 'robot', lib: 'fa5' },
    { id: 'notifications', label: 'Alerts', icon: 'bell', lib: 'fa5' },
    { id: 'performance', label: 'Rank', icon: 'chart-line', lib: 'fa5' },
    { id: 'profile', label: 'Profile', icon: 'person-circle', lib: 'ion' },
  ];
  return (
    <View style={styles.navBar}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <TouchableOpacity key={tab.id} style={styles.navTab} onPress={() => router.push('/' + tab.id)}>
            <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
              {tab.lib === 'ion'
                ? <Ionicons name={tab.icon} size={20} color={isActive ? '#1B1464' : '#6B7F99'} />
                : <FontAwesome5 name={tab.icon} size={16} color={isActive ? '#1B1464' : '#6B7F99'} />
              }
              {tab.id === 'notifications' && unreadCount > 0 && (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const SUBJECT_ICONS = {
  'Physics':     { icon: 'atom',            color: '#1B1464', bg: '#EFF6FF' },
  'Chemistry':   { icon: 'flask',           color: '#059669', bg: '#ECFDF5' },
  'Mathematics': { icon: 'square-root-alt', color: '#D97706', bg: '#FFF7ED' },
  'Maths':       { icon: 'square-root-alt', color: '#D97706', bg: '#FFF7ED' },
  'Biology':     { icon: 'leaf',            color: '#16A34A', bg: '#F0FDF4' },
  'English':     { icon: 'book-open',       color: '#0284C7', bg: '#EFF6FF' },
  'Science':     { icon: 'microscope',      color: '#7C3AED', bg: '#F5F3FF' },
};

export default function Materials() {
  const router = useRouter();
  const [materials, setMaterials] = useState([]);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { router.replace('/'); return; }

      // Fetch student info
      onSnapshot(collection(db, 'students'), s => {
        const found = s.docs.find(d => d.data().studentEmail?.toLowerCase() === user.email?.toLowerCase());
        if (found) setStudent({ id: found.id, ...found.data() });
        
        // Fetch materials
        onSnapshot(collection(db, 'study_materials'), sm => {
          setMaterials(sm.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        });
      });
    });
    return unsub;
  }, []);

  const subjects = ['All', ...new Set(materials.map(m => m.subject).filter(Boolean))];

  const filtered = materials.filter(m => {
    const matchSearch = !search.trim() ||
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.chapter?.toLowerCase().includes(search.toLowerCase());
    const matchSubject = selectedSubject === 'All' || m.subject === selectedSubject;
    const matchClass = !student || studentMatchesBatch(student, m.courseId);
    return matchSearch && matchSubject && matchClass;
  });

  // Group by subject + chapter
  const grouped = {};
  filtered.forEach(m => {
    const chapter = m.chapter || 'General';
    const subject = m.subject || 'Other';
    const key = `${subject}|||${chapter}`;
    if (!grouped[key]) grouped[key] = { subject, chapter, items: [] };
    grouped[key].items.push(m);
  });

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#1B1464" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <FontAwesome5 name="book" size={18} color="#C9A44E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Study Materials</Text>
            <Text style={styles.headerSub}>{filtered.length} materials available</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <FontAwesome5 name="search" size={14} color="#B0C4DC" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search materials, chapters..."
            placeholderTextColor="#B0C4DC"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <FontAwesome5 name="times" size={14} color="#B0C4DC" />
            </TouchableOpacity>
          )}
        </View>

        {/* Subject Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {subjects.map(sub => {
            const si = SUBJECT_ICONS[sub];
            const isActive = selectedSubject === sub;
            return (
              <TouchableOpacity
                key={sub}
                onPress={() => setSelectedSubject(sub)}
                style={[styles.filterChip, isActive && styles.filterChipActive, isActive && si && { backgroundColor: si.bg, borderColor: si.color }]}>
                {si && isActive && <FontAwesome5 name={si.icon} size={11} color={si.color} />}
                <Text style={[styles.filterText, isActive && { color: si ? si.color : '#1B1464', fontWeight: '800' }]}>{sub}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Chapter List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {Object.keys(grouped).length === 0
            ? <View style={styles.emptyBox}>
                <View style={styles.emptyIconWrap}>
                  <FontAwesome5 name="book-open" size={32} color="#B0C4DC" />
                </View>
                <Text style={styles.emptyTitle}>Koi material nahi mila</Text>
                <Text style={styles.emptySub}>Search ya filter change karo</Text>
              </View>
            : Object.entries(grouped).map(([key, group]) => {
                const si = SUBJECT_ICONS[group.subject] || { icon: 'book', color: '#1B1464', bg: '#EFF6FF' };
                const videoCount = group.items.filter(m => ['video', 'lecture'].includes(m.materialType?.toLowerCase())).length;
                const pdfCount = group.items.filter(m => ['pdf', 'notes'].includes(m.materialType?.toLowerCase())).length;
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.chapterCard}
                    onPress={() => router.push({ pathname: '/chapter-detail', params: { subject: group.subject, chapter: group.chapter } })}
                    activeOpacity={0.7}>
                    <View style={[styles.chapterIconWrap, { backgroundColor: si.bg }]}>
                      <FontAwesome5 name={si.icon} size={18} color={si.color} />
                    </View>
                    <View style={styles.chapterInfo}>
                      <Text style={styles.chapterName}>{group.chapter}</Text>
                      <Text style={styles.chapterSubject}>{group.subject}</Text>
                      <View style={styles.chapterMeta}>
                        {videoCount > 0 && (
                          <View style={styles.metaChip}>
                            <FontAwesome5 name="play-circle" size={9} color="#DC2626" />
                            <Text style={styles.metaChipText}>{videoCount} Videos</Text>
                          </View>
                        )}
                        {pdfCount > 0 && (
                          <View style={styles.metaChip}>
                            <FontAwesome5 name="file-pdf" size={9} color="#1B1464" />
                            <Text style={styles.metaChipText}>{pdfCount} PDFs</Text>
                          </View>
                        )}
                        {group.items.length - videoCount - pdfCount > 0 && (
                          <View style={styles.metaChip}>
                            <FontAwesome5 name="file" size={9} color="#6B7F99" />
                            <Text style={styles.metaChipText}>{group.items.length - videoCount - pdfCount} More</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#B0C4DC" />
                  </TouchableOpacity>
                );
              })
          }
        </ScrollView>

        <BottomNav active="dashboard" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FA' },
  header: { backgroundColor: '#1B1464', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerIconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#C9A44E', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14, marginBottom: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, color: '#0B1826' },
  filterRow: { maxHeight: 46, marginBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8EFF8' },
  filterChipActive: { borderWidth: 1.5 },
  filterText: { fontSize: 12, fontWeight: '600', color: '#6B7F99' },
  content: { flex: 1, paddingHorizontal: 16 },
  chapterCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  chapterIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chapterInfo: { flex: 1 },
  chapterName: { fontSize: 15, fontWeight: '800', color: '#0B1826', marginBottom: 2 },
  chapterSubject: { fontSize: 12, color: '#6B7F99', marginBottom: 6 },
  chapterMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F4FA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  metaChipText: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  emptyBox: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F0F4FA', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#6B7F99' },
  emptySub: { fontSize: 13, color: '#B0C4DC' },
  navBar: { backgroundColor: '#fff', flexDirection: 'row', paddingTop: 10, paddingBottom: 45, borderTopWidth: 1, borderTopColor: '#E8EFF8', elevation: 8 },
  navTab: { flex: 1, alignItems: 'center', gap: 3 },
  navIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#EFF6FF' },
  navLabel: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  navLabelActive: { color: '#1B1464', fontWeight: '800' },
  navBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});