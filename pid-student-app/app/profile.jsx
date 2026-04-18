import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, ScrollView, StyleSheet,
    Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { useUnreadCount } from '../hooks/useUnreadCount';

function normalizeStudentStatus(value) {
  if (value === undefined || value === null) return 'inactive';
  const raw = String(value).trim().toLowerCase();
  if (['active', 'yes', 'true', '1', 'enrolled', 'admitted'].includes(raw)) return 'active';
  if (['inactive', 'no', 'false', '0', 'left', 'blocked', 'pending'].includes(raw)) return 'inactive';
  return raw;
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

// ─── Info Row ───
function InfoRow({ label, value, icon, last }) {
  if (!value) return null;
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoLabelWrap}>
        {icon && <FontAwesome5 name={icon} size={11} color="#6B7F99" />}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Section Card ───
function SectionCard({ title, icon, iconColor, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: iconColor + '20' }]}>
          <FontAwesome5 name={icon} size={13} color={iconColor} />
        </View>
        <Text style={[styles.sectionTitle, { color: iconColor }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { router.replace('/'); return; }
      onSnapshot(collection(db, 'students'), s => {
        const found = s.docs.find(d => d.data().studentEmail?.toLowerCase() === user.email.toLowerCase());
        if (found) setStudent({ id: found.id, ...found.data() });
        setLoading(false);
      });
    });
    return unsub;
  }, []);

  function handleLogout() {
    Alert.alert('Logout', 'Kya aap logout karna chahte hain?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => signOut(auth).then(async () => {
              await AsyncStorage.removeItem('pid_user_role');
              router.replace('/');
            }) },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#1B1464" />
      </View>
    );
  }

  const rawStatus = student?.status ?? student?.studentStatus ?? student?.active ?? student?.isActive;
  const normalizedStatus = normalizeStudentStatus(rawStatus);
  const isActive = normalizedStatus === 'active';
  const statusLabel = rawStatus ? (isActive ? 'Active' : String(rawStatus)) : 'Inactive';
  const statusColor = isActive ? '#059669' : '#DC2626';

  // Fee calculation
  const totalFee = Number(student?.totalFee || 0);
  const feePaid = Number(student?.inst1Amount || 0) + Number(student?.inst2Amount || 0) + Number(student?.inst3Amount || 0);
  const feeDue = Math.max(0, totalFee - feePaid);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreeting}>My Profile</Text>
            <Text style={styles.headerSub}>Aapki poori jaankari</Text>
          </View>
          <TouchableOpacity style={styles.logoutIconBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

          {/* ─── Profile Card ─── */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(student?.studentName || 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
              {rawStatus != null && (
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              )}
            </View>
            <Text style={styles.profileName}>{student?.studentName || '—'}</Text>
            <Text style={styles.profileClass}>
              Class {student?.class || '—'} · {student?.board || '—'} · {student?.medium || '—'}
            </Text>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              {[
                { label: 'Enrollment', val: student?.enrollmentNumber || '—', icon: 'id-card', color: '#1B1464' },
                { label: 'Roll No.', val: student?.rollNumber || '—', icon: 'hashtag', color: '#059669' },
                { label: 'Status', val: statusLabel, icon: 'circle', color: statusColor },
              ].map((s, i) => (
                <View key={i} style={styles.quickStat}>
                  <FontAwesome5 name={s.icon} size={14} color={s.color} />
                  <Text style={[styles.quickStatVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.quickStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.content}>

            {/* ─── Personal Info ─── */}
            <SectionCard title="Personal Info" icon="user" iconColor="#1B1464">
              <InfoRow label="Full Name" value={student?.studentName} icon="user" />
              <InfoRow label="Date of Birth" value={student?.dob} icon="birthday-cake" />
              <InfoRow label="Gender" value={student?.gender} icon="venus-mars" />
              <InfoRow label="Blood Group" value={student?.bloodGroup} icon="tint" />
              <InfoRow label="Category" value={student?.category} icon="users" />
              <InfoRow label="Aadhar No." value={student?.aadharNumber} icon="id-card" last />
            </SectionCard>

            {/* ─── Contact Info ─── */}
            <SectionCard title="Contact Details" icon="phone" iconColor="#059669">
              <InfoRow label="Email" value={student?.studentEmail} icon="envelope" />
              <InfoRow label="Phone" value={student?.studentPhone || student?.phone} icon="phone" />
              <InfoRow label="Father's Name" value={student?.fatherName} icon="user-tie" />
              <InfoRow label="Father's Phone" value={student?.fatherPhone} icon="phone" />
              <InfoRow label="Mother's Name" value={student?.motherName} icon="user" />
              <InfoRow label="Mother's Phone" value={student?.motherPhone} icon="phone" />
              <InfoRow label="Address" value={student?.address} icon="map-marker-alt" last />
            </SectionCard>

            {/* ─── Academic Info ─── */}
            <SectionCard title="Academic Info" icon="graduation-cap" iconColor="#C9A44E">
              <InfoRow label="Class" value={student?.class || student?.presentClass} icon="chalkboard" />
              <InfoRow label="Board" value={student?.board} icon="certificate" />
              <InfoRow label="Medium" value={student?.medium} icon="language" />
              <InfoRow label="Enrollment No." value={student?.enrollmentNumber} icon="id-card" />
              <InfoRow label="Roll Number" value={student?.rollNumber} icon="hashtag" />
              <InfoRow label="Admission Date" value={student?.admissionDate} icon="calendar-check" />
              <InfoRow label="Batch/Course" value={student?.course || student?.batch} icon="book" />
              <InfoRow label="RFID Code" value={student?.rfidCode} icon="wifi" last />
            </SectionCard>

            {/* ─── Fee Status ─── */}
            <SectionCard title="Fee Status" icon="rupee-sign" iconColor="#D97706">
              <View style={styles.feeGrid}>
                {[
                  { label: 'Total Fee', val: `₹${totalFee.toLocaleString('en-IN')}`, color: '#1B1464', bg: '#EFF6FF' },
                  { label: 'Fee Paid', val: `₹${feePaid.toLocaleString('en-IN')}`, color: '#059669', bg: '#ECFDF5' },
                  { label: 'Due Amount', val: `₹${feeDue.toLocaleString('en-IN')}`, color: feeDue > 0 ? '#DC2626' : '#059669', bg: feeDue > 0 ? '#FEF2F2' : '#ECFDF5' },
                  { label: 'Payment Mode', val: student?.paymentMode || '—', color: '#1B1464', bg: '#F0F4FA' },
                ].map((f, i) => (
                  <View key={i} style={[styles.feeCard, { backgroundColor: f.bg }]}>
                    <Text style={[styles.feeVal, { color: f.color }]}>{f.val}</Text>
                    <Text style={styles.feeLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>

            {/* ─── Logout Button ─── */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>

        <BottomNav active="profile" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FA' },

  // Header
  header: { backgroundColor: '#1B1464', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerLeft: {},
  headerGreeting: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#C9A44E', marginTop: 2 },
  logoutIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  // Profile Card
  profileCard: { backgroundColor: '#1B1464', marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 20, alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#C9A44E' },
  avatarText: { color: '#C9A44E', fontSize: 32, fontWeight: '900' },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#1B1464' },
  profileName: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 4 },
  profileClass: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 16 },
  quickStats: { flexDirection: 'row', gap: 8, width: '100%' },
  quickStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  quickStatVal: { fontSize: 12, fontWeight: '800' },
  quickStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  // Content
  content: { padding: 16, gap: 12 },

  // Section Card
  sectionCard: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F4FA' },
  sectionIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Info Row
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 11 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F4FA' },
  infoLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  infoLabel: { fontSize: 12, color: '#6B7F99', fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#0B1826', maxWidth: '55%', textAlign: 'right' },

  // Fee
  feeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  feeCard: { width: '47%', borderRadius: 12, padding: 12, alignItems: 'center' },
  feeVal: { fontSize: 16, fontWeight: '900', marginBottom: 4 },
  feeLabel: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },

  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#FECACA' },
  logoutText: { fontSize: 15, fontWeight: '800', color: '#DC2626' },

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