import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';

const BATCH_OPTIONS = [
  { value: "12th-Eng-CBSE-ICSE", label: "12th English (CBSE+ICSE)", class: "12th", medium: "English", boards: ["CBSE", "ICSE"] },
  { value: "12th-Hindi-CG-CBSE", label: "12th Hindi (CG+CBSE)", class: "12th", medium: "Hindi", boards: ["CG", "CBSE"] },
  { value: "12th-Eng-CG", label: "12th English (CG Board)", class: "12th", medium: "English", boards: ["CG"] },
  { value: "11th-Eng-CBSE-ICSE", label: "11th English (CBSE+ICSE)", class: "11th", medium: "English", boards: ["CBSE", "ICSE"] },
  { value: "11th-Hindi-CG-CBSE", label: "11th Hindi (CG+CBSE)", class: "11th", medium: "Hindi", boards: ["CG", "CBSE"] },
  { value: "11th-Eng-CG", label: "11th English (CG Board)", class: "11th", medium: "English", boards: ["CG"] },
  { value: "10th-Eng-All", label: "10th English (CG+CBSE+ICSE)", class: "10th", medium: "English", boards: ["CG", "CBSE", "ICSE"] },
  { value: "10th-Hindi-CG-CBSE", label: "10th Hindi (CG+CBSE)", class: "10th", medium: "Hindi", boards: ["CG", "CBSE"] },
  { value: "9th-Eng-All", label: "9th English (CG+CBSE+ICSE)", class: "9th", medium: "English", boards: ["CG", "CBSE", "ICSE"] },
  { value: "9th-Hindi-CG-CBSE", label: "9th Hindi (CG+CBSE)", class: "9th", medium: "Hindi", boards: ["CG", "CBSE"] },
  { value: "2nd-8th-All", label: "2nd-8th All Medium", class: "2nd-8th", medium: "All", boards: ["CG", "CBSE", "ICSE"] },
  { value: "Navodaya", label: "Navodaya Entrance", class: "Navodaya", medium: "All", boards: [] },
  { value: "Prayas", label: "Prayas Awasiya Vidyalaya", class: "Prayas", medium: "All", boards: [] },
  { value: "JEE-NEET", label: "IIT-JEE & NEET", class: "JEE-NEET", medium: "All", boards: [] },
];

function filterByBatch(students, batchValue) {
  if (batchValue === 'all') return students;
  const batch = BATCH_OPTIONS.find(b => b.value === batchValue);
  if (!batch) return students;
  if (batch.class === 'JEE-NEET') return students.filter(s => ['9th','10th','11th','12th'].includes(s.class));
  if (batch.class === '2nd-8th') return students.filter(s => ['2nd','3rd','4th','5th','6th','7th','8th'].includes(s.class));
  return students.filter(s => {
    const classMatch = s.class === batch.class || s.presentClass === batch.class;
    if (!classMatch) return false;
    const mediumMatch = batch.medium === 'All' || !s.medium || s.medium === batch.medium;
    const normalizeBoard = b => { if (!b) return ''; if (b === 'CG Board') return 'CG'; return b; };
    const boardMatch = !batch.boards || batch.boards.length === 0 || !s.board || batch.boards.includes(normalizeBoard(s.board));
    return mediumMatch && boardMatch;
  });
}

