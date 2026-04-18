import { FontAwesome5, Ionicons } from '@expo/vector-icons';
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

function isPresentAttendance(record) {
  const raw = String(record?.type || record?.status || record?.attendance || record?.attendanceType || '').toLowerCase().trim();
  return record?.isPresent === true || ['in', 'present', 'p', 'yes', 'true', '1'].includes(raw);
}

function isAbsentAttendance(record) {
  const raw = String(record?.type || record?.status || record?.attendance || record?.attendanceType || '').toLowerCase().trim();
  return record?.isPresent === false || ['out', 'absent', 'a', 'no', 'false', '0'].includes(raw);
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

export default function Attendance() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { router.replace('/'); return; }
      onSnapshot(collection(db, 'students'), s => {
        const found = s.docs.find(d => d.data().studentEmail?.toLowerCase() === user.email.toLowerCase());
        if (found) {
          const st = { id: found.id, ...found.data() };
          setStudent(st);
          onSnapshot(
            query(collection(db, 'attendance'), where('studentId', '==', found.id)),
            attSnap => {
              setAttendance(attSnap.docs.map(d => d.data()));
              setLoading(false);
            }
          );
        } else { setLoading(false); }
      });
    });
    return unsub;
  }, []);

  const fullMonthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayStr = new Date().toISOString().split('T')[0];

  // ─── Batch validity ───
  const batchStart = student?.batchStartDate || null;
  const batchEnd = student?.batchEndDate || null;

  function isInBatch(dateStr) {
    // Agar batch validity nahi hai — koi bhi date valid nahi (absent nahi dikhayenge)
    if (!batchStart && !batchEnd) return false;
    if (batchStart && dateStr < batchStart) return false;
    if (batchEnd && dateStr > batchEnd) return false;
    return true;
  }

  // ─── Month filter ───
  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthAtt = attendance.filter(a => a.date && a.date.startsWith(monthStr));

  // ─── Calendar setup ───
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();

  // ─── Month Stats ───
  let monthP = 0, monthA = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${monthStr}-${String(i).padStart(2, '0')}`;
    if (dateStr > todayStr) continue;
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    if (dow === 0) continue; // Sunday skip
    if (!isInBatch(dateStr)) continue; // Batch validity ke bahar skip
    const dayAtt = monthAtt.filter(a => a.date === dateStr);
    if (dayAtt.some(isPresentAttendance)) monthP++;
    else monthA++;
  }
  const monthTotal = monthP + monthA;
  const monthPct = monthTotal > 0 ? Math.round((monthP / monthTotal) * 100) : 0;

  // ─── Overall Stats ───
  let overallP = 0, overallA = 0;
  attendance.forEach(a => {
    if (!a.date) return;
    if (a.date > todayStr) return;
    const dow = new Date(a.date + 'T00:00:00').getDay();
    if (dow === 0) return;
    if (!isInBatch(a.date)) return;
    if (isPresentAttendance(a)) overallP++;
    else overallA++;
  });
  const overallTotal = overallP + overallA;
  const overallPct = overallTotal > 0 ? Math.round((overallP / overallTotal) * 100) : 0;
  const overallColor = overallPct >= 75 ? '#059669' : overallPct >= 50 ? '#D97706' : '#DC2626';
  const monthColor = monthPct >= 75 ? '#059669' : monthPct >= 50 ? '#D97706' : '#DC2626';

  // ─── Day status ───
  function getDayStatus(day) {
    const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;
    const isSun = dow === 0;
    const inBatch = isInBatch(dateStr);
    const dayAtt = monthAtt.filter(a => a.date === dateStr);
    const hasIn = dayAtt.some(isPresentAttendance);

    return { dateStr, isFuture, isToday, isSun, inBatch, hasIn };
  }

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#1B1464" />
      </View>
    );
  }

  // Calendar cells
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <FontAwesome5 name="calendar-check" size={18} color="#C9A44E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Attendance</Text>
            <Text style={styles.headerSub}>{student?.studentName || ''}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

          {/* ─── Overall Stats ─── */}
          <View style={styles.overallCard}>
            <Text style={styles.overallTitle}>Overall Attendance</Text>
            {batchStart && (
              <Text style={styles.batchDates}>
                {batchStart} → {batchEnd || 'Ongoing'}
              </Text>
            )}
            <View style={styles.overallStats}>
              {[
                { label: 'Present', val: overallP, color: '#059669', bg: '#ECFDF5' },
                { label: 'Absent', val: overallA, color: '#DC2626', bg: '#FEF2F2' },
                { label: 'Total', val: overallTotal, color: '#1B1464', bg: '#EFF6FF' },
                { label: 'Overall %', val: `${overallPct}%`, color: overallColor, bg: overallPct >= 75 ? '#ECFDF5' : overallPct >= 50 ? '#FFF7ED' : '#FEF2F2' },
              ].map((s, i) => (
                <View key={i} style={[styles.overallStat, { backgroundColor: s.bg }]}>
                  <Text style={[styles.overallStatVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.overallStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            {/* Overall Progress Bar */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${overallPct}%`, backgroundColor: overallColor }]} />
            </View>
            <Text style={[styles.progressLabel, { color: overallColor }]}>
              {overallPct >= 75 ? 'Excellent! Keep it up!' : overallPct >= 50 ? 'Average — Improve karo!' : 'Low — Dhyan do!'}
            </Text>
          </View>

          {/* ─── Month Selector ─── */}
          <View style={styles.monthSelector}>
            <TouchableOpacity
              style={styles.monthNavBtn}
              onPress={() => {
                if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
                else setSelectedMonth(m => m - 1);
              }}>
              <FontAwesome5 name="chevron-left" size={14} color="#1B1464" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.monthText}>{fullMonthNames[selectedMonth]} {selectedYear}</Text>
              <Text style={[styles.monthPctText, { color: monthColor }]}>
                {monthP}P · {monthA}A · {monthPct}%
              </Text>
            </View>
            <TouchableOpacity
              style={styles.monthNavBtn}
              onPress={() => {
                if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
                else setSelectedMonth(m => m + 1);
              }}>
              <FontAwesome5 name="chevron-right" size={14} color="#1B1464" />
            </TouchableOpacity>
          </View>

          {/* ─── Calendar ─── */}
          <View style={styles.calendarCard}>

            {/* Day Headers */}
            <View style={styles.weekRow}>
              {dayNames.map(d => (
                <Text key={d} style={[styles.dayHeader, d === 'Sun' && { color: '#DC2626' }]}>{d}</Text>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`e-${i}`} style={styles.cell} />;

                const { dateStr, isFuture, isToday, isSun, inBatch, hasIn } = getDayStatus(day);

                let bg, textColor, statusText;

                if (isSun) {
                  bg = '#F3E8FF'; textColor = '#7C3AED'; statusText = 'S';
                } else if (!inBatch) {
                  // Batch ke bahar — grey, koi mark nahi
                  bg = '#F8FAFD'; textColor = '#D1D5DB'; statusText = '';
                } else if (isFuture) {
                  bg = '#F8FAFD'; textColor = '#B0C4DC'; statusText = '—';
                } else if (hasIn) {
                  bg = '#ECFDF5'; textColor = '#059669'; statusText = 'P';
                } else {
                  bg = '#FEF2F2'; textColor = '#DC2626'; statusText = 'A';
                }

                return (
                  <View
                    key={day}
                    style={[
                      styles.cell,
                      { backgroundColor: bg },
                      isToday && styles.todayCell,
                    ]}>
                    <Text style={[styles.cellDay, { color: textColor }, isToday && styles.todayText]}>{day}</Text>
                    {statusText ? <Text style={[styles.cellStatus, { color: textColor }]}>{statusText}</Text> : null}
                  </View>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              {[
                { bg: '#ECFDF5', tc: '#059669', label: 'Present' },
                { bg: '#FEF2F2', tc: '#DC2626', label: 'Absent' },
                { bg: '#F3E8FF', tc: '#7C3AED', label: 'Sunday' },
                { bg: '#F8FAFD', tc: '#B0C4DC', label: 'Outside Batch' },
              ].map((l, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: l.bg, borderColor: l.tc + '60' }]} />
                  <Text style={[styles.legendText, { color: l.tc }]}>{l.label}</Text>
                </View>
              ))}
            </View>

          </View>

          {/* ─── Batch Info ─── */}
          {(batchStart || batchEnd) && (
            <View style={styles.batchInfoCard}>
              <FontAwesome5 name="info-circle" size={14} color="#1B1464" />
              <Text style={styles.batchInfoText}>
                Attendance sirf batch duration ({batchStart} se {batchEnd || 'ab tak'}) ke liye count hogi
              </Text>
            </View>
          )}

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

  // Header
  header: { backgroundColor: '#1B1464', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerIconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#C9A44E', marginTop: 2 },

  // Overall Card
  overallCard: { backgroundColor: '#1B1464', margin: 16, borderRadius: 20, padding: 16 },
  overallTitle: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.8)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  batchDates: { fontSize: 11, color: '#C9A44E', marginBottom: 12, fontWeight: '600' },
  overallStats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  overallStat: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  overallStatVal: { fontSize: 18, fontWeight: '900' },
  overallStatLabel: { fontSize: 9, color: '#6B7F99', marginTop: 2, fontWeight: '600' },
  progressBg: { height: 7, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 99 },
  progressLabel: { fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // Month Selector
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 1 },
  monthNavBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 16, fontWeight: '800', color: '#0B1826' },
  monthPctText: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  // Calendar
  calendarCard: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 18, padding: 16, elevation: 1 },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '800', color: '#6B7F99' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4, padding: 2 },
  todayCell: { borderWidth: 2, borderColor: '#1B1464' },
  cellDay: { fontSize: 11, fontWeight: '700' },
  todayText: { color: '#1B1464' },
  cellStatus: { fontSize: 8, fontWeight: '800' },

  // Legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  legendText: { fontSize: 10, fontWeight: '600' },

  // Batch Info
  batchInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginTop: 12, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12 },
  batchInfoText: { flex: 1, fontSize: 12, color: '#1B1464', lineHeight: 18, fontWeight: '600' },

  // Nav
  navBar: { backgroundColor: '#fff', flexDirection: 'row', paddingTop: 10, paddingBottom: 45, borderTopWidth: 1, borderTopColor: '#E8EFF8', elevation: 8 },
  navTab: { flex: 1, alignItems: 'center', gap: 3 },
  navIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#EFF6FF' },
  navLabel: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  navLabelActive: { color: '#1B1464', fontWeight: '800' },
  navBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});