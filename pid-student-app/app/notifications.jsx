import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { useUnreadCount } from '../hooks/useUnreadCount';

const TYPE_CONFIG = {
  fee:     { icon: 'rupee-sign',       color: '#D98D04', bg: '#FFFBEB' },
  test:    { icon: 'pencil-alt',       color: '#1349A8', bg: '#EFF6FF' },
  holiday: { icon: 'umbrella-beach',   color: '#7C3AED', bg: '#FAF5FF' },
  result:  { icon: 'chart-bar',        color: '#16A34A', bg: '#ECFDF5' },
  exam:    { icon: 'file-alt',         color: '#DC2626', bg: '#FEF2F2' },
  urgent:  { icon: 'exclamation-circle', color: '#DC2626', bg: '#FEF2F2' },
  general: { icon: 'bell',             color: '#1B1464', bg: '#EFF6FF' },
};

// ─── Bottom Nav with badge ───
function BottomNav({ active }) {
  const router = useRouter();
  const unreadCount = useUnreadCount();
  const tabs = [
    { id: 'dashboard',     label: 'Home',    icon: 'home',              lib: 'ion' },
    { id: 'batches',       label: 'Batches', icon: 'chalkboard-teacher', lib: 'fa5' },
    { id: 'ai',            label: 'AI',      icon: 'robot',             lib: 'fa5' },
    { id: 'notifications', label: 'Alerts',  icon: 'bell',              lib: 'fa5' },
    { id: 'performance',   label: 'Rank',    icon: 'chart-line',        lib: 'fa5' },
    { id: 'profile',       label: 'Profile', icon: 'person-circle',     lib: 'ion' },
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
              {/* Badge — sirf notifications tab pe */}
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

export default function Notifications() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [notifications, setNotifications] = useState([]);
  const [tests, setTests] = useState([]);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState(new Set());

  // Seen IDs load karo AsyncStorage se
  useEffect(() => {
    AsyncStorage.getItem('pid_seen_notifs').then(val => {
      if (val) setSeenIds(new Set(JSON.parse(val)));
    });
  }, []);

  // Jab screen pe aao — sab notifications seen mark karo
  useEffect(() => {
    if (notifications.length === 0) return;
    const allIds = notifications.map(n => n.id);
    const newSeenIds = new Set([...seenIds, ...allIds]);
    setSeenIds(newSeenIds);
    AsyncStorage.setItem('pid_seen_notifs', JSON.stringify([...newSeenIds]));
  }, [notifications]);

  useEffect(() => {
    if (!isFocused) return;
    AsyncStorage.setItem('pid_last_notif_visit', Date.now().toString());
  }, [isFocused]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { router.replace('/'); return; }

      onSnapshot(collection(db, 'students'), s => {
        const found = s.docs.find(d =>
          d.data().studentEmail?.toLowerCase() === user.email.toLowerCase()
        );
        if (found) {
          const st = { id: found.id, ...found.data() };
          setStudent(st);

          // Notifications
          let notifs1 = [];
          let notifs2 = [];

          const mergeAndSet = () => {
            const sc = (st.class || '').trim();
            const all = [...notifs1, ...notifs2];
            const filtered = all.filter(n => {
              const fc = (n.forClass || n.classFilter || 'all').trim();
              if (fc === 'all') return true;
              if (fc === sc) return true;
              if (fc.startsWith(sc + '-')) return true;
              return false;
            });
            filtered.sort((a, b) => {
              const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
              const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
              return tb - ta;
            });
            setNotifications(filtered);
          };

          // notifications collection
          onSnapshot(collection(db, 'notifications'), ns => {
            notifs1 = ns.docs.map(d => ({ id: 'n_' + d.id, ...d.data() }));
            mergeAndSet();
          });

          // scheduled_notifications collection
          onSnapshot(collection(db, 'scheduled_notifications'), ns => {
            notifs2 = ns.docs.map(d => {
              const data = d.data();
              return {
                id: 's_' + d.id,
                message: data.message || '',
                title: data.title || '',
                type: data.notifType || data.type || 'general',
                forClass: data.classFilter || data.forClass || 'all',
                scheduledDate: data.date || data.scheduledDate || '',
                scheduledTime: data.time || data.scheduledTime || '',
                sentBy: data.sentBy || 'Admin',
                createdAt: data.createdAt,
              };
            });
            mergeAndSet();
          });

          // Online Tests
          onSnapshot(
            query(collection(db, 'online_tests'), where('isActive', '==', true)),
            ts => {
              const all = ts.docs.map(d => ({ id: d.id, ...d.data() }));
              const today = new Date().toISOString().split('T')[0];
              const sc = (st.class || '').trim();
              const sm = (st.medium || '').trim();
              const sb = st.board === 'CG Board' ? 'CG' : (st.board || '').trim();
              const classOk = (fc) => {
                if (!fc || fc === 'all') return true;
                const p = fc.trim().split('-');
                if (p[0] !== sc) return false;
                if (p.length === 1) return true;
                if (p[1] && sm) {
                  const medOk = (p[1] === 'Eng' && sm === 'English') ||
                    (p[1] === 'English' && sm === 'English') ||
                    ((p[1] === 'Hin' || p[1] === 'Hindi') && sm === 'Hindi');
                  if (!medOk) return false;
                }
                const bp = p.slice(2);
                if (bp.length > 0 && sb) {
                  if (!bp.some(x => x === sb || x === 'All' || x === 'all')) return false;
                }
                return true;
              };
              setTests(all.filter(t => classOk(t.forClass) && (!t.scheduledDate || t.scheduledDate <= today)));
            }
          );
        }
        setLoading(false);
      });
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#1B1464" />
      </View>
    );
  }

  const totalAlerts = notifications.length + tests.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <FontAwesome5 name="bell" size={18} color="#C9A44E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSub}>Tests, fees aur class alerts</Text>
          </View>
          {totalAlerts > 0 && (
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>{totalAlerts}</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}>

          {/* ─── Active Tests ─── */}
          {tests.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome5 name="pencil-alt" size={13} color="#1349A8" />
                <Text style={styles.sectionTitle}>Active Tests</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{tests.length}</Text>
                </View>
              </View>
              {tests.map(t => (
                <View key={t.id} style={[styles.card, { borderLeftColor: '#1349A8' }]}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <FontAwesome5 name="pencil-alt" size={16} color="#1349A8" />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{t.title}</Text>
                    <View style={styles.cardMeta}>
                      <View style={styles.metaChip}>
                        <FontAwesome5 name="book" size={9} color="#6B7F99" />
                        <Text style={styles.metaChipText}>{t.subject}</Text>
                      </View>
                      <View style={styles.metaChip}>
                        <FontAwesome5 name="question-circle" size={9} color="#6B7F99" />
                        <Text style={styles.metaChipText}>{t.totalQuestions || t.questions?.length || 0} Q</Text>
                      </View>
                      <View style={styles.metaChip}>
                        <FontAwesome5 name="clock" size={9} color="#6B7F99" />
                        <Text style={styles.metaChipText}>{t.duration || 30} mins</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/tests')} style={styles.giveTestBtn}>
                      <FontAwesome5 name="play" size={11} color="#fff" />
                      <Text style={styles.giveTestText}>Test Do</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ─── Notifications ─── */}
          {notifications.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome5 name="bell" size={13} color="#1B1464" />
                <Text style={styles.sectionTitle}>Alerts</Text>
                <View style={[styles.sectionBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={[styles.sectionBadgeText, { color: '#1B1464' }]}>{notifications.length}</Text>
                </View>
              </View>

              {notifications.map(n => {
                const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG[n.notifType] || TYPE_CONFIG.general;
                const isSeen = seenIds.has(n.id);
                const notifDate = n.createdAt?.toDate?.();

                return (
                  <View
                    key={n.id}
                    style={[
                      styles.card,
                      { borderLeftColor: tc.color },
                      !isSeen && styles.cardUnseen,
                    ]}>
                    <View style={[styles.cardIconWrap, { backgroundColor: tc.bg }]}>
                      <FontAwesome5 name={tc.icon} size={16} color={tc.color} />
                    </View>
                    <View style={styles.cardBody}>

                      {/* Top Row — Type + Date/Time */}
                      <View style={styles.notifTopRow}>
                        <View style={[styles.typeBadge, { backgroundColor: tc.bg }]}>
                          <Text style={[styles.typeBadgeText, { color: tc.color }]}>
                            {n.type || n.notifType || 'General'}
                          </Text>
                        </View>
                        <Text style={styles.notifDateTime}>
                          {n.createdAt?.toDate
                            ? n.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
                              ' • ' +
                              n.createdAt.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : n.createdAt?.seconds
                            ? new Date(n.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
                              ' • ' +
                              new Date(n.createdAt.seconds * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : 'Abhi'}
                        </Text>
                        {!isSeen && <View style={styles.unreadDot} />}
                      </View>

                      {/* Title */}
                      {n.title && <Text style={styles.cardTitle}>{n.title}</Text>}

                      {/* Message */}
                      <Text style={styles.notifMessage}>{n.message}</Text>

                      {/* Schedule */}
                      {(n.scheduledDate || n.scheduledTime) && (
                        <View style={styles.scheduleRow}>
                          <FontAwesome5 name="calendar" size={9} color="#D97706" />
                          <Text style={styles.scheduleText}>
                            {n.scheduledDate || ''}{n.scheduledTime ? ' at ' + n.scheduledTime : ''}
                          </Text>
                        </View>
                      )}

                      {/* Sent by */}
                      {n.sentBy && (
                        <Text style={styles.sentBy}>Bheja: {n.sentBy}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ─── Empty ─── */}
          {notifications.length === 0 && tests.length === 0 && (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <FontAwesome5 name="bell-slash" size={32} color="#B0C4DC" />
              </View>
              <Text style={styles.emptyTitle}>Koi notification nahi hai</Text>
              <Text style={styles.emptySub}>Jab koi alert aayega, yahan dikhega</Text>
            </View>
          )}

        </ScrollView>

        <BottomNav active="notifications" />
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
  badgeWrap: { backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0B1826', flex: 1 },
  sectionBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  sectionBadgeText: { fontSize: 11, fontWeight: '800', color: '#1349A8' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, borderLeftWidth: 3, elevation: 1 },
  cardUnseen: { backgroundColor: '#FFFDF5', elevation: 3 },
  cardIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#0B1826', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F4FA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  metaChipText: { fontSize: 11, color: '#6B7F99', fontWeight: '600' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  notifTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  notifDateTime: { fontSize: 10, color: '#B0C4DC', fontWeight: '600', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  notifMessage: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 4 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  scheduleText: { fontSize: 11, color: '#D97706', fontWeight: '600' },
  sentBy: { fontSize: 10, color: '#B0C4DC', marginTop: 4 },
  giveTestBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1349A8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 4 },
  giveTestText: { fontSize: 12, fontWeight: '800', color: '#fff' },
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