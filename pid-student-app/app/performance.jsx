import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Animated, ScrollView, StyleSheet,
    Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { useUnreadCount } from '../hooks/useUnreadCount';

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

// ─── Medal Colors ───
function getMedalColor(rank) {
  if (rank === 1) return '#D4A843';
  if (rank === 2) return '#9CA3AF';
  if (rank === 3) return '#C97B4B';
  return null;
}

function getPctColor(pct) {
  if (pct >= 75) return '#059669';
  if (pct >= 50) return '#D97706';
  return '#DC2626';
}

function getGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return 'D';
}

export default function Performance() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('exams');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Data
  const [examMarks, setExamMarks] = useState([]);
  const [allExamMarks, setAllExamMarks] = useState([]);
  const [onlineTests, setOnlineTests] = useState([]);
  const [allOtResults, setAllOtResults] = useState([]);
  const [allClassOtResults, setAllClassOtResults] = useState([]);
  const [selectedOnlineTest, setSelectedOnlineTest] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);

  // Filters
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [quizSubjectFilter, setQuizSubjectFilter] = useState('All');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { router.replace('/'); return; }

      // Student fetch
      onSnapshot(collection(db, 'students'), s => {
        const found = s.docs.find(d =>
          d.data().studentEmail?.toLowerCase() === user.email.toLowerCase()
        );
        if (!found) { setLoading(false); return; }
        const st = { id: found.id, ...found.data() };
        setStudent(st);

        // My exam marks
        onSnapshot(
          query(collection(db, 'exam_marks'), where('studentId', '==', found.id)),
          snap => setExamMarks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // All class exam marks (same class/board/medium)
        onSnapshot(
          query(
            collection(db, 'exam_marks'),
            where('studentClass', '==', st.class || st.presentClass || '')
          ),
          snap => setAllExamMarks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // Online tests
        onSnapshot(
          query(collection(db, 'online_tests'), where('isActive', '==', true)),
          snap => setOnlineTests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // All quiz history for student
        onSnapshot(
          query(
            collection(db, 'quiz_history'),
            where('uid', '==', user.uid),
            orderBy('createdAt', 'desc')
          ),
          snap => { setQuizHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
          () => setLoading(false)
        );

        // Online test results — student ke apne
        onSnapshot(
          query(
            collection(db, 'quiz_history'),
            where('studentId', '==', found.id),
            orderBy('createdAt', 'desc')
          ),
          snap => setAllOtResults(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
          () => {}
        );

        // Online test results — poori class ke (rank ke liye)
        onSnapshot(
          query(
            collection(db, 'quiz_history'),
            where('studentClass', '==', st.class || st.presentClass || '')
          ),
          snap => setAllClassOtResults(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
          () => {}
        );
      });
    });
    return unsub;
  }, []);

  // ─── Exam Rankings ───
  function getExamRankings(examId) {
    if (!examId) return [];
    const allForExam = allExamMarks.filter(m => m.examId === examId);
    const rows = allForExam.map(m => {
      const total = m.totalMarks || Object.values(m.marks || {}).reduce((s, v) => s + Number(v || 0), 0);
      const maxMarks = m.maxMarks || 300;
      const pct = maxMarks > 0 ? Math.round((total / maxMarks) * 100) : 0;
      return {
        studentId: m.studentId,
        studentName: m.studentName || 'Student',
        marks: m.marks || {},
        total,
        pct,
        isMe: m.studentId === student?.id,
      };
    });
    rows.sort((a, b) => b.pct - a.pct || b.total - a.total);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  // ─── Unique Exams ───
  const myExamIds = [...new Set(examMarks.map(m => m.examId))];
  const myExams = myExamIds.map(id => {
    const m = examMarks.find(e => e.examId === id);
    return { id, title: m?.examTitle || 'Exam' };
  });

  // ─── Quiz Stats ───
  const quizSubjects = ['All', ...new Set(quizHistory.map(q => q.subject).filter(Boolean))];
  const filteredQuiz = quizSubjectFilter === 'All'
    ? quizHistory
    : quizHistory.filter(q => q.subject === quizSubjectFilter);

  const avgPct = filteredQuiz.length > 0
    ? Math.round(filteredQuiz.reduce((s, q) => s + (q.percentage || Math.round(((q.score || 0) / (q.total || 1)) * 100)), 0) / filteredQuiz.length)
    : 0;
  const bestPct = filteredQuiz.length > 0
    ? Math.max(...filteredQuiz.map(q => q.percentage || Math.round(((q.score || 0) / (q.total || 1)) * 100)))
    : 0;

  // Online test unique list — jo student ne diye hain
  const myOnlineTestIds = [...new Set(allOtResults.map(r => r.examId || r.testId).filter(Boolean))];
  const myOnlineTests = myOnlineTestIds.map(id => {
    const r = allOtResults.find(r => (r.examId || r.testId) === id);
    return { id, title: r?.examTitle || r?.title || onlineTests.find(t => t.id === id)?.title || 'Test' };
  });

  // Online test ranking function
  function getOnlineTestRankings(testId) {
    if (!testId) return [];
    const allForTest = allClassOtResults.filter(r => (r.examId || r.testId) === testId);
    const rows = allForTest.map(r => {
      const score = r.correctAnswers || r.score || 0;
      const total = r.totalQuestions || r.total || 0;
      const pct = r.percentage || (total > 0 ? Math.round((score / total) * 100) : 0);
      return {
        studentId: r.studentId,
        studentName: r.studentName || 'Student',
        score, total, pct,
        isMe: r.studentId === student?.id,
      };
    });
    rows.sort((a, b) => b.pct - a.pct || b.score - a.score);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  const examRankings = selectedExam ? getExamRankings(selectedExam.id) : [];
  const onlineTestRankings = selectedOnlineTest ? getOnlineTestRankings(selectedOnlineTest.id) : [];
  const myOnlineRank = onlineTestRankings.find(r => r.isMe);
  const myOnlineResult = selectedOnlineTest ? allOtResults.find(r => (r.examId || r.testId) === selectedOnlineTest.id) : null;
  const myRank = examRankings.find(r => r.isMe);
  const myExamDetail = selectedExam ? examMarks.find(m => m.examId === selectedExam.id) : null;

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
            <FontAwesome5 name="chart-line" size={18} color="#C9A44E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Performance</Text>
            <Text style={styles.headerSub}>Apni rank aur marks dekho</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {[
            { id: 'exams', label: 'Class Tests', icon: 'file-alt' },
            { id: 'online', label: 'Online Tests', icon: 'laptop' },
            { id: 'quiz', label: 'AI Quiz', icon: 'brain' },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
              onPress={() => switchTab(t.id)}>
              <FontAwesome5 name={t.icon} size={13} color={activeTab === t.id ? '#fff' : '#6B7F99'} />
              <Text style={[styles.tabBtnText, activeTab === t.id && styles.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>

          {/* ═══ CLASS TESTS TAB ═══ */}
          {activeTab === 'exams' && (
            <Animated.View
              style={[
                styles.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              {/* Exam Selector */}
              <Text style={styles.sectionLabel}>Exam Select Karo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
                {myExams.length === 0
                  ? <View style={styles.emptyBox}>
                      <FontAwesome5 name="file-alt" size={32} color="#B0C4DC" />
                      <Text style={styles.emptyTitle}>Koi exam result nahi mila</Text>
                      <Text style={styles.emptySub}>Jab teacher marks submit karega, yahan dikhega</Text>
                    </View>
                  : myExams.map((ex, idx) => (
                      <TouchableOpacity
                        key={`${ex.id || 'exam'}-${idx}`}
                        style={[styles.examChip, selectedExam?.id === ex.id && styles.examChipActive]}
                        onPress={() => setSelectedExam(ex)}>
                        <Text style={[styles.examChipText, selectedExam?.id === ex.id && styles.examChipTextActive]}>
                          {ex.title}
                        </Text>
                      </TouchableOpacity>
                    ))
                }
              </ScrollView>

              {selectedExam && myExamDetail && (
                <>
                  {/* My Score Card */}
                  <View style={styles.myScoreCard}>
                    <View style={styles.myScoreTop}>
                      <View>
                        <Text style={styles.myScoreTitle}>{selectedExam.title}</Text>
                        <Text style={styles.myScoreSub}>Mera Result</Text>
                      </View>
                      <View style={styles.myRankBadge}>
                        {myRank && getMedalColor(myRank.rank) ? (
                          <FontAwesome5 name="medal" size={20} color={getMedalColor(myRank.rank)} />
                        ) : (
                          <Text style={styles.myRankNum}>#{myRank?.rank || '—'}</Text>
                        )}
                        <Text style={styles.myRankLabel}>Rank</Text>
                      </View>
                    </View>

                    {/* Subject Marks */}
                    <View style={styles.subjectMarksGrid}>
                      {Object.entries(myExamDetail.marks || {}).map(([sub, marks]) => (
                        <View key={sub} style={styles.subjectMarkCard}>
                          <Text style={styles.subjectMarkName}>{sub}</Text>
                          <Text style={styles.subjectMarkVal}>{marks}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Total + % */}
                    <View style={styles.myScoreFooter}>
                      <View style={styles.myScoreStat}>
                        <Text style={styles.myScoreStatVal}>{myExamDetail.totalMarks || Object.values(myExamDetail.marks || {}).reduce((s, v) => s + Number(v || 0), 0)}</Text>
                        <Text style={styles.myScoreStatLabel}>Total Marks</Text>
                      </View>
                      <View style={styles.myScoreStat}>
                        <Text style={[styles.myScoreStatVal, { color: getPctColor(myRank?.pct || 0) }]}>{myRank?.pct || 0}%</Text>
                        <Text style={styles.myScoreStatLabel}>Percentage</Text>
                      </View>
                      <View style={styles.myScoreStat}>
                        <Text style={[styles.myScoreStatVal, { color: getPctColor(myRank?.pct || 0) }]}>{getGrade(myRank?.pct || 0)}</Text>
                        <Text style={styles.myScoreStatLabel}>Grade</Text>
                      </View>
                    </View>
                  </View>

                  {/* Class Leaderboard */}
                  <Text style={styles.sectionLabel}>Class Leaderboard</Text>
                  <View style={styles.leaderboardCard}>
                    {/* Header */}
                    <View style={styles.lbHeader}>
                      <Text style={[styles.lbHeaderText, { width: 40 }]}>Rank</Text>
                      <Text style={[styles.lbHeaderText, { flex: 1 }]}>Student</Text>
                      <Text style={[styles.lbHeaderText, { width: 50, textAlign: 'center' }]}>%</Text>
                      <Text style={[styles.lbHeaderText, { width: 40, textAlign: 'center' }]}>Grade</Text>
                    </View>

                    {examRankings.map((r, i) => {
                      const medal = getMedalColor(r.rank);
                      const isMe = r.isMe;
                      return (
                        <View
                          key={`${r.studentId || 'rank'}-${i}`}
                          style={[
                            styles.lbRow,
                            isMe && styles.lbRowMe,
                            i < examRankings.length - 1 && styles.lbRowBorder
                          ]}>
                          {/* Rank */}
                          <View style={[styles.lbRankWrap, { width: 40 }]}>
                            {medal
                              ? <FontAwesome5 name="medal" size={16} color={medal} />
                              : <Text style={styles.lbRankNum}>{r.rank}</Text>
                            }
                          </View>

                          {/* Name */}
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.lbName, isMe && styles.lbNameMe]}>
                              {isMe ? 'Aap (Me)' : r.studentName}
                            </Text>
                            {/* Marks — sirf apne dikhao */}
                            {isMe && (
                              <View style={styles.lbSubjectRow}>
                                {Object.entries(r.marks).map(([sub, val]) => (
                                  <Text key={sub} style={styles.lbSubjectMark}>{sub}: {val}</Text>
                                ))}
                              </View>
                            )}
                          </View>

                          {/* % */}
                          <View style={{ width: 50, alignItems: 'center' }}>
                            <Text style={[styles.lbPct, { color: getPctColor(r.pct) }]}>{r.pct}%</Text>
                          </View>

                          {/* Grade */}
                          <View style={{ width: 40, alignItems: 'center' }}>
                            <Text style={[styles.lbGrade, { color: getPctColor(r.pct) }]}>{getGrade(r.pct)}</Text>
                          </View>
                        </View>
                      );
                    })}

                    {examRankings.length === 0 && (
                      <View style={styles.lbEmpty}>
                        <Text style={styles.lbEmptyText}>Sirf aapka result abhi available hai</Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {!selectedExam && myExams.length > 0 && (
                <View style={styles.selectHint}>
                  <FontAwesome5 name="arrow-up" size={16} color="#B0C4DC" />
                  <Text style={styles.selectHintText}>Upar se exam select karo</Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* ═══ ONLINE TESTS TAB ═══ */}
          {activeTab === 'online' && (
            <Animated.View
              style={[
                styles.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              {/* Test Selector */}
              <Text style={styles.sectionLabel}>Online Test Select Karo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
                {myOnlineTests.length === 0
                  ? <View style={styles.emptyBox}>
                      <FontAwesome5 name="laptop" size={32} color="#B0C4DC" />
                      <Text style={styles.emptyTitle}>Koi online test nahi diya</Text>
                      <Text style={styles.emptySub}>Online Tests section mein test do</Text>
                    </View>
                  : myOnlineTests.map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.examChip, selectedOnlineTest?.id === t.id && styles.examChipActive]}
                        onPress={() => setSelectedOnlineTest(t)}>
                        <Text style={[styles.examChipText, selectedOnlineTest?.id === t.id && styles.examChipTextActive]}>
                          {t.title}
                        </Text>
                      </TouchableOpacity>
                    ))
                }
              </ScrollView>

              {selectedOnlineTest && myOnlineResult && (
                <>
                  {/* My Score Card */}
                  <View style={styles.myScoreCard}>
                    <View style={styles.myScoreTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.myScoreTitle}>{selectedOnlineTest.title}</Text>
                        <Text style={styles.myScoreSub}>Mera Result</Text>
                      </View>
                      <View style={styles.myRankBadge}>
                        {myOnlineRank && getMedalColor(myOnlineRank.rank)
                          ? <FontAwesome5 name="medal" size={20} color={getMedalColor(myOnlineRank.rank)} />
                          : <Text style={styles.myRankNum}>#{myOnlineRank?.rank || '—'}</Text>
                        }
                        <Text style={styles.myRankLabel}>Rank</Text>
                      </View>
                    </View>

                    {/* Score Stats */}
                    <View style={styles.myScoreFooter}>
                      <View style={styles.myScoreStat}>
                        <Text style={styles.myScoreStatVal}>
                          {myOnlineResult.correctAnswers || myOnlineResult.score || 0}/{myOnlineResult.totalQuestions || myOnlineResult.total || 0}
                        </Text>
                        <Text style={styles.myScoreStatLabel}>Score</Text>
                      </View>
                      <View style={styles.myScoreStat}>
                        <Text style={[styles.myScoreStatVal, { color: getPctColor(myOnlineRank?.pct || 0) }]}>
                          {myOnlineRank?.pct || 0}%
                        </Text>
                        <Text style={styles.myScoreStatLabel}>Percentage</Text>
                      </View>
                      <View style={styles.myScoreStat}>
                        <Text style={[styles.myScoreStatVal, { color: getPctColor(myOnlineRank?.pct || 0) }]}>
                          {getGrade(myOnlineRank?.pct || 0)}
                        </Text>
                        <Text style={styles.myScoreStatLabel}>Grade</Text>
                      </View>
                    </View>
                  </View>

                  {/* Class Leaderboard */}
                  <Text style={styles.sectionLabel}>Class Leaderboard</Text>
                  <View style={styles.leaderboardCard}>
                    <View style={styles.lbHeader}>
                      <Text style={[styles.lbHeaderText, { width: 40 }]}>Rank</Text>
                      <Text style={[styles.lbHeaderText, { flex: 1 }]}>Student</Text>
                      <Text style={[styles.lbHeaderText, { width: 60, textAlign: 'center' }]}>Score</Text>
                      <Text style={[styles.lbHeaderText, { width: 50, textAlign: 'center' }]}>%</Text>
                      <Text style={[styles.lbHeaderText, { width: 40, textAlign: 'center' }]}>Grade</Text>
                    </View>

                    {onlineTestRankings.length === 0
                      ? <View style={styles.lbEmpty}>
                          <Text style={styles.lbEmptyText}>Sirf aapka result abhi available hai</Text>
                        </View>
                      : onlineTestRankings.map((r, i) => {
                          const medal = getMedalColor(r.rank);
                          const isMe = r.isMe;
                          return (
                            <View
                              key={`${r.studentId || 'online'}-${i}`}
                              style={[styles.lbRow, isMe && styles.lbRowMe, i < onlineTestRankings.length - 1 && styles.lbRowBorder]}>
                              <View style={[styles.lbRankWrap, { width: 40 }]}>
                                {medal
                                  ? <FontAwesome5 name="medal" size={16} color={medal} />
                                  : <Text style={styles.lbRankNum}>{r.rank}</Text>
                                }
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.lbName, isMe && styles.lbNameMe]}>
                                  {isMe ? 'Aap (Me)' : r.studentName}
                                </Text>
                              </View>
                              <View style={{ width: 60, alignItems: 'center' }}>
                                <Text style={[styles.lbPct, { color: '#1B1464', fontSize: 12 }]}>
                                  {r.score}/{r.total}
                                </Text>
                              </View>
                              <View style={{ width: 50, alignItems: 'center' }}>
                                <Text style={[styles.lbPct, { color: getPctColor(r.pct) }]}>{r.pct}%</Text>
                              </View>
                              <View style={{ width: 40, alignItems: 'center' }}>
                                <Text style={[styles.lbGrade, { color: getPctColor(r.pct) }]}>{getGrade(r.pct)}</Text>
                              </View>
                            </View>
                          );
                        })
                    }
                  </View>
                </>
              )}

              {!selectedOnlineTest && myOnlineTests.length > 0 && (
                <View style={styles.selectHint}>
                  <FontAwesome5 name="arrow-up" size={16} color="#B0C4DC" />
                  <Text style={styles.selectHintText}>Upar se test select karo</Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* ═══ AI QUIZ TAB ═══ */}
          {activeTab === 'quiz' && (
            <Animated.View
              style={[
                styles.tabContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}>
              {/* Stats Cards */}
              <View style={styles.quizStatsRow}>
                {[
                  { label: 'Total Quizzes', val: filteredQuiz.length, icon: 'question-circle', color: '#1B1464', bg: '#EFF6FF' },
                  { label: 'Average %', val: `${avgPct}%`, icon: 'chart-bar', color: getPctColor(avgPct), bg: getPctColor(avgPct) === '#059669' ? '#ECFDF5' : getPctColor(avgPct) === '#D97706' ? '#FFF7ED' : '#FEF2F2' },
                  { label: 'Best Score', val: `${bestPct}%`, icon: 'trophy', color: '#D4A843', bg: '#FFFBEB' },
                ].map((s, i) => (
                  <View key={i} style={[styles.quizStatCard, { backgroundColor: s.bg }]}>
                    <FontAwesome5 name={s.icon} size={16} color={s.color} />
                    <Text style={[styles.quizStatVal, { color: s.color }]}>{s.val}</Text>
                    <Text style={styles.quizStatLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>

              {/* Subject Filter */}
              <Text style={styles.sectionLabel}>Subject Filter</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
                {quizSubjects.map(sub => (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.examChip, quizSubjectFilter === sub && styles.examChipActive]}
                    onPress={() => setQuizSubjectFilter(sub)}>
                    <Text style={[styles.examChipText, quizSubjectFilter === sub && styles.examChipTextActive]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Quiz History List */}
              <Text style={styles.sectionLabel}>Quiz History</Text>
              {filteredQuiz.length === 0
                ? <View style={styles.emptyBox}>
                    <FontAwesome5 name="brain" size={32} color="#B0C4DC" />
                    <Text style={styles.emptyTitle}>Koi quiz history nahi</Text>
                    <Text style={styles.emptySub}>AI Quiz section mein quiz do</Text>
                  </View>
                : filteredQuiz.map((q, i) => {
                    const pct = q.percentage || Math.round(((q.score || 0) / (q.total || 1)) * 100);
                    return (
                      <View key={`${q.id || 'quiz'}-${i}`} style={styles.quizHistCard}>
                        <View style={[styles.quizHistScore, { backgroundColor: getPctColor(pct) + '15' }]}>
                          <Text style={[styles.quizHistScorePct, { color: getPctColor(pct) }]}>{pct}%</Text>
                          <Text style={[styles.quizHistGrade, { color: getPctColor(pct) }]}>{getGrade(pct)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.quizHistSubject}>{q.subject}</Text>
                          <View style={styles.quizHistMeta}>
                            {q.chapter && (
                              <View style={styles.metaChip}>
                                <Text style={styles.metaChipText}>{q.chapter}</Text>
                              </View>
                            )}
                            {q.difficulty && (
                              <View style={[styles.metaChip, { backgroundColor: '#FFF7ED' }]}>
                                <Text style={[styles.metaChipText, { color: '#D97706' }]}>{q.difficulty}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.quizHistScore2}>{q.score}/{q.total} correct</Text>
                          <Text style={styles.quizHistDate}>
                            {q.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })
              }
            </Animated.View>
          )}

        </ScrollView>

        <BottomNav active="performance" />
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

  // Tabs
  tabRow: { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 8 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: '#E8EFF8' },
  tabBtnActive: { backgroundColor: '#1B1464' },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7F99' },
  tabBtnTextActive: { color: '#fff' },

  // Section Label
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#6B7F99', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  // Exam Chips
  examChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8EFF8' },
  examChipActive: { backgroundColor: '#1B1464', borderColor: '#1B1464' },
  examChipText: { fontSize: 12, fontWeight: '700', color: '#6B7F99' },
  examChipTextActive: { color: '#fff' },
  tabContent: { flex: 1 },

  // My Score Card
  myScoreCard: { backgroundColor: '#1B1464', borderRadius: 20, padding: 16, marginBottom: 16 },
  myScoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  myScoreTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
  myScoreSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  myRankBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10 },
  myRankNum: { fontSize: 20, fontWeight: '900', color: '#C9A44E' },
  myRankLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  subjectMarksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  subjectMarkCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 80 },
  subjectMarkName: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  subjectMarkVal: { fontSize: 20, fontWeight: '900', color: '#C9A44E', marginTop: 2 },
  myScoreFooter: { flexDirection: 'row', gap: 8 },
  myScoreStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10, alignItems: 'center' },
  myScoreStatVal: { fontSize: 18, fontWeight: '900', color: '#fff' },
  myScoreStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '600' },

  // Leaderboard
  leaderboardCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 2, marginBottom: 16 },
  lbHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F8FF', paddingHorizontal: 14, paddingVertical: 10 },
  lbHeaderText: { fontSize: 10, fontWeight: '800', color: '#6B7F99', textTransform: 'uppercase' },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  lbRowMe: { backgroundColor: '#EFF6FF' },
  lbRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F4FA' },
  lbRankWrap: { alignItems: 'center', justifyContent: 'center' },
  lbRankNum: { fontSize: 14, fontWeight: '800', color: '#6B7F99' },
  lbName: { fontSize: 13, fontWeight: '700', color: '#0B1826' },
  lbNameMe: { color: '#1B1464', fontWeight: '900' },
  lbSubjectRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 3 },
  lbSubjectMark: { fontSize: 10, color: '#6B7F99', fontWeight: '600', backgroundColor: '#F0F4FA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  lbPct: { fontSize: 13, fontWeight: '800' },
  lbGrade: { fontSize: 12, fontWeight: '800' },
  lbEmpty: { padding: 20, alignItems: 'center' },
  lbEmptyText: { fontSize: 12, color: '#B0C4DC' },

  // Quiz Stats
  quizStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quizStatCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 6 },
  quizStatVal: { fontSize: 18, fontWeight: '900' },
  quizStatLabel: { fontSize: 9, color: '#6B7F99', fontWeight: '600', textAlign: 'center' },

  // Quiz History
  quizHistCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'flex-start', elevation: 1 },
  quizHistScore: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quizHistScorePct: { fontSize: 16, fontWeight: '900' },
  quizHistGrade: { fontSize: 11, fontWeight: '700' },
  quizHistSubject: { fontSize: 14, fontWeight: '700', color: '#0B1826', marginBottom: 4 },
  quizHistMeta: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  metaChip: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  metaChipText: { fontSize: 10, fontWeight: '700', color: '#1B1464' },
  quizHistScore2: { fontSize: 12, color: '#6B7F99', fontWeight: '600', marginBottom: 2 },
  quizHistDate: { fontSize: 11, color: '#B0C4DC' },

  // Empty
  emptyBox: { alignItems: 'center', marginTop: 40, gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#6B7F99' },
  emptySub: { fontSize: 12, color: '#B0C4DC', textAlign: 'center' },

  // Select Hint
  selectHint: { alignItems: 'center', marginTop: 40, gap: 8 },
  selectHintText: { fontSize: 14, color: '#B0C4DC', fontWeight: '600' },

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