// ─── Attendance Calendar ───
function AttendanceCalendar({ records, color = '#1B1464', batchStart = null }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const todayStr = today.toISOString().split('T')[0];

  const dateMap = {};
  records.forEach(r => {
    // Multiple date formats handle karo
    let dateStr = null;
    if (r.date) {
      // Format: "2026-04-18" already correct
      if (typeof r.date === 'string' && r.date.includes('-')) {
        dateStr = r.date.substring(0, 10);
      }
      // Format: Firestore Timestamp
      else if (r.date?.toDate) {
        dateStr = r.date.toDate().toISOString().split('T')[0];
      }
      // Format: timestamp number
      else if (typeof r.date === 'number') {
        dateStr = new Date(r.date).toISOString().split('T')[0];
      }
    }
    // createdAt se bhi try karo
    else if (r.createdAt?.toDate) {
      dateStr = r.createdAt.toDate().toISOString().split('T')[0];
    }
    if (dateStr) {
      if (!dateMap[dateStr]) dateMap[dateStr] = [];
      dateMap[dateStr].push(r.type);
    }
  });

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  let present = 0, absent = 0;
  Object.entries(dateMap).forEach(([date, types]) => {
    if (date.startsWith(monthStr)) {
      if (types.includes('in')) present++;
      else absent++;
    }
  });
  // Batch ke andar jo dates hain unhe bhi absent mein count karo
  if (batchStart) {
    const daysInThisMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInThisMonth; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      if (dateStr > todayStr) continue;
      if (dateStr < batchStart) continue;
      if (!dateMap[dateStr]) absent++;
    }
  }
  const total = present + absent;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function getDayStatus(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr > todayStr) return 'future';

    // Batch validity check — start date se pehle blank
    if (batchStart && dateStr < batchStart) return 'outofbatch';

    const types = dateMap[dateStr] || [];
    if (types.includes('in')) return 'present';
    if (types.length > 0) return 'absent';

    // Batch ke andar hai lekin record nahi — absent count karo
    if (batchStart && dateStr >= batchStart) return 'absent';

    return 'nodata';
  }

  return (
    <View style={cal.container}>
      <View style={cal.nav}>
        <TouchableOpacity style={cal.navBtn} onPress={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
          <FontAwesome5 name="chevron-left" size={14} color={color} />
        </TouchableOpacity>
        <Text style={[cal.monthTitle, { color }]}>{monthNames[month]} {year}</Text>
        <TouchableOpacity style={cal.navBtn} onPress={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
          <FontAwesome5 name="chevron-right" size={14} color={color} />
        </TouchableOpacity>
      </View>

      <View style={cal.stats}>
        {[
          { label: 'Present', val: present, color: '#059669' },
          { label: 'Absent', val: absent, color: '#DC2626' },
          { label: 'Total', val: total, color: '#1B1464' },
          { label: 'Att.', val: `${pct}%`, color: pct >= 75 ? '#059669' : '#DC2626' },
        ].map((s, i) => (
          <View key={i} style={cal.stat}>
            <Text style={[cal.statVal, { color: s.color }]}>{s.val}</Text>
            <Text style={cal.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={cal.dayRow}>
        {dayNames.map(d => (
          <Text key={d} style={[cal.dayName, d === 'Sun' && { color: '#DC2626' }]}>{d}</Text>
        ))}
      </View>

      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={cal.cell} />;
          const status = getDayStatus(day);
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const bgColor = status === 'present' ? '#ECFDF5'
            : status === 'absent' ? '#FEF2F2'
            : status === 'future' ? '#F8FAFD'
            : status === 'outofbatch' ? '#fff'
            : '#F0F4FA';
          const textColor = status === 'present' ? '#059669'
            : status === 'absent' ? '#DC2626'
            : status === 'future' ? '#B0C4DC'
            : status === 'outofbatch' ? '#E0E8F4'
            : '#6B7F99';
          return (
            <View key={day} style={[cal.cell, { backgroundColor: bgColor }, isToday && cal.todayCell]}>
              <Text style={[cal.cellText, { color: textColor }, isToday && cal.todayText]}>{day}</Text>
              {status === 'present' && <Text style={cal.dotP}>P</Text>}
              {status === 'absent' && <Text style={cal.dotA}>A</Text>}
              {status === 'outofbatch' && <Text style={{ fontSize: 7, color: '#E0E8F4' }}>-</Text>}
            </View>
          );
        })}
      </View>

      <View style={cal.legend}>
        {[
          { bg: '#ECFDF5', tc: '#059669', l: 'Present' },
          { bg: '#FEF2F2', tc: '#DC2626', l: 'Absent' },
          { bg: '#F0F4FA', tc: '#6B7F99', l: 'No Record' },
        ].map((l, i) => (
          <View key={i} style={cal.legendItem}>
            <View style={[cal.legendDot, { backgroundColor: l.bg }]} />
            <Text style={[cal.legendText, { color: l.tc }]}>{l.l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Student Doubts ───
function StudentDoubts({ studentId }) {
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'doubt_history'),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q,
      snap => {
        setDoubts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [studentId]);

  if (loading) return <ActivityIndicator color="#1B1464" style={{ marginTop: 30 }} />;
  if (doubts.length === 0) return (
    <View style={styles.emptyBox}>
      <FontAwesome5 name="comments" size={36} color="#B0C4DC" />
      <Text style={styles.emptyText}>Koi doubt history nahi</Text>
    </View>
  );

  return (
    <View>
      {doubts.map(d => (
        <View key={d.id} style={modal.doubtCard}>
          <View style={modal.doubtHeader}>
            <View style={modal.doubtBadge}><Text style={modal.doubtBadgeText}>{d.subject || 'General'}</Text></View>
            <Text style={modal.doubtDate}>
              {d.createdAt?.toDate?.()?.toLocaleDateString('en-IN') ||
               (d.time ? new Date(d.time).toLocaleDateString('en-IN') : '') || ''}
            </Text>
          </View>
          <Text style={modal.doubtQ}>Q: {d.question || d.userMessage || d.text || 'Question'}</Text>
          <Text style={modal.doubtA} numberOfLines={3}>AI: {d.answer || d.aiResponse || d.response || d.text || ''}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Student Detail Modal ───
function StudentDetailModal({ student, attendance, examMarks, quizHistory, onClose }) {
  const [activeTab, setActiveTab] = useState('info');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const studentAtt = attendance.filter(a => a.studentId === student.id);
  const totalDays = studentAtt.length;
  const presentDays = studentAtt.filter(a => a.type === 'in').length;
  const attPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
  const studentMarks = examMarks.filter(m => m.studentId === student.id);
  const studentQuiz = quizHistory.filter(q => q.uid === student.id || q.studentId === student.id);

  // Tab switch animation
  const switchTab = (newTab) => {
    if (newTab === activeTab) return;

    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: newTab === activeTab ? 0 : 20,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveTab(newTab);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modal.safe} edges={['top']}>

        {/* Header */}
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={modal.avatar}>
            <Text style={modal.avatarText}>{(student.studentName || 'S').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={modal.name}>{student.studentName}</Text>
            <Text style={modal.sub}>{student.class || student.presentClass} · {student.medium} · {student.board}</Text>
          </View>
        </View>

        {/* Attendance Summary */}
        <View style={modal.attBar}>
          {[
            { label: 'Total', val: totalDays, color: '#fff' },
            { label: 'Present', val: presentDays, color: '#4ADE80' },
            { label: 'Absent', val: totalDays - presentDays, color: '#F87171' },
            { label: 'Att.', val: `${attPct}%`, color: attPct >= 75 ? '#4ADE80' : '#F87171' },
          ].map((s, i) => (
            <View key={i} style={modal.attStat}>
              <Text style={[modal.attStatVal, { color: s.color }]}>{s.val}</Text>
              <Text style={modal.attStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: '#fff', minHeight: 52, maxHeight: 52 }}>
          <View style={{ flexDirection: 'row', padding: 8, gap: 6 }}>
            {[
              { id: 'info', label: 'Info', icon: 'user' },
              { id: 'attendance', label: 'Attendance', icon: 'calendar-alt' },
              { id: 'marks', label: 'Class Marks', icon: 'file-alt' },
              { id: 'quiz', label: 'Quiz', icon: 'question-circle' },
              { id: 'doubts', label: 'Doubts', icon: 'comments' },
            ].map(t => (
              <TouchableOpacity
                key={t.id}
                style={[modal.tabChip, activeTab === t.id && modal.tabChipActive]}
                onPress={() => switchTab(t.id)}>
                <FontAwesome5 name={t.icon} size={11} color={activeTab === t.id ? '#fff' : '#6B7F99'} />
                <Text style={[modal.tabChipText, activeTab === t.id && modal.tabChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>

          {/* INFO */}
          {activeTab === 'info' && (
            <Animated.View
              style={[
                modal.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              <View style={modal.card}>
              {[
                ['Name', student.studentName],
                ['Class', student.class || student.presentClass],
                ['Medium', student.medium],
                ['Board', student.board],
                ['Email', student.studentEmail],
                ['Phone', student.studentPhone || student.phone],
                ['Father', student.fatherName],
                ['Father Phone', student.fatherPhone],
                ['Mother', student.motherName],
                ['DOB', student.dob],
                ['Enrollment No.', student.enrollmentNumber],
                ['Roll No.', student.rollNumber],
                ['Address', student.address],
              ].filter(([, v]) => v).map(([label, val], i, arr) => (
                <View key={label} style={[modal.infoRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F0F4FA' }]}>
                  <Text style={modal.infoLabel}>{label}</Text>
                  <Text style={modal.infoVal}>{val}</Text>
                </View>
              ))}
            </View>
            </Animated.View>
          )}

          {/* ATTENDANCE CALENDAR */}
          {activeTab === 'attendance' && (
            <Animated.View
              style={[
                modal.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              <AttendanceCalendar
                records={studentAtt}
                color="#1B1464"
                batchStart={student.batchStartDate
                  ? (() => {
                      // DD/MM/YYYY → YYYY-MM-DD convert karo
                      const parts = student.batchStartDate.split('/');
                      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                      return student.batchStartDate;
                    })()
                  : null}
              />
            </Animated.View>
          )}

          {/* CLASS MARKS */}
          {activeTab === 'marks' && (
            <Animated.View
              style={[
                modal.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              {studentMarks.length === 0
                ? <View style={styles.emptyBox}>
                    <FontAwesome5 name="file-alt" size={36} color="#B0C4DC" />
                    <Text style={styles.emptyText}>Koi marks record nahi</Text>
                  </View>
                : studentMarks.map((m, i) => (
                    <View key={i} style={modal.markCard}>
                      <View style={modal.markHeader}>
                        <FontAwesome5 name="file-alt" size={13} color="#1B1464" />
                        <Text style={modal.markTitle}>{m.examTitle || 'Exam'}</Text>
                        <Text style={modal.markDateText}>{m.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || ''}</Text>
                      </View>
                      {m.marks && typeof m.marks === 'object' && (
                        <>
                          <View style={modal.marksGrid}>
                            {Object.entries(m.marks).map(([subject, score]) => (
                              <View key={subject} style={modal.markSubjectCard}>
                                <Text style={modal.markSubjectName}>{subject}</Text>
                                <Text style={modal.markSubjectScore}>{score}</Text>
                                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
                                  /{m.maxMarks ? Math.round(m.maxMarks / Object.keys(m.marks).length) : 100}
                                </Text>
                              </View>
                            ))}
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F4FA' }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7F99' }}>Total Score:</Text>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#1B1464' }}>
                              {Object.values(m.marks).reduce((s, v) => s + Number(v || 0), 0)}
                              /{m.maxMarks || Object.keys(m.marks).length * 100}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7F99' }}>Percentage:</Text>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: (() => { const pct = Math.round((Object.values(m.marks).reduce((s, v) => s + Number(v || 0), 0) / (m.maxMarks || Object.keys(m.marks).length * 100)) * 100); return pct >= 75 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626'; })() }}>
                              {Math.round((Object.values(m.marks).reduce((s, v) => s + Number(v || 0), 0) / (m.maxMarks || Object.keys(m.marks).length * 100)) * 100)}%
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  ))}
            </Animated.View>
          )}

          {/* QUIZ */}
          {activeTab === 'quiz' && (
            <Animated.View
              style={[
                modal.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              {studentQuiz.length === 0
              ? <View style={styles.emptyBox}>
                  <FontAwesome5 name="question-circle" size={36} color="#B0C4DC" />
                  <Text style={styles.emptyText}>Koi quiz history nahi</Text>
                </View>
              : studentQuiz.map((q, i) => {
                  const pct = q.percentage || Math.round(((q.score || 0) / (q.total || 1)) * 100) || 0;
                  return (
                    <View key={i} style={modal.quizCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={modal.quizSubject}>{q.subject}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          {q.chapter && <View style={modal.quizChip}><Text style={modal.quizChipText}>{q.chapter}</Text></View>}
                          {q.difficulty && <View style={[modal.quizChip, { backgroundColor: '#FFF7ED' }]}><Text style={[modal.quizChipText, { color: '#D97706' }]}>{q.difficulty}</Text></View>}
                        </View>
                        <Text style={modal.quizDate}>{q.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || ''}</Text>
                      </View>
                      <View style={[modal.quizScore, { backgroundColor: pct >= 75 ? '#ECFDF5' : pct >= 50 ? '#FFF7ED' : '#FEF2F2' }]}>
                        <Text style={[modal.quizScorePct, { color: pct >= 75 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626' }]}>{pct}%</Text>
                        <Text style={modal.quizScoreRaw}>{q.score}/{q.total}</Text>
                      </View>
                    </View>
                  );
                })}
            </Animated.View>
          )}

          {/* DOUBTS */}
          {activeTab === 'doubts' && (
            <Animated.View
              style={[
                modal.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              <StudentDoubts studentId={student.id} />
            </Animated.View>
          )}

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Teacher Dashboard ───
export default function TeacherDashboard() {
  const router = useRouter();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [examMarks, setExamMarks] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);

  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Rankings tab
  const [rankTab, setRankTab] = useState('exam'); // exam | quiz
  const [selectedRankExam, setSelectedRankExam] = useState(null);
  const [selectedRankSubject, setSelectedRankSubject] = useState('All');
  const [rankBatchFilter, setRankBatchFilter] = useState('all');
  const [onlineTests, setOnlineTests] = useState([]);
  const [onlineTestResults, setOnlineTestResults] = useState([]);
  const [selectedRankOnlineTest, setSelectedRankOnlineTest] = useState(null);

  const [notifMsg, setNotifMsg] = useState('');
  const [notifBatch, setNotifBatch] = useState('all');
  const [notifType, setNotifType] = useState('general');
  const [notifDate, setNotifDate] = useState('');
  const [notifTime, setNotifTime] = useState('');
  const [notifSending, setNotifSending] = useState(false);

  // Date/Time pickers
  const [showNotifDatePicker, setShowNotifDatePicker] = useState(false);
  const [showNotifTimePicker, setShowNotifTimePicker] = useState(false);
  const [showLeaveFromPicker, setShowLeaveFromPicker] = useState(false);
  const [showLeaveToPicker, setShowLeaveToPicker] = useState(false);

  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // Sent notifications
  const [sentNotifications, setSentNotifications] = useState([]);
  const [editingNotif, setEditingNotif] = useState(null);
  const [editingLeave, setEditingLeave] = useState(null);

  // Teacher ke liye received notifications
  const [teacherNotifs, setTeacherNotifs] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [lastSeenNotif, setLastSeenNotif] = useState(null);

  function formatDate(date) {
    return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
  }
  function formatTime(date) {
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }

  // Tab switch animation
  const switchTab = (newTab) => {
    if (newTab === activeTab) return;

    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: newTab === activeTab ? 0 : 20,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveTab(newTab);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { router.replace('/'); return; }

      onSnapshot(collection(db, 'teachers'), s => {
        const found = s.docs.find(d => d.data().email?.toLowerCase() === user.email?.toLowerCase());
        if (found) setTeacher({ id: found.id, ...found.data() });
        else router.replace('/');
        setLoading(false);
      });

      onSnapshot(collection(db, 'students'), s => setStudents(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      // Teacher ke liye notifications — forTeacher: 'all' ya specific email
      onSnapshot(
        query(collection(db, 'notifications'), orderBy('createdAt', 'desc')),
        snap => {
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // Filter: forTeacher === 'all' ya teacher email match kare
          const teacherNotifList = all.filter(n =>
            n.forTeacher === 'all' ||
            n.forTeacher === user.email ||
            n.targetType === 'teacher' ||
            n.targetType === 'all'
          );
          setTeacherNotifs(teacherNotifList);
        },
        () => {}
      );

      // Last seen timestamp load karo
      AsyncStorage.getItem('pid_teacher_last_notif').then(val => {
        if (val) setLastSeenNotif(Number(val));
      });
      onSnapshot(collection(db, 'courses'), s => setCourses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      onSnapshot(collection(db, 'attendance'), s => setAttendance(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      onSnapshot(collection(db, 'exam_marks'), s => setExamMarks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      onSnapshot(collection(db, 'online_tests'), s => setOnlineTests(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      onSnapshot(collection(db, 'online_test_results'), s => setOnlineTestResults(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      onSnapshot(collection(db, 'quiz_history'), s => setQuizHistory(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      onSnapshot(query(collection(db, 'leave_requests'), where('teacherEmail', '==', user.email)),
        s => setMyLeaves(s.docs.map(d => ({ id: d.id, ...d.data() })))
      );
      onSnapshot(
        query(
          collection(db, 'notifications'),
          where('teacherEmail', '==', user.email),
          orderBy('createdAt', 'desc')
        ),
        s => setSentNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        () => {
          // Index nahi hai toh bina order ke try karo
          onSnapshot(
            query(collection(db, 'notifications'), where('teacherEmail', '==', user.email)),
            s => setSentNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
          );
        }
      );
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

  // Teacher ke courses
  const teacherCourses = courses.filter(c =>
    c.teachers?.some(t => t.name?.toLowerCase() === teacher?.name?.toLowerCase())
  );
  const teacherClassIds = teacherCourses.map(c => c.classId || '');

  // Teacher ke batches
  const teacherBatches = BATCH_OPTIONS.filter(b =>
    teacherClassIds.some(cid => {
      if (cid === '12') return b.class === '12th';
      if (cid === '11') return b.class === '11th';
      if (cid === '10') return b.class === '10th';
      if (cid === '9') return b.class === '9th';
      if (cid === '2-8') return b.class === '2nd-8th';
      if (cid === 'prayas') return b.class === 'Prayas';
      return false;
    })
  );

  // Teacher ke students
  const allTeacherStudents = students.filter(s => {
    const sClass = s.class || s.presentClass || '';
    return teacherClassIds.some(cid => {
      if (cid === '12') return sClass === '12th';
      if (cid === '11') return sClass === '11th';
      if (cid === '10') return sClass === '10th';
      if (cid === '9') return sClass === '9th';
      if (cid === '2-8') return ['2nd','3rd','4th','5th','6th','7th','8th'].includes(sClass);
      return false;
    });
  });

  const filteredStudents = filterByBatch(allTeacherStudents, selectedBatch);

  // Teacher ki apni attendance
  const myAttendance = attendance.filter(a =>
    a.studentId === `teacher_${teacher?.id}` ||
    (teacher?.rfidCode && a.rfidCode === teacher.rfidCode)
  );

  async function sendNotification() {
    if (!notifMsg.trim()) { Alert.alert('Error', 'Message likho!'); return; }
    setNotifSending(true);
    try {
      const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
      if (editingNotif) {
        await updateDoc(firestoreDoc(db, 'notifications', editingNotif), {
          message: notifMsg.trim(),
          forClass: notifBatch,
          type: notifType,
          scheduledDate: notifDate || null,
          scheduledTime: notifTime || null,
          editedAt: serverTimestamp(),
        });
        setEditingNotif(null);
        Alert.alert('Updated!', 'Notification update ho gayi!');
      } else {
        await addDoc(collection(db, 'notifications'), {
          message: notifMsg.trim(),
          forClass: notifBatch,
          type: notifType,
          scheduledDate: notifDate || null,
          scheduledTime: notifTime || null,
          sentBy: teacher?.name || 'Teacher',
          teacherId: teacher?.id || '',
          teacherEmail: auth.currentUser?.email || '',
          createdAt: serverTimestamp(),
        });
        Alert.alert('Sent!', 'Notification bhej di gayi!');
      }
      setNotifMsg(''); setNotifDate(''); setNotifTime('');
    } catch (e) { Alert.alert('Error', 'Dobara try karo.'); }
    setNotifSending(false);
  }

  async function submitLeave() {
    if (!leaveFrom || !leaveTo || !leaveReason.trim()) { Alert.alert('Error', 'Sab fields bharo!'); return; }
    setLeaveSubmitting(true);
    try {
      const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
      if (editingLeave) {
        await updateDoc(firestoreDoc(db, 'leave_requests', editingLeave), {
          fromDate: leaveFrom,
          toDate: leaveTo,
          reason: leaveReason.trim(),
          editedAt: serverTimestamp(),
        });
        setEditingLeave(null);
        Alert.alert('Updated!', 'Leave request update ho gayi!');
      } else {
        await addDoc(collection(db, 'leave_requests'), {
          teacherEmail: auth.currentUser?.email,
          teacherName: teacher?.name || 'Teacher',
          fromDate: leaveFrom,
          toDate: leaveTo,
          reason: leaveReason.trim(),
          status: 'submitted',
          createdAt: serverTimestamp(),
        });
        Alert.alert('Submitted!', 'Leave request submit ho gayi!');
      }
      setLeaveFrom(''); setLeaveTo(''); setLeaveReason('');
    } catch (e) { Alert.alert('Error', 'Leave request nahi bheji.'); }
    setLeaveSubmitting(false);
  }

  const tabs = [
    { id: 'students', label: 'Students', icon: 'users' },
    { id: 'myatt', label: 'My Att.', icon: 'calendar-check' },
    { id: 'notify', label: 'Notify', icon: 'bell' },
    { id: 'leave', label: 'Leave', icon: 'calendar-times' },
    { id: 'rankings', label: 'Rankings', icon: 'trophy' },
    { id: 'profile', label: 'Profile', icon: 'user-circle' },
  ];

  // Unread notifications count
  const unreadTeacherNotifs = teacherNotifs.filter(n => {
    const t = n.createdAt?.toDate?.()?.getTime() || 0;
    return t > (lastSeenNotif || 0);
  }).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(teacher?.name || 'T').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Welcome back!</Text>
            <Text style={styles.teacherName}>{teacher?.name}</Text>
            <Text style={styles.teacherSub}>{teacher?.subject} · PID</Text>
          </View>
          {/* Bell Icon with badge */}
          <TouchableOpacity
            style={styles.headerBellBtn}
            onPress={async () => {
              setShowNotifModal(true);
              const now = Date.now();
              setLastSeenNotif(now);
              await AsyncStorage.setItem('pid_teacher_last_notif', String(now));
            }}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {unreadTeacherNotifs > 0 && (
              <View style={styles.headerBellBadge}>
                <Text style={styles.headerBellBadgeText}>
                  {unreadTeacherNotifs > 99 ? '99+' : unreadTeacherNotifs}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Students', val: allTeacherStudents.length, icon: 'users', color: '#1B1464', bg: '#EFF6FF' },
            { label: 'Courses', val: teacherCourses.length, icon: 'chalkboard', color: '#059669', bg: '#ECFDF5' },
            { label: 'Leaves', val: myLeaves.length, icon: 'calendar-times', color: '#D97706', bg: '#FFF7ED' },
          ].map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <FontAwesome5 name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Tab Bar */}
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 300 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

          {/* ═══ STUDENTS ═══ */}
          {activeTab === 'students' && (
            <Animated.View
              style={[
                styles.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.chip, selectedBatch === 'all' && styles.chipActive]} onPress={() => setSelectedBatch('all')}>
                    <Text style={[styles.chipText, selectedBatch === 'all' && styles.chipTextActive]}>All</Text>
                  </TouchableOpacity>
                  {teacherBatches.map(b => (
                    <TouchableOpacity key={b.value} style={[styles.chip, selectedBatch === b.value && styles.chipActive]} onPress={() => setSelectedBatch(b.value)}>
                      <Text style={[styles.chipText, selectedBatch === b.value && styles.chipTextActive]}>{b.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.sectionLabel}>{filteredStudents.length} Students</Text>

              {filteredStudents.length === 0
                ? <View style={styles.emptyBox}>
                    <FontAwesome5 name="users" size={36} color="#B0C4DC" />
                    <Text style={styles.emptyText}>Koi student nahi mila</Text>
                  </View>
                : filteredStudents.map(s => {
                    const sAtt = attendance.filter(a => a.studentId === s.id);
                    const attPct = sAtt.length > 0 ? Math.round((sAtt.filter(a => a.type === 'in').length / sAtt.length) * 100) : 0;
                    return (
                      <TouchableOpacity key={s.id} style={styles.studentCard} onPress={() => setSelectedStudent(s)} activeOpacity={0.7}>
                        <View style={styles.studentAvatar}>
                          <Text style={styles.studentAvatarText}>{(s.studentName || 'S').charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.studentInfo}>
                          <Text style={styles.studentName}>{s.studentName}</Text>
                          <Text style={styles.studentMeta}>{s.class || s.presentClass} · {s.medium} · {s.board}</Text>
                        </View>
                        <View style={[styles.attPill, { backgroundColor: attPct >= 75 ? '#ECFDF5' : attPct >= 50 ? '#FFF7ED' : '#FEF2F2' }]}>
                          <Text style={[styles.attPillText, { color: attPct >= 75 ? '#059669' : attPct >= 50 ? '#D97706' : '#DC2626' }]}>{attPct}%</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#B0C4DC" />
                      </TouchableOpacity>
                    );
                  })}
            </Animated.View>
          )}

          {/* ═══ MY ATTENDANCE ═══ */}
          {activeTab === 'myatt' && (
            <Animated.View
              style={[
                styles.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              <Text style={styles.sectionLabel}>Meri Attendance Calendar</Text>
              <AttendanceCalendar records={myAttendance} color="#059669" />
            </Animated.View>
          )}

          {/* ═══ NOTIFY ═══ */}
          {activeTab === 'notify' && (
            <Animated.View
              style={[
                styles.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              <Text style={styles.sectionLabel}>
                {editingNotif ? '✏️ Notification Edit Karo' : 'Notification Bhejo'}
              </Text>
              {editingNotif && (
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => { setEditingNotif(null); setNotifMsg(''); setNotifDate(''); setNotifTime(''); }}>
                  <FontAwesome5 name="times" size={12} color="#DC2626" />
                  <Text style={styles.cancelEditBtnText}>Edit Cancel Karo</Text>
                </TouchableOpacity>
              )}
              <View style={styles.formCard}>

                <Text style={styles.formLabel}>Class/Batch:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[styles.chip, notifBatch === 'all' && styles.chipActive]} onPress={() => setNotifBatch('all')}>
                      <Text style={[styles.chipText, notifBatch === 'all' && styles.chipTextActive]}>All</Text>
                    </TouchableOpacity>
                    {teacherBatches.map(b => (
                      <TouchableOpacity key={b.value} style={[styles.chip, notifBatch === b.value && styles.chipActive]} onPress={() => setNotifBatch(b.value)}>
                        <Text style={[styles.chipText, notifBatch === b.value && styles.chipTextActive]}>{b.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={styles.formLabel}>Type:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {[
                    { id: 'general', label: 'General', icon: 'info-circle' },
                    { id: 'exam', label: 'Exam', icon: 'pencil-alt' },
                    { id: 'holiday', label: 'Holiday', icon: 'calendar' },
                    { id: 'urgent', label: 'Urgent', icon: 'exclamation-circle' },
                  ].map(t => (
                    <TouchableOpacity key={t.id} style={[styles.typeChip, notifType === t.id && styles.typeChipActive]} onPress={() => setNotifType(t.id)}>
                      <FontAwesome5 name={t.icon} size={11} color={notifType === t.id ? '#fff' : '#6B7F99'} />
                      <Text style={[styles.typeChipText, notifType === t.id && styles.typeChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>Schedule (Optional):</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subLabel}>Date:</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setShowNotifDatePicker(true)}>
                      <Text style={{ color: notifDate ? '#0B1826' : '#B0C4DC', fontSize: 14 }}>{notifDate || 'DD/MM/YYYY'}</Text>
                    </TouchableOpacity>
                    {showNotifDatePicker && (
                      <DateTimePicker
                        value={new Date()}
                        mode="date"
                        display="default"
                        minimumDate={new Date()}
                        onChange={(event, date) => {
                          setShowNotifDatePicker(false);
                          if (date) setNotifDate(formatDate(date));
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subLabel}>Time:</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setShowNotifTimePicker(true)}>
                      <Text style={{ color: notifTime ? '#0B1826' : '#B0C4DC', fontSize: 14 }}>{notifTime || 'HH:MM'}</Text>
                    </TouchableOpacity>
                    {showNotifTimePicker && (
                      <DateTimePicker
                        value={new Date()}
                        mode="time"
                        display="default"
                        onChange={(event, date) => {
                          setShowNotifTimePicker(false);
                          if (date) setNotifTime(formatTime(date));
                        }}
                      />
                    )}
                  </View>
                </View>

                <Text style={styles.formLabel}>Message:</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Notification message likho..."
                  placeholderTextColor="#B0C4DC"
                  value={notifMsg}
                  onChangeText={setNotifMsg}
                  multiline
                  numberOfLines={4}
                  onFocus={() => {}}
                  blurOnSubmit={false}
                />

                <TouchableOpacity style={[styles.actionBtn, notifSending && { opacity: 0.7 }, editingNotif && { backgroundColor: '#059669' }]} onPress={sendNotification} disabled={notifSending}>
                  {notifSending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><FontAwesome5 name={editingNotif ? 'save' : 'paper-plane'} size={14} color="#fff" />
                        <Text style={styles.actionBtnText}>{editingNotif ? 'Update Karo' : 'Send Notification'}</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>

              {/* Sent Notifications List */}
              {sentNotifications.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.sectionLabel}>Bheji Gayi Notifications (24h mein edit/delete)</Text>
                  {sentNotifications.map((n) => {
                    const sentTime = n.createdAt?.toDate?.();
                    const canEdit = sentTime && (Date.now() - sentTime.getTime()) < 24 * 60 * 60 * 1000;
                    return (
                      <View key={n.id} style={styles.sentNotifCard}>
                        <View style={styles.sentNotifHeader}>
                          <View style={[styles.typeChip, { backgroundColor: '#EFF6FF' }]}>
                            <Text style={[styles.typeChipText, { color: '#1B1464' }]}>{n.type || 'general'}</Text>
                          </View>
                          <Text style={styles.sentNotifTime}>
                            {sentTime?.toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </Text>
                        </View>
                        <Text style={styles.sentNotifMsg}>{n.message}</Text>
                        <Text style={styles.sentNotifBatch}>Class: {n.forClass || 'All'}</Text>
                        {canEdit && (
                          <View style={styles.sentNotifActions}>
                            <TouchableOpacity
                              style={styles.editBtn}
                              onPress={() => {
                                setNotifMsg(n.message);
                                setNotifBatch(n.forClass || 'all');
                                setNotifType(n.type || 'general');
                                setEditingNotif(n.id);
                              }}>
                              <FontAwesome5 name="edit" size={12} color="#1B1464" />
                              <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => {
                                Alert.alert('Delete?', 'Ye notification delete karna chahte ho?', [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Delete', style: 'destructive', onPress: async () => {
                                    const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
                                    await deleteDoc(firestoreDoc(db, 'notifications', n.id));
                                  }},
                                ]);
                              }}>
                              <FontAwesome5 name="trash" size={12} color="#DC2626" />
                              <Text style={styles.deleteBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          )}

          {/* ═══ LEAVE ═══ */}
          {activeTab === 'leave' && (
            <Animated.View
              style={[
                styles.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              <Text style={styles.sectionLabel}>
                {editingLeave ? '✏️ Leave Edit Karo' : 'Leave Apply Karo'}
              </Text>
              {editingLeave && (
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => { setEditingLeave(null); setLeaveFrom(''); setLeaveTo(''); setLeaveReason(''); }}>
                  <FontAwesome5 name="times" size={12} color="#DC2626" />
                  <Text style={styles.cancelEditBtnText}>Edit Cancel Karo</Text>
                </TouchableOpacity>
              )}
              <View style={styles.formCard}>
                <Text style={styles.formLabel}>From Date:</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowLeaveFromPicker(true)}>
                  <Text style={{ color: leaveFrom ? '#0B1826' : '#B0C4DC', fontSize: 14 }}>{leaveFrom || 'DD/MM/YYYY tap karo'}</Text>
                </TouchableOpacity>
                {showLeaveFromPicker && (
                  <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowLeaveFromPicker(false);
                      if (date) setLeaveFrom(formatDate(date));
                    }}
                  />
                )}
                <Text style={styles.formLabel}>To Date:</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowLeaveToPicker(true)}>
                  <Text style={{ color: leaveTo ? '#0B1826' : '#B0C4DC', fontSize: 14 }}>{leaveTo || 'DD/MM/YYYY tap karo'}</Text>
                </TouchableOpacity>
                {showLeaveToPicker && (
                  <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display="default"
                    minimumDate={leaveFrom ? new Date(leaveFrom.split('/').reverse().join('-')) : new Date()}
                    onChange={(event, date) => {
                      setShowLeaveToPicker(false);
                      if (date) setLeaveTo(formatDate(date));
                    }}
                  />
                )}
                <Text style={styles.formLabel}>Reason:</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Leave ka reason likho..."
                  placeholderTextColor="#B0C4DC"
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                  multiline
                  numberOfLines={3}
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={[styles.actionBtn, leaveSubmitting && { opacity: 0.7 }, editingLeave && { backgroundColor: '#059669' }]} onPress={submitLeave} disabled={leaveSubmitting}>
                  {leaveSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><FontAwesome5 name={editingLeave ? 'save' : 'paper-plane'} size={14} color="#fff" />
                        <Text style={styles.actionBtnText}>{editingLeave ? 'Update Karo' : 'Submit Leave Request'}</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>

              {myLeaves.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.sectionLabel}>My Leave Requests</Text>
                  {myLeaves.map((l, i) => {
                    const sentTime = l.createdAt?.toDate?.();
                    const canEdit = sentTime && (Date.now() - sentTime.getTime()) < 24 * 60 * 60 * 1000;
                    return (
                      <View key={i} style={[styles.leaveCard, editingLeave === l.id && { borderWidth: 2, borderColor: '#1B1464' }]}>
                        <View style={styles.leaveTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <FontAwesome5 name="calendar" size={11} color="#1B1464" />
                            <Text style={styles.leaveDateText}>{l.fromDate} → {l.toDate}</Text>
                          </View>
                          {/* Status: submitted dikhao pending ki jagah */}
                          <View style={[styles.leaveStatusBadge, {
                            backgroundColor: l.status === 'approved' ? '#ECFDF5' : l.status === 'rejected' ? '#FEF2F2' : '#EFF6FF'
                          }]}>
                            <Text style={[styles.leaveStatusText, {
                              color: l.status === 'approved' ? '#059669' : l.status === 'rejected' ? '#DC2626' : '#1B1464'
                            }]}>
                              {l.status === 'approved' ? '✓ Approved' : l.status === 'rejected' ? '✗ Rejected' : '📋 Submitted'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.leaveReason}>{l.reason}</Text>

                        {/* Edit/Delete — sirf 24h ke andr */}
                        {canEdit && l.status !== 'approved' && (
                          <View style={styles.sentNotifActions}>
                            <TouchableOpacity
                              style={styles.editBtn}
                              onPress={() => {
                                setEditingLeave(l.id);
                                setLeaveFrom(l.fromDate);
                                setLeaveTo(l.toDate);
                                setLeaveReason(l.reason);
                              }}>
                              <FontAwesome5 name="edit" size={12} color="#1B1464" />
                              <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => {
                                Alert.alert('Delete?', 'Ye leave request delete karna chahte ho?', [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Delete', style: 'destructive', onPress: async () => {
                                    const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
                                    await deleteDoc(firestoreDoc(db, 'leave_requests', l.id));
                                  }},
                                ]);
                              }}>
                              <FontAwesome5 name="trash" size={12} color="#DC2626" />
                              <Text style={styles.deleteBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          )}

          {/* ═══ RANKINGS ═══ */}
          {activeTab === 'rankings' && (
            <Animated.View style={[styles.tabContent, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>

              {/* Sub tabs */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {[
                  { id: 'exam', label: 'Class Tests', icon: 'file-alt' },
                  { id: 'online', label: 'Online Tests', icon: 'laptop' },
                  { id: 'quiz', label: 'AI Quiz', icon: 'brain' },
                ].map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.rankSubTab, rankTab === t.id && styles.rankSubTabActive]}
                    onPress={() => setRankTab(t.id)}>
                    <FontAwesome5 name={t.icon} size={11} color={rankTab === t.id ? '#fff' : '#6B7F99'} />
                    <Text style={[styles.rankSubTabText, rankTab === t.id && styles.rankSubTabTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Batch Filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.chip, rankBatchFilter === 'all' && styles.chipActive]} onPress={() => setRankBatchFilter('all')}>
                    <Text style={[styles.chipText, rankBatchFilter === 'all' && styles.chipTextActive]}>All Batches</Text>
                  </TouchableOpacity>
                  {teacherBatches.map(b => (
                    <TouchableOpacity key={b.value} style={[styles.chip, rankBatchFilter === b.value && styles.chipActive]} onPress={() => setRankBatchFilter(b.value)}>
                      <Text style={[styles.chipText, rankBatchFilter === b.value && styles.chipTextActive]}>{b.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* ── CLASS TEST RANKINGS ── */}
              {rankTab === 'exam' && (() => {
                const uniqueExams = [...new Map(examMarks.map(m => [m.examId, { id: m.examId, title: m.examTitle || 'Exam' }])).values()];
                const batchStudents = filterByBatch(allTeacherStudents, rankBatchFilter);
                const batchStudentIds = batchStudents.map(s => s.id);

                const examRankData = selectedRankExam
                  ? examMarks
                      .filter(m => m.examId === selectedRankExam.id && batchStudentIds.includes(m.studentId))
                      .map(m => {
                        const total = m.totalMarks || Object.values(m.marks || {}).reduce((s, v) => s + Number(v || 0), 0);
                        const maxM = m.maxMarks || 300;
                        const pct = maxM > 0 ? Math.round((total / maxM) * 100) : 0;
                        return { studentId: m.studentId, studentName: m.studentName || 'Student', marks: m.marks || {}, total, pct };
                      })
                      .sort((a, b) => b.pct - a.pct)
                      .map((r, i) => ({ ...r, rank: i + 1 }))
                  : [];

                // Subject wise top performers
                const allSubjects = selectedRankExam
                  ? [...new Set(examMarks.filter(m => m.examId === selectedRankExam.id).flatMap(m => Object.keys(m.marks || {})))]
                  : [];

                return (
                  <View>
                    <Text style={styles.sectionLabel}>Exam Select Karo</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {uniqueExams.length === 0
                          ? <Text style={{ color: '#B0C4DC', fontSize: 13 }}>Koi exam nahi</Text>
                          : uniqueExams.map(ex => (
                              <TouchableOpacity
                                key={ex.id}
                                style={[styles.chip, selectedRankExam?.id === ex.id && styles.chipActive]}
                                onPress={() => { setSelectedRankExam(ex); setSelectedRankSubject('All'); }}>
                                <Text style={[styles.chipText, selectedRankExam?.id === ex.id && styles.chipTextActive]}>{ex.title}</Text>
                              </TouchableOpacity>
                            ))
                        }
                      </View>
                    </ScrollView>

                    {selectedRankExam && (
                      <>
                        {/* Subject filter */}
                        <Text style={styles.sectionLabel}>Subject Filter</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {['All', ...allSubjects].map(sub => (
                              <TouchableOpacity
                                key={sub}
                                style={[styles.chip, selectedRankSubject === sub && styles.chipActive]}
                                onPress={() => setSelectedRankSubject(sub)}>
                                <Text style={[styles.chipText, selectedRankSubject === sub && styles.chipTextActive]}>{sub}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>

                        {/* Leaderboard */}
                        <Text style={styles.sectionLabel}>
                          {selectedRankSubject === 'All' ? 'Overall Ranking' : `${selectedRankSubject} Ranking`}
                        </Text>
                        <View style={styles.rankCard}>
                          {/* Header */}
                          <View style={styles.rankHeader}>
                            <Text style={[styles.rankHeaderText, { width: 40 }]}>Rank</Text>
                            <Text style={[styles.rankHeaderText, { flex: 1 }]}>Student</Text>
                            {selectedRankSubject !== 'All'
                              ? <Text style={[styles.rankHeaderText, { width: 60, textAlign: 'center' }]}>Marks</Text>
                              : <Text style={[styles.rankHeaderText, { width: 60, textAlign: 'center' }]}>Total</Text>
                            }
                            <Text style={[styles.rankHeaderText, { width: 50, textAlign: 'center' }]}>%</Text>
                          </View>

                          {examRankData.length === 0
                            ? <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: '#B0C4DC', fontSize: 12 }}>Koi data nahi</Text>
                              </View>
                            : (() => {
                                // Subject filter apply karo
                                let displayData = examRankData;
                                if (selectedRankSubject !== 'All') {
                                  displayData = examRankData
                                    .map(r => ({
                                      ...r,
                                      subjectMarks: Number(r.marks[selectedRankSubject] || 0),
                                    }))
                                    .sort((a, b) => b.subjectMarks - a.subjectMarks)
                                    .map((r, i) => ({ ...r, rank: i + 1 }));
                                }
                                return displayData.map((r, i) => {
                                  const medal = r.rank === 1 ? '#D4A843' : r.rank === 2 ? '#9CA3AF' : r.rank === 3 ? '#C97B4B' : null;
                                  return (
                                    <View key={r.studentId} style={[styles.rankRow, i < displayData.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F0F4FA' }]}>
                                      <View style={{ width: 40, alignItems: 'center' }}>
                                        {medal
                                          ? <FontAwesome5 name="medal" size={16} color={medal} />
                                          : <Text style={styles.rankNum}>{r.rank}</Text>
                                        }
                                      </View>
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.rankName}>{r.studentName}</Text>
                                        {selectedRankSubject === 'All' && (
                                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                                            {Object.entries(r.marks).map(([sub, val]) => (
                                              <Text key={sub} style={styles.rankSubMark}>{sub}: {val}/100</Text>
                                            ))}
                                          </View>
                                        )}
                                        <Text style={{ fontSize: 11, color: '#6B7F99', marginTop: 3 }}>
                                          Total: {r.total}/{examMarks.find(m => m.examId === selectedRankExam?.id && m.studentId === r.studentId)?.maxMarks || Object.keys(r.marks).length * 100}
                                        </Text>
                                      </View>
                                      <View style={{ width: 60, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#1B1464' }}>
                                          {selectedRankSubject !== 'All' ? r.marks[selectedRankSubject] || 0 : r.total}
                                        </Text>
                                      </View>
                                      <View style={{ width: 50, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: r.pct >= 75 ? '#059669' : r.pct >= 50 ? '#D97706' : '#DC2626' }}>
                                          {selectedRankSubject !== 'All'
                                            ? `${Math.round((Number(r.marks[selectedRankSubject] || 0) / 100) * 100)}%`
                                            : `${r.pct}%`
                                          }
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                });
                              })()
                          }
                        </View>

                        {/* Summary */}
                        <View style={styles.rankSummary}>
                          <View style={styles.rankSummaryItem}>
                            <Text style={styles.rankSummaryVal}>{examRankData.length}</Text>
                            <Text style={styles.rankSummaryLabel}>Total Students</Text>
                          </View>
                          <View style={styles.rankSummaryItem}>
                            <Text style={[styles.rankSummaryVal, { color: '#059669' }]}>
                              {examRankData.filter(r => r.pct >= 75).length}
                            </Text>
                            <Text style={styles.rankSummaryLabel}>75%+ Score</Text>
                          </View>
                          <View style={styles.rankSummaryItem}>
                            <Text style={[styles.rankSummaryVal, { color: '#D4A843' }]}>
                              {examRankData[0]?.studentName?.split(' ')[0] || '—'}
                            </Text>
                            <Text style={styles.rankSummaryLabel}>Top Student</Text>
                          </View>
                          <View style={styles.rankSummaryItem}>
                            <Text style={styles.rankSummaryVal}>
                              {examRankData.length > 0 ? Math.round(examRankData.reduce((s, r) => s + r.pct, 0) / examRankData.length) : 0}%
                            </Text>
                            <Text style={styles.rankSummaryLabel}>Class Avg</Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                );
              })()}

              {/* ── ONLINE TEST RANKINGS ── */}
              {rankTab === 'online' && (() => {
                const batchStudents = filterByBatch(allTeacherStudents, rankBatchFilter);
                const batchStudentIds = batchStudents.map(s => s.id);
                const uniqueOnlineTests = [...new Map(
                  onlineTestResults.map(r => [r.examId || r.testId, {
                    id: r.examId || r.testId,
                    title: r.examTitle || r.title || onlineTests.find(t => t.id === (r.examId || r.testId))?.title || 'Test'
                  }])
                ).values()];

                const onlineRankData = selectedRankOnlineTest
                  ? onlineTestResults
                      .filter(r => (r.examId || r.testId) === selectedRankOnlineTest.id && batchStudentIds.includes(r.studentId))
                      .map(r => {
                        const score = r.correctAnswers || r.score || 0;
                        const total = r.totalQuestions || r.total || 0;
                        const pct = r.percentage || (total > 0 ? Math.round((score / total) * 100) : 0);
                        return { studentId: r.studentId, studentName: r.studentName || 'Student', score, total, pct };
                      })
                      .sort((a, b) => b.pct - a.pct)
                      .map((r, i) => ({ ...r, rank: i + 1 }))
                  : [];

                return (
                  <View>
                    <Text style={styles.sectionLabel}>Online Test Select Karo</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {uniqueOnlineTests.length === 0
                          ? <Text style={{ color: '#B0C4DC', fontSize: 13 }}>Koi online test nahi</Text>
                          : uniqueOnlineTests.map(t => (
                              <TouchableOpacity
                                key={t.id}
                                style={[styles.chip, selectedRankOnlineTest?.id === t.id && styles.chipActive]}
                                onPress={() => setSelectedRankOnlineTest(t)}>
                                <Text style={[styles.chipText, selectedRankOnlineTest?.id === t.id && styles.chipTextActive]}>{t.title}</Text>
                              </TouchableOpacity>
                            ))
                        }
                      </View>
                    </ScrollView>

                    {selectedRankOnlineTest && (
                      <>
                        <Text style={styles.sectionLabel}>Online Test Ranking</Text>
                        <View style={styles.rankCard}>
                          <View style={styles.rankHeader}>
                            <Text style={[styles.rankHeaderText, { width: 40 }]}>Rank</Text>
                            <Text style={[styles.rankHeaderText, { flex: 1 }]}>Student</Text>
                            <Text style={[styles.rankHeaderText, { width: 60, textAlign: 'center' }]}>Score</Text>
                            <Text style={[styles.rankHeaderText, { width: 50, textAlign: 'center' }]}>%</Text>
                          </View>
                          {onlineRankData.length === 0
                            ? <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#B0C4DC' }}>Koi data nahi</Text></View>
                            : onlineRankData.map((r, i) => {
                                const medal = r.rank === 1 ? '#D4A843' : r.rank === 2 ? '#9CA3AF' : r.rank === 3 ? '#C97B4B' : null;
                                return (
                                  <View key={r.studentId} style={[styles.rankRow, i < onlineRankData.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F0F4FA' }]}>
                                    <View style={{ width: 40, alignItems: 'center' }}>
                                      {medal ? <FontAwesome5 name="medal" size={16} color={medal} /> : <Text style={styles.rankNum}>{r.rank}</Text>}
                                    </View>
                                    <Text style={[styles.rankName, { flex: 1 }]}>{r.studentName}</Text>
                                    <Text style={{ width: 60, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#1B1464' }}>{r.score}/{r.total}</Text>
                                    <Text style={{ width: 50, textAlign: 'center', fontSize: 12, fontWeight: '800', color: r.pct >= 75 ? '#059669' : r.pct >= 50 ? '#D97706' : '#DC2626' }}>{r.pct}%</Text>
                                  </View>
                                );
                              })
                          }
                        </View>

                        <View style={styles.rankSummary}>
                          <View style={styles.rankSummaryItem}>
                            <Text style={styles.rankSummaryVal}>{onlineRankData.length}</Text>
                            <Text style={styles.rankSummaryLabel}>Total Students</Text>
                          </View>
                          <View style={styles.rankSummaryItem}>
                            <Text style={[styles.rankSummaryVal, { color: '#059669' }]}>{onlineRankData.filter(r => r.pct >= 75).length}</Text>
                            <Text style={styles.rankSummaryLabel}>75%+ Score</Text>
                          </View>
                          <View style={styles.rankSummaryItem}>
                            <Text style={[styles.rankSummaryVal, { color: '#D4A843' }]}>{onlineRankData[0]?.studentName?.split(' ')[0] || '—'}</Text>
                            <Text style={styles.rankSummaryLabel}>Top Student</Text>
                          </View>
                          <View style={styles.rankSummaryItem}>
                            <Text style={styles.rankSummaryVal}>{onlineRankData.length > 0 ? Math.round(onlineRankData.reduce((s, r) => s + r.pct, 0) / onlineRankData.length) : 0}%</Text>
                            <Text style={styles.rankSummaryLabel}>Class Avg</Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                );
              })()}

              {/* ── AI QUIZ RANKINGS ── */}
              {rankTab === 'quiz' && (() => {
                const batchStudents = filterByBatch(allTeacherStudents, rankBatchFilter);
                const batchStudentIds = batchStudents.map(s => s.id);
                const quizSubjects = ['All', ...new Set(quizHistory.filter(q => batchStudentIds.includes(q.uid) || batchStudentIds.includes(q.studentId)).map(q => q.subject).filter(Boolean))];

                const quizRankData = batchStudents.map(s => {
                  const sQuiz = quizHistory.filter(q =>
                    q.uid === s.id || q.studentId === s.id
                  ).filter(q => selectedRankSubject === 'All' || q.subject === selectedRankSubject);
                  const avg = sQuiz.length > 0
                    ? Math.round(sQuiz.reduce((sum, q) => sum + (q.percentage || Math.round(((q.score || 0) / (q.total || 1)) * 100)), 0) / sQuiz.length)
                    : 0;
                  const best = sQuiz.length > 0
                    ? Math.max(...sQuiz.map(q => q.percentage || Math.round(((q.score || 0) / (q.total || 1)) * 100)))
                    : 0;
                  return { studentId: s.id, studentName: s.studentName, totalQuizzes: sQuiz.length, avg, best };
                })
                .filter(r => r.totalQuizzes > 0)
                .sort((a, b) => b.avg - a.avg)
                .map((r, i) => ({ ...r, rank: i + 1 }));

                return (
                  <View>
                    <Text style={styles.sectionLabel}>Subject Filter</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {quizSubjects.map(sub => (
                          <TouchableOpacity
                            key={sub}
                            style={[styles.chip, selectedRankSubject === sub && styles.chipActive]}
                            onPress={() => setSelectedRankSubject(sub)}>
                            <Text style={[styles.chipText, selectedRankSubject === sub && styles.chipTextActive]}>{sub}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={styles.sectionLabel}>AI Quiz Rankings — Average Score</Text>
                    <View style={styles.rankCard}>
                      <View style={styles.rankHeader}>
                        <Text style={[styles.rankHeaderText, { width: 40 }]}>Rank</Text>
                        <Text style={[styles.rankHeaderText, { flex: 1 }]}>Student</Text>
                        <Text style={[styles.rankHeaderText, { width: 40, textAlign: 'center' }]}>Quiz</Text>
                        <Text style={[styles.rankHeaderText, { width: 50, textAlign: 'center' }]}>Avg%</Text>
                        <Text style={[styles.rankHeaderText, { width: 50, textAlign: 'center' }]}>Best%</Text>
                      </View>
                      {quizRankData.length === 0
                        ? <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#B0C4DC' }}>Koi quiz data nahi</Text></View>
                        : quizRankData.map((r, i) => {
                            const medal = r.rank === 1 ? '#D4A843' : r.rank === 2 ? '#9CA3AF' : r.rank === 3 ? '#C97B4B' : null;
                            return (
                              <View key={r.studentId} style={[styles.rankRow, i < quizRankData.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F0F4FA' }]}>
                                <View style={{ width: 40, alignItems: 'center' }}>
                                  {medal ? <FontAwesome5 name="medal" size={16} color={medal} /> : <Text style={styles.rankNum}>{r.rank}</Text>}
                                </View>
                                <Text style={[styles.rankName, { flex: 1 }]}>{r.studentName}</Text>
                                <Text style={{ width: 40, textAlign: 'center', fontSize: 12, color: '#6B7F99' }}>{r.totalQuizzes}</Text>
                                <Text style={{ width: 50, textAlign: 'center', fontSize: 12, fontWeight: '800', color: r.avg >= 75 ? '#059669' : r.avg >= 50 ? '#D97706' : '#DC2626' }}>{r.avg}%</Text>
                                <Text style={{ width: 50, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#D4A843' }}>{r.best}%</Text>
                              </View>
                            );
                          })
                      }
                    </View>

                    <View style={styles.rankSummary}>
                      <View style={styles.rankSummaryItem}>
                        <Text style={styles.rankSummaryVal}>{quizRankData.length}</Text>
                        <Text style={styles.rankSummaryLabel}>Active Students</Text>
                      </View>
                      <View style={styles.rankSummaryItem}>
                        <Text style={[styles.rankSummaryVal, { color: '#D4A843' }]}>{quizRankData[0]?.studentName?.split(' ')[0] || '—'}</Text>
                        <Text style={styles.rankSummaryLabel}>Top Student</Text>
                      </View>
                      <View style={styles.rankSummaryItem}>
                        <Text style={styles.rankSummaryVal}>{quizRankData.length > 0 ? Math.round(quizRankData.reduce((s, r) => s + r.avg, 0) / quizRankData.length) : 0}%</Text>
                        <Text style={styles.rankSummaryLabel}>Class Avg</Text>
                      </View>
                      <View style={styles.rankSummaryItem}>
                        <Text style={styles.rankSummaryVal}>{quizRankData.reduce((s, r) => s + r.totalQuizzes, 0)}</Text>
                        <Text style={styles.rankSummaryLabel}>Total Quizzes</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

            </Animated.View>
          )}

          {/* ═══ PROFILE ═══ */}
          {activeTab === 'profile' && (
            <Animated.View
              style={[
                styles.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              <Text style={styles.sectionLabel}>Teacher Profile</Text>
              <View style={styles.profileCard}>
                <View style={styles.profileTop}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{(teacher?.name || 'T').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{teacher?.name}</Text>
                    <Text style={styles.profileSubject}>{teacher?.subject}</Text>
                  </View>
                </View>

                {teacherCourses.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={styles.profileSectionTitle}>My Courses</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {teacherCourses.map(c => (
                        <View key={c.id} style={styles.courseChip}>
                          <FontAwesome5 name="chalkboard-teacher" size={11} color="#1B1464" />
                          <Text style={styles.courseChipText}>{c.title}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {[
                  ['Email', teacher?.email, 'envelope'],
                  ['Phone', teacher?.phone, 'phone'],
                  ['Experience', teacher?.experience, 'briefcase'],
                  ['Qualification', teacher?.qualification, 'graduation-cap'],
                  ['Classes', teacher?.classes, 'chalkboard'],
                ].filter(([, v]) => v).map(([label, val, icon]) => (
                  <View key={label} style={styles.profileRow}>
                    <View style={styles.profileRowIcon}>
                      <FontAwesome5 name={icon} size={13} color="#1B1464" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileRowLabel}>{label}</Text>
                      <Text style={styles.profileRowVal}>{val}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={async () => {
                await router.replace('/');
setTimeout(() => signOut(auth), 500);;
                router.replace('/');
              }}>
                <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                <Text style={styles.logoutBtnText}>Logout</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

        </ScrollView>

        {/* Bottom Tab Bar */}
        <View style={styles.bottomTabBar}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={styles.bottomTab}
              onPress={() => switchTab(tab.id)}>
              <View style={[styles.bottomTabIcon, activeTab === tab.id && styles.bottomTabIconActive]}>
                <FontAwesome5 name={tab.icon} size={16} color={activeTab === tab.id ? '#1B1464' : '#6B7F99'} />
              </View>
              <Text style={[styles.bottomTabLabel, activeTab === tab.id && styles.bottomTabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Teacher Notification Modal */}
        <Modal visible={showNotifModal} animationType="slide" onRequestClose={() => setShowNotifModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4FA' }} edges={['top']}>
            <View style={{ backgroundColor: '#1B1464', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
              <TouchableOpacity
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowNotifModal(false)}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff' }}>Notifications</Text>
                <Text style={{ fontSize: 12, color: '#C9A44E', marginTop: 2 }}>Admin se aaye messages</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{teacherNotifs.length} Total</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
              {teacherNotifs.length === 0
                ? <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
                    <Ionicons name="notifications-off-outline" size={48} color="#B0C4DC" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#6B7F99' }}>Koi notification nahi</Text>
                    <Text style={{ fontSize: 13, color: '#B0C4DC' }}>Admin ke notifications yahan dikhenge</Text>
                  </View>
                : teacherNotifs.map((n, i) => {
                    const notifTime = n.createdAt?.toDate?.();
                    const isNew = notifTime && notifTime.getTime() > (lastSeenNotif || 0);
                    const typeColors = {
                      holiday: { bg: '#ECFDF5', color: '#059669', icon: 'calendar' },
                      exam: { bg: '#EFF6FF', color: '#1B1464', icon: 'pencil-alt' },
                      urgent: { bg: '#FEF2F2', color: '#DC2626', icon: 'exclamation-circle' },
                      general: { bg: '#F5F3FF', color: '#7C3AED', icon: 'info-circle' },
                    };
                    const tc = typeColors[n.type] || typeColors.general;
                    return (
                      <View key={n.id} style={[{
                        backgroundColor: '#fff',
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 10,
                        elevation: 2,
                        borderLeftWidth: 4,
                        borderLeftColor: isNew ? '#C9A44E' : '#E8EFF8',
                      }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ backgroundColor: tc.bg, width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                              <FontAwesome5 name={tc.icon} size={14} color={tc.color} />
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: tc.color, textTransform: 'capitalize' }}>{n.type || 'general'}</Text>
                            {isNew && (
                              <View style={{ backgroundColor: '#C9A44E', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                                <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>NEW</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 11, color: '#B0C4DC' }}>
                            {notifTime?.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0B1826', lineHeight: 20, marginBottom: 6 }}>{n.message}</Text>
                        {n.sentBy && (
                          <Text style={{ fontSize: 11, color: '#6B7F99' }}>
                            Sent by: {n.sentBy}
                          </Text>
                        )}
                        {(n.scheduledDate || n.scheduledTime) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: '#F0F4FA', borderRadius: 8, padding: 8 }}>
                            <FontAwesome5 name="clock" size={11} color="#6B7F99" />
                            <Text style={{ fontSize: 11, color: '#6B7F99' }}>
                              {n.scheduledDate} {n.scheduledTime}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
              }
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Student Modal */}
        {selectedStudent && (
          <StudentDetailModal
            student={selectedStudent}
            attendance={attendance}
            examMarks={examMarks}
            quizHistory={quizHistory}
            onClose={() => setSelectedStudent(null)}
          />
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FA' },
  loadingText: { marginTop: 12, color: '#6B7F99', fontSize: 14 },
  header: { backgroundColor: '#1B1464', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#C9A44E', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1B1464', fontSize: 22, fontWeight: '900' },
  greeting: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  teacherName: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 2 },
  teacherSub: { fontSize: 12, color: '#C9A44E', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 8, alignItems: 'center', gap: 3 },
  statVal: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 9, color: '#6B7F99', textAlign: 'center' },
  tabScroll: { marginTop: 12, marginBottom: 4, maxHeight: 48, display: 'none' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#E8EFF8' },
  tabBtnActive: { backgroundColor: '#1B1464' },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: '#6B7F99' },
  tabBtnTextActive: { color: '#fff' },
  tabContent: { flex: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#6B7F99', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#E8EFF8', borderWidth: 1.5, borderColor: '#E8EFF8' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#1B1464' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#6B7F99' },
  chipTextActive: { color: '#1B1464' },
  studentCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  studentAvatar: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 18, fontWeight: '900', color: '#1B1464' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '700', color: '#0B1826' },
  studentMeta: { fontSize: 11, color: '#6B7F99', marginTop: 2 },
  attPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  attPillText: { fontSize: 12, fontWeight: '800' },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#1B1464', marginBottom: 8, marginTop: 4 },
  subLabel: { fontSize: 11, fontWeight: '600', color: '#6B7F99', marginBottom: 4 },
  input: { backgroundColor: '#F0F4FA', borderRadius: 12, padding: 14, fontSize: 14, color: '#0B1826', borderWidth: 1.5, borderColor: '#E0E8F4', marginBottom: 4 },
  textArea: { backgroundColor: '#F0F4FA', borderRadius: 12, padding: 14, fontSize: 14, color: '#0B1826', borderWidth: 1.5, borderColor: '#E0E8F4', marginBottom: 12, minHeight: 100, textAlignVertical: 'top' },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#E8EFF8' },
  typeChipActive: { backgroundColor: '#1B1464' },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#6B7F99' },
  typeChipTextActive: { color: '#fff' },
  actionBtn: { backgroundColor: '#1B1464', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  leaveCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, elevation: 1 },
  leaveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leaveDateText: { fontSize: 13, fontWeight: '700', color: '#1B1464' },
  leaveStatusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  leaveStatusText: { fontSize: 11, fontWeight: '700' },
  leaveReason: { fontSize: 13, color: '#6B7F99', lineHeight: 18 },
  profileCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, elevation: 2, marginBottom: 16 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E8EFF8' },
  profileAvatar: { width: 56, height: 56, borderRadius: 17, backgroundColor: '#1B1464', alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  profileName: { fontSize: 18, fontWeight: '800', color: '#0B1826' },
  profileSubject: { fontSize: 13, color: '#6B7F99', marginTop: 2 },
  profileSectionTitle: { fontSize: 12, fontWeight: '800', color: '#6B7F99', marginBottom: 8, textTransform: 'uppercase' },
  courseChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  courseChipText: { fontSize: 12, fontWeight: '700', color: '#1B1464' },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F4FA' },
  profileRowIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  profileRowLabel: { fontSize: 11, color: '#6B7F99', fontWeight: '600' },
  profileRowVal: { fontSize: 13, fontWeight: '700', color: '#0B1826', marginTop: 2 },
  logoutBtn: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#FECACA' },
  logoutBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '800' },
  emptyBox: { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#6B7F99' },
  rankSubTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E8EFF8' },
  rankSubTabActive: { backgroundColor: '#1B1464' },
  rankSubTabText: { fontSize: 11, fontWeight: '700', color: '#6B7F99' },
  rankSubTabTextActive: { color: '#fff' },
  rankCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 2, marginBottom: 14 },
  rankHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F8FF', paddingHorizontal: 12, paddingVertical: 10 },
  rankHeaderText: { fontSize: 10, fontWeight: '800', color: '#6B7F99', textTransform: 'uppercase' },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  rankNum: { fontSize: 14, fontWeight: '800', color: '#6B7F99' },
  rankName: { fontSize: 13, fontWeight: '700', color: '#0B1826' },
  rankSubMark: { fontSize: 10, color: '#6B7F99', backgroundColor: '#F0F4FA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: '600' },
  rankSummary: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 16, elevation: 1 },
  rankSummaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  rankSummaryVal: { fontSize: 16, fontWeight: '900', color: '#1B1464' },
  rankSummaryLabel: { fontSize: 9, color: '#6B7F99', fontWeight: '600', textAlign: 'center' },
  cancelEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FECACA' },
  cancelEditBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 12 },
  headerBellBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerBellBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  headerBellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  bottomTabBar: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8EFF8',
    elevation: 12,
  },
  bottomTab: { flex: 1, alignItems: 'center', gap: 3 },
  bottomTabIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bottomTabIconActive: { backgroundColor: '#EFF6FF' },
  bottomTabLabel: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  bottomTabLabelActive: { color: '#1B1464', fontWeight: '800' },
  sentNotifCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1, borderLeftWidth: 3, borderLeftColor: '#1B1464' },
  sentNotifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sentNotifTime: { fontSize: 11, color: '#B0C4DC' },
  sentNotifMsg: { fontSize: 13, fontWeight: '700', color: '#0B1826', marginBottom: 4 },
  sentNotifBatch: { fontSize: 11, color: '#6B7F99', marginBottom: 8 },
  sentNotifActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#1B1464' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
});

const modal = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FA' },
  header: { backgroundColor: '#1B1464', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#C9A44E', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1B1464', fontSize: 18, fontWeight: '900' },
  name: { fontSize: 17, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 11, color: '#C9A44E', marginTop: 2 },
  attBar: { flexDirection: 'row', backgroundColor: '#1B1464', paddingHorizontal: 20, paddingBottom: 16, justifyContent: 'space-around' },
  attStat: { alignItems: 'center' },
  attStatVal: { fontSize: 20, fontWeight: '900' },
  attStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E8EFF8' },
  tabChipActive: { backgroundColor: '#1B1464' },
  tabChipText: { fontSize: 11, fontWeight: '700', color: '#6B7F99' },
  tabChipTextActive: { color: '#fff' },
  tabContent: { flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, alignItems: 'flex-start' },
  infoLabel: { fontSize: 12, color: '#6B7F99', fontWeight: '600', flex: 1 },
  infoVal: { fontSize: 13, fontWeight: '700', color: '#0B1826', flex: 2, textAlign: 'right' },
  markCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1 },
  markHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  markTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0B1826' },
  markDateText: { fontSize: 11, color: '#B0C4DC' },
  marksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  markSubjectCard: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 80 },
  markSubjectName: { fontSize: 11, color: '#6B7F99', fontWeight: '600' },
  markSubjectScore: { fontSize: 18, fontWeight: '900', color: '#1B1464', marginTop: 2 },
  quizCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  quizSubject: { fontSize: 14, fontWeight: '700', color: '#0B1826' },
  quizChip: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  quizChipText: { fontSize: 10, fontWeight: '700', color: '#1B1464' },
  quizDate: { fontSize: 11, color: '#B0C4DC', marginTop: 4 },
  quizScore: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  quizScorePct: { fontSize: 16, fontWeight: '900' },
  quizScoreRaw: { fontSize: 10, color: '#6B7F99', marginTop: 2 },
  doubtCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1 },
  doubtHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  doubtBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  doubtBadgeText: { fontSize: 11, fontWeight: '700', color: '#1B1464' },
  doubtDate: { fontSize: 11, color: '#B0C4DC' },
  doubtQ: { fontSize: 13, fontWeight: '700', color: '#0B1826', marginBottom: 6 },
  doubtA: { fontSize: 12, color: '#6B7F99', lineHeight: 18 },
});

const cal = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 16, fontWeight: '800' },
  stats: { flexDirection: 'row', backgroundColor: '#F0F4FA', borderRadius: 12, padding: 12, marginBottom: 14, justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, color: '#6B7F99', marginTop: 2 },
  dayRow: { flexDirection: 'row', marginBottom: 6 },
  dayName: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#6B7F99' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 4 },
  todayCell: { borderWidth: 2, borderColor: '#1B1464' },
  cellText: { fontSize: 11, fontWeight: '700' },
  todayText: { color: '#1B1464' },
  dotP: { fontSize: 7, color: '#059669', fontWeight: '900' },
  dotA: { fontSize: 7, color: '#DC2626', fontWeight: '900' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 10, fontWeight: '600' },
});