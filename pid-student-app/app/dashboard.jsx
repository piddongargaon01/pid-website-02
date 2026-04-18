import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Animated, Easing, ScrollView,
    StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { auth, db } from '../firebase';
import { useUnreadCount } from '../hooks/useUnreadCount';

// ─── SVG Ring Chart ───
function RingChart({ value = 0, size = 100, stroke = 9 }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: value,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    animVal.addListener(({ value: v }) => setDisplayVal(Math.round(v)));
    return () => animVal.removeAllListeners();
  }, [value]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const strokeDashoffset = circumference - (displayVal / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        {/* Background circle */}
        <Circle
          cx={center} cy={center} r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center} cy={center} r={radius}
          stroke="#C9A44E"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>{displayVal}%</Text>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>Attendance</Text>
      </View>
    </View>
  );
}

// ─── Bottom Nav ───
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
    <View style={navStyles.bar}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={navStyles.tab}
            onPress={() => router.push('/' + tab.id)}>
            <View style={[navStyles.iconWrap, isActive && navStyles.iconWrapActive]}>
              {tab.lib === 'ion'
                ? <Ionicons name={tab.icon} size={20} color={isActive ? '#1B1464' : '#6B7F99'} />
                : <FontAwesome5 name={tab.icon} size={16} color={isActive ? '#1B1464' : '#6B7F99'} />
              }
              {tab.id === 'notifications' && unreadCount > 0 && (
                <View style={navStyles.navBadge}>
                  <Text style={navStyles.navBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={[navStyles.tabLabel, isActive && navStyles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Dashboard ───
export default function Dashboard() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { router.replace('/'); return; }

      onSnapshot(collection(db, 'students'), s => {
        const found = s.docs.find(
          d => d.data().studentEmail?.toLowerCase() === user.email?.toLowerCase()
        );
        if (found) {
          setStudent({ id: found.id, ...found.data() });
          onSnapshot(
            query(collection(db, 'attendance'), where('studentId', '==', found.id)),
            attSnap => setAttendance(attSnap.docs.map(d => d.data()))
          );
        }
        setLoading(false);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1, duration: 600, useNativeDriver: true
          }),
          Animated.timing(slideAnim, {
            toValue: 0, duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
        ]).start();
      });
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#1B1464" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  function normalizeAttendanceState(record) {
    const raw = String(record?.type || record?.status || record?.attendance || record?.attendanceType || '').toLowerCase().trim();
    if (record?.isPresent === true || ['in', 'present', 'p', 'yes', 'true', '1'].includes(raw)) return 'present';
    if (record?.isPresent === false || ['out', 'absent', 'a', 'no', 'false', '0'].includes(raw)) return 'absent';
    return raw === 'present' ? 'present' : raw === 'absent' ? 'absent' : 'unknown';
  }

  const totalDays = attendance.length;
  const presentDays = attendance.filter(a => normalizeAttendanceState(a) === 'present').length;
  const absentDays = Math.max(0, totalDays - presentDays);
  const attPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const features = [
    { icon: 'book', lib: 'fa5', iconColor: '#1B1464', bg: '#EFF6FF', title: 'Study Materials', sub: 'Notes aur PDFs', screen: '/materials' },
    { icon: 'robot', lib: 'fa5', iconColor: '#7C3AED', bg: '#F5F3FF', title: 'AI Doubt Solver', sub: 'Koi bhi sawaal puchho', screen: '/ai' },
    { icon: 'pencil-alt', lib: 'fa5', iconColor: '#D97706', bg: '#FFF7ED', title: 'Online Tests', sub: 'MCQ tests do', screen: '/tests' },
    { icon: 'chart-bar', lib: 'fa5', iconColor: '#059669', bg: '#ECFDF5', title: 'Attendance', sub: 'Apni attendance dekho', screen: '/attendance' },
    { icon: 'bell', lib: 'fa5', iconColor: '#DC2626', bg: '#FEF2F2', title: 'Notifications', sub: 'Class alerts', screen: '/notifications' },
    { icon: 'person-circle', lib: 'ion', iconColor: '#0284C7', bg: '#EFF6FF', title: 'Profile', sub: 'Apni details dekho', screen: '/profile' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}>

          {/* ─── HEADER ─── */}
          <View style={styles.header}>
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              {/* Top Row — Greeting + Avatar */}
              <View style={styles.topRow}>
                <View>
                  <Text style={styles.greeting}>Namaste!</Text>
                  <Text style={styles.studentName}>
                    {student?.studentName || 'Student'}
                  </Text>
                  <Text style={styles.studentClass}>
                    Class {student?.class || student?.presentClass || '—'} · PID
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.avatar}
                  onLongPress={() => signOut(auth).then(() => router.replace('/'))}>
                  <Text style={styles.avatarText}>
                    {(student?.studentName || 'S').charAt(0).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Ring + Stats Row */}
              <View style={styles.ringRow}>
                <RingChart value={attPct} size={110} stroke={10} />

                <View style={styles.statsCol}>
                  {[
                    { label: 'Total Days', val: totalDays, color: '#fff' },
                    { label: 'Present', val: presentDays, color: '#4ADE80' },
                    { label: 'Absent', val: absentDays, color: '#F87171' },
                  ].map((s, i) => (
                    <View key={i} style={styles.statRow}>
                      <View style={[styles.statDot, { backgroundColor: s.color }]} />
                      <Text style={styles.statVal}>{s.val}</Text>
                      <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Info Chips */}
              <View style={styles.chipsRow}>
                {[
                  { icon: 'graduation-cap', label: student?.board || 'CG Board' },
                  { icon: 'language', label: student?.medium || 'English' },
                  { icon: 'school', label: 'PID' },
                ].map((c, i) => (
                  <View key={i} style={styles.chip}>
                    <FontAwesome5 name={c.icon} size={11} color="#C9A44E" />
                    <Text style={styles.chipText}>{c.label}</Text>
                  </View>
                ))}
              </View>

            </Animated.View>
          </View>

          {/* ─── FEATURES ─── */}
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            padding: 16,
          }}>
            <Text style={styles.sectionTitle}>Features</Text>

            {features.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.featureTile}
                onPress={() => router.push(item.screen)}
                activeOpacity={0.7}>
                <View style={[styles.featureIconWrap, { backgroundColor: item.bg }]}>
                  {item.lib === 'ion'
                    ? <Ionicons name={item.icon} size={22} color={item.iconColor} />
                    : <FontAwesome5 name={item.icon} size={18} color={item.iconColor} />
                  }
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#B0C4DC" />
              </TouchableOpacity>
            ))}
          </Animated.View>

        </ScrollView>

        {/* ─── BOTTOM NAV ─── */}
        <BottomNav active="dashboard" />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FA' },
  loadingText: { marginTop: 12, color: '#6B7F99', fontSize: 14 },

  // Header
  header: {
    backgroundColor: '#1B1464',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  studentName: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 2 },
  studentClass: { fontSize: 13, color: '#C9A44E', marginTop: 3, fontWeight: '600' },
  avatar: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: '#C9A44E',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  avatarText: { color: '#1B1464', fontSize: 22, fontWeight: '900' },

  // Ring row
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    marginBottom: 20,
  },
  statsCol: { flex: 1, gap: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statVal: { fontSize: 18, fontWeight: '900', color: '#fff', minWidth: 32 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Chips
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  chipText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  // Features
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0B1826', marginBottom: 12 },
  featureTile: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  featureIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: '#0B1826' },
  featureSub: { fontSize: 12, color: '#6B7F99', marginTop: 2 },
});

const navStyles = StyleSheet.create({
  bar: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 45,
    borderTopWidth: 1,
    borderTopColor: '#E8EFF8',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: '#EFF6FF' },
  tabLabel: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  tabLabelActive: { color: '#1B1464', fontWeight: '800' },
  navBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});