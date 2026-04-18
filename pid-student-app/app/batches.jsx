import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { useUnreadCount } from '../hooks/useUnreadCount';

// ─── Contact Numbers ───
const CONTACT = {
  temlal: { name: 'Mr. Temlal Patel', phone: '8319002877', whatsapp: '918319002877' },
};

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
          <TouchableOpacity key={tab.id} style={navStyles.tab} onPress={() => router.push('/' + tab.id)}>
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
            <Text style={[navStyles.tabLabel, isActive && navStyles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Contact Modal ───
function ContactModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.contactModal}>
          <View style={styles.contactModalHeader}>
            <Text style={styles.contactModalTitle}>📞 Humse Sampark Karo</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7F99" />
            </TouchableOpacity>
          </View>
          <Text style={styles.contactModalSub}>Admission ya enquiry ke liye directly contact karo</Text>

          {Object.values(CONTACT).map((c, i) => (
            <View key={i} style={styles.contactPersonCard}>
              <View style={styles.contactPersonInfo}>
                <View style={styles.contactAvatar}>
                  <FontAwesome5 name="user-tie" size={18} color="#1B1464" />
                </View>
                <View>
                  <Text style={styles.contactPersonName}>{c.name}</Text>
                  <Text style={styles.contactPersonPhone}>{c.phone}</Text>
                </View>
              </View>
              <View style={styles.contactBtns}>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                  <Ionicons name="call" size={16} color="#fff" />
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.whatsappBtn}
                  onPress={() => Linking.openURL(`https://wa.me/${c.whatsapp}?text=Namaste, mujhe PID institute ke courses ke baare mein jaankari chahiye.`)}>
                  <FontAwesome5 name="whatsapp" size={16} color="#fff" />
                  <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.contactCloseFullBtn} onPress={onClose}>
            <Text style={styles.contactCloseFullBtnText}>Band Karo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Course Detail Modal ───
function CourseDetailModal({ course, visible, onClose, isEnrolled }) {
  if (!course) return null;

  const subjectIcons = {
    'Physics': { icon: 'atom', color: '#7C3AED' },
    'Chemistry': { icon: 'flask', color: '#059669' },
    'Maths': { icon: 'square-root-alt', color: '#D97706' },
    'Mathematics': { icon: 'square-root-alt', color: '#D97706' },
    'Biology': { icon: 'leaf', color: '#16A34A' },
    'English': { icon: 'book-open', color: '#0284C7' },
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.courseDetailModal}>

          {/* Header */}
          <View style={styles.courseDetailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.courseDetailTitle}>{course.title}</Text>
              {course.tag && (
                <View style={styles.courseTag}>
                  <Text style={styles.courseTagText}>{course.tag}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

            {/* Description */}
            {course.desc && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>📋 Course Ke Baare Mein</Text>
                <Text style={styles.detailDesc}>{course.desc}</Text>
              </View>
            )}

            {/* Duration */}
            {course.duration && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>📅 Course Duration</Text>
                <View style={styles.durationBox}>
                  <FontAwesome5 name="clock" size={14} color="#C9A44E" />
                  <Text style={styles.durationText}>{course.duration}</Text>
                </View>
              </View>
            )}

            {/* Subjects */}
            {course.subjects && course.subjects.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>📚 Subjects</Text>
                <View style={styles.subjectsRow}>
                  {course.subjects.map((sub, i) => {
                    const si = subjectIcons[sub] || { icon: 'book', color: '#1B1464' };
                    return (
                      <View key={i} style={styles.subjectChip}>
                        <FontAwesome5 name={si.icon} size={12} color={si.color} />
                        <Text style={[styles.subjectChipText, { color: si.color }]}>{sub}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Features */}
            {course.features && course.features.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>✨ Kya Milega</Text>
                {course.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <View style={styles.featureDot} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Batches */}
            {course.batches && course.batches.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>🕐 Batch Types</Text>
                {course.batches.map((b, i) => (
                  <View key={i} style={styles.batchTypeCard}>
                    <View style={styles.batchTypeRow}>
                      <View style={styles.batchTypeBadge}>
                        <Text style={styles.batchTypeBadgeText}>{b.type || 'Regular'}</Text>
                      </View>
                      <Text style={styles.batchTypeMedium}>{b.medium} Medium</Text>
                      <Text style={styles.batchTypeBoard}>{b.board}</Text>
                    </View>
                    <View style={styles.batchTimingRow}>
                      {b.regular && b.regular !== '—' && (
                        <View style={styles.timingChip}>
                          <FontAwesome5 name="clock" size={10} color="#1B1464" />
                          <Text style={styles.timingChipText}>Regular: {b.regular}</Text>
                        </View>
                      )}
                      {b.crash && b.crash !== '—' && b.crash !== '-' && (
                        <View style={[styles.timingChip, { backgroundColor: '#FEF2F2' }]}>
                          <FontAwesome5 name="bolt" size={10} color="#DC2626" />
                          <Text style={[styles.timingChipText, { color: '#DC2626' }]}>Crash: {b.crash}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Teachers */}
            {course.teachers && course.teachers.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>👨‍🏫 Teachers</Text>
                {course.teachers.map((t, i) => (
                  <View key={i} style={styles.teacherCard}>
                    {t.photo
                      ? <Image source={{ uri: t.photo }} style={styles.teacherPhoto} />
                      : <View style={styles.teacherPhotoPlaceholder}>
                          <FontAwesome5 name="user-tie" size={20} color="#1B1464" />
                        </View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teacherName}>{t.name}</Text>
                      {t.subject && <Text style={styles.teacherSubject}>{t.subject}</Text>}
                      {t.exp && (
                        <View style={styles.teacherExpRow}>
                          <FontAwesome5 name="award" size={10} color="#C9A44E" />
                          <Text style={styles.teacherExp}>{t.exp} Experience</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Fees */}
            {course.fees && course.fees.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>💰 Fees Structure</Text>
                {course.fees.map((f, i) => (
                  <View key={i} style={styles.feeRow}>
                    <Text style={styles.feeLabel}>{f.label}</Text>
                    <Text style={styles.feeAmount}>{f.amount}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Bottom action */}
          {!isEnrolled && (
            <View style={styles.courseDetailFooter}>
              <TouchableOpacity
                style={styles.enquiryBtn}
                onPress={() => Linking.openURL(`https://wa.me/918319002877?text=Namaste, mujhe ${course.title} course ke baare mein jaankari chahiye.`)}>
                <FontAwesome5 name="whatsapp" size={16} color="#fff" />
                <Text style={styles.enquiryBtnText}>WhatsApp pe Enquiry Karo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Component ───
export default function Batches() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('my');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [detailCourse, setDetailCourse] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { router.replace('/'); return; }
      onSnapshot(collection(db, 'students'), s => {
        const found = s.docs.find(d => d.data().studentEmail?.toLowerCase() === user.email?.toLowerCase());
        if (found) setStudent({ id: found.id, ...found.data() });
      });
      onSnapshot(collection(db, 'courses'), s => {
        const sorted = s.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setCourses(sorted);
      });
      onSnapshot(collection(db, 'study_materials'), s => {
        setMaterials(s.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
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

  const studentClass = student?.class || student?.presentClass || '';
  const enrolledCourse = courses.find(c =>
    c.classId === studentClass ||
    c.title?.toLowerCase().includes(studentClass.toLowerCase()) ||
    studentClass.toLowerCase().includes((c.title || '').toLowerCase().replace('class ', ''))
  );

  // ─── Chapter Detail View ───
  if (selectedChapter && selectedSubject && selectedCourse) {
    const chapterMaterials = materials.filter(
      m => m.courseId === selectedCourse.id && m.subject === selectedSubject && m.chapter === selectedChapter
    );
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedChapter(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{selectedChapter}</Text>
              <Text style={styles.headerSub}>{selectedSubject}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
            {chapterMaterials.length === 0
              ? <View style={styles.emptyBox}>
                  <FontAwesome5 name="folder-open" size={40} color="#B0C4DC" />
                  <Text style={styles.emptyText}>Koi material nahi hai abhi</Text>
                </View>
              : chapterMaterials.map(mat => (
                  <TouchableOpacity key={mat.id} style={styles.materialCard}
                    onPress={() => {
                      if (mat.type === 'video') {
                        router.push({ pathname: '/lecture', params: { url: mat.url, title: mat.title } });
                      } else {
                        router.push({ pathname: '/pdf-reader', params: { url: mat.url, title: mat.title } });
                      }
                    }}>
                    <View style={[styles.matIconWrap, { backgroundColor: mat.type === 'video' ? '#FEF2F2' : '#EFF6FF' }]}>
                      <FontAwesome5 name={mat.type === 'video' ? 'play-circle' : 'file-pdf'} size={20}
                        color={mat.type === 'video' ? '#DC2626' : '#1B1464'} />
                    </View>
                    <View style={styles.matText}>
                      <Text style={styles.matTitle}>{mat.title}</Text>
                      <Text style={styles.matSub}>{mat.type === 'video' ? 'Video Lecture' : 'PDF Notes'}</Text>
                    </View>
                    <Ionicons name={mat.type === 'video' ? 'play' : 'document'} size={16} color="#B0C4DC" />
                  </TouchableOpacity>
                ))
            }
          </ScrollView>
          <BottomNav active="batches" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Subject Detail View ───
  if (selectedSubject && selectedCourse) {
    const subjectMaterials = materials.filter(m => m.courseId === selectedCourse.id && m.subject === selectedSubject);
    const chapters = [...new Set(subjectMaterials.map(m => m.chapter).filter(Boolean))];
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedSubject(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{selectedSubject}</Text>
              <Text style={styles.headerSub}>{selectedCourse.title}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
            {chapters.length === 0
              ? <View style={styles.emptyBox}>
                  <FontAwesome5 name="book-open" size={40} color="#B0C4DC" />
                  <Text style={styles.emptyText}>Koi chapter nahi hai abhi</Text>
                </View>
              : chapters.map((ch, i) => {
                  const chMats = subjectMaterials.filter(m => m.chapter === ch);
                  return (
                    <TouchableOpacity key={i} style={styles.chapterCard} onPress={() => setSelectedChapter(ch)}>
                      <View style={styles.chapterIconWrap}>
                        <FontAwesome5 name="book" size={18} color="#1B1464" />
                      </View>
                      <View style={styles.chapterText}>
                        <Text style={styles.chapterTitle}>{ch}</Text>
                        <View style={styles.chapterStats}>
                          {chMats.filter(m => m.type === 'video').length > 0 && (
                            <View style={styles.statChip}>
                              <FontAwesome5 name="play-circle" size={10} color="#DC2626" />
                              <Text style={styles.statChipText}>{chMats.filter(m => m.type === 'video').length} Videos</Text>
                            </View>
                          )}
                          {chMats.filter(m => m.type === 'pdf').length > 0 && (
                            <View style={styles.statChip}>
                              <FontAwesome5 name="file-pdf" size={10} color="#1B1464" />
                              <Text style={styles.statChipText}>{chMats.filter(m => m.type === 'pdf').length} PDFs</Text>
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
          <BottomNav active="batches" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Subject List View (My Batch) ───
  if (selectedCourse) {
    const courseMaterials = materials.filter(m => m.courseId === selectedCourse.id);
    const subjects = [...new Set(courseMaterials.map(m => m.subject).filter(Boolean))];
    const subjectIcons = {
      'Physics': { icon: 'atom', color: '#7C3AED', bg: '#F5F3FF' },
      'Chemistry': { icon: 'flask', color: '#059669', bg: '#ECFDF5' },
      'Maths': { icon: 'square-root-alt', color: '#D97706', bg: '#FFF7ED' },
      'Mathematics': { icon: 'square-root-alt', color: '#D97706', bg: '#FFF7ED' },
      'Biology': { icon: 'leaf', color: '#16A34A', bg: '#F0FDF4' },
      'English': { icon: 'book-open', color: '#0284C7', bg: '#EFF6FF' },
    };
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedCourse(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{selectedCourse.title}</Text>
              <Text style={styles.headerSub}>Study Materials</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
            {subjects.length === 0
              ? <View style={styles.emptyBox}>
                  <FontAwesome5 name="book" size={40} color="#B0C4DC" />
                  <Text style={styles.emptyText}>Koi material nahi hai abhi</Text>
                </View>
              : subjects.map((sub, i) => {
                  const si = subjectIcons[sub] || { icon: 'book', color: '#1B1464', bg: '#EFF6FF' };
                  const subMats = courseMaterials.filter(m => m.subject === sub);
                  return (
                    <TouchableOpacity key={i} style={styles.subjectCard} onPress={() => setSelectedSubject(sub)}>
                      <View style={[styles.subjectIconWrap, { backgroundColor: si.bg }]}>
                        <FontAwesome5 name={si.icon} size={20} color={si.color} />
                      </View>
                      <View style={styles.subjectText}>
                        <Text style={styles.subjectTitle}>{sub}</Text>
                        <Text style={styles.subjectSub}>{subMats.length} Materials</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#B0C4DC" />
                    </TouchableOpacity>
                  );
                })
            }
          </ScrollView>
          <BottomNav active="batches" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── MAIN VIEW ───
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Batches</Text>
            <Text style={styles.headerSub}>My Batch aur Explore karo</Text>
          </View>
          <TouchableOpacity style={styles.headerContactBtn} onPress={() => setShowContact(true)}>
            <Ionicons name="call" size={16} color="#C9A44E" />
            <Text style={styles.headerContactText}>Contact</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, activeSection === 'my' && styles.tabBtnActive]}
            onPress={() => setActiveSection('my')}>
            <FontAwesome5 name="graduation-cap" size={13} color={activeSection === 'my' ? '#1B1464' : '#6B7F99'} />
            <Text style={[styles.tabBtnText, activeSection === 'my' && styles.tabBtnTextActive]}>My Batch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeSection === 'explore' && styles.tabBtnActive]}
            onPress={() => setActiveSection('explore')}>
            <FontAwesome5 name="compass" size={13} color={activeSection === 'explore' ? '#1B1464' : '#6B7F99'} />
            <Text style={[styles.tabBtnText, activeSection === 'explore' && styles.tabBtnTextActive]}>Explore</Text>
          </TouchableOpacity>
        </View>

        {/* ─── MY BATCH ─── */}
        {activeSection === 'my' && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
            {!enrolledCourse
              ? <View style={styles.emptyBox}>
                  <FontAwesome5 name="chalkboard-teacher" size={40} color="#B0C4DC" />
                  <Text style={styles.emptyText}>Koi batch enrolled nahi hai</Text>
                  <Text style={styles.emptySubText}>Admin se contact karo</Text>
                  <TouchableOpacity style={styles.contactNowBtn} onPress={() => setShowContact(true)}>
                    <Ionicons name="call" size={14} color="#fff" />
                    <Text style={styles.contactNowBtnText}>Abhi Contact Karo</Text>
                  </TouchableOpacity>
                </View>
              : <>
                  {/* Enrolled Card */}
                  <View style={styles.enrolledCard}>
                    <View style={styles.enrolledHeader}>
                      <View style={styles.enrolledIconWrap}>
                        <FontAwesome5 name="graduation-cap" size={22} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.enrolledTitle}>{enrolledCourse.title}</Text>
                        <Text style={styles.enrolledSub}>{student?.medium || ''} · {student?.board || ''}</Text>
                      </View>
                      <View style={styles.enrolledBadge}>
                        <Text style={styles.enrolledBadgeText}>✓ Enrolled</Text>
                      </View>
                    </View>
                    {(student?.batchStartDate || student?.batchEndDate) && (
                      <View style={styles.batchDates}>
                        <FontAwesome5 name="calendar" size={11} color="#C9A44E" />
                        <Text style={styles.batchDatesText}>
                          {student?.batchStartDate || '—'} → {student?.batchEndDate || '—'}
                        </Text>
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.enrolledActions}>
                      <TouchableOpacity style={styles.viewDetailBtn}
                        onPress={() => { setDetailCourse(enrolledCourse); setShowDetail(true); }}>
                        <Ionicons name="information-circle-outline" size={15} color="#1B1464" />
                        <Text style={styles.viewDetailBtnText}>Batch Details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.studyBtn}
                        onPress={() => router.push('/materials')}>
                        <FontAwesome5 name="book-open" size={13} color="#fff" />
                        <Text style={styles.studyBtnText}>Study Material</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Quick Subjects */}
                  <Text style={styles.sectionLabel}>Subjects — Study Karo</Text>
                  {(() => {
                    const courseMats = materials.filter(m => m.courseId === enrolledCourse.id);
                    const subjects = [...new Set(courseMats.map(m => m.subject).filter(Boolean))];
                    const subjectIcons = {
                      'Physics': { icon: 'atom', color: '#7C3AED', bg: '#F5F3FF' },
                      'Chemistry': { icon: 'flask', color: '#059669', bg: '#ECFDF5' },
                      'Maths': { icon: 'square-root-alt', color: '#D97706', bg: '#FFF7ED' },
                      'Mathematics': { icon: 'square-root-alt', color: '#D97706', bg: '#FFF7ED' },
                      'Biology': { icon: 'leaf', color: '#16A34A', bg: '#F0FDF4' },
                      'English': { icon: 'book-open', color: '#0284C7', bg: '#EFF6FF' },
                    };
                    if (subjects.length === 0) return (
                      <View style={styles.emptyBox}>
                        <FontAwesome5 name="book" size={32} color="#B0C4DC" />
                        <Text style={styles.emptyText}>Abhi koi material nahi hai</Text>
                      </View>
                    );
                    return subjects.map((sub, i) => {
                      const si = subjectIcons[sub] || { icon: 'book', color: '#1B1464', bg: '#EFF6FF' };
                      const subMats = courseMats.filter(m => m.subject === sub);
                      return (
                        <TouchableOpacity key={i} style={styles.subjectCard}
                          onPress={() => { setSelectedCourse(enrolledCourse); setSelectedSubject(sub); }}>
                          <View style={[styles.subjectIconWrap, { backgroundColor: si.bg }]}>
                            <FontAwesome5 name={si.icon} size={20} color={si.color} />
                          </View>
                          <View style={styles.subjectText}>
                            <Text style={styles.subjectTitle}>{sub}</Text>
                            <Text style={styles.subjectSub}>{subMats.length} Materials</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color="#B0C4DC" />
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </>
            }
          </ScrollView>
        )}

        {/* ─── EXPLORE ─── */}
        {activeSection === 'explore' && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
            <Text style={styles.sectionLabel}>Sabhi Courses</Text>
            {courses.map(course => {
              const isEnrolled = enrolledCourse?.id === course.id;
              return (
                <View key={course.id} style={[styles.exploreCard, isEnrolled && styles.exploreCardEnrolled]}>

                  {/* Course Header */}
                  <View style={styles.exploreHeader}>
                    <View style={[styles.exploreIconWrap, { backgroundColor: isEnrolled ? '#C9A44E' : '#1B1464' }]}>
                      <FontAwesome5 name="chalkboard-teacher" size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exploreTitle}>{course.title}</Text>
                      {course.tag && <Text style={styles.exploreSub}>{course.tag}</Text>}
                    </View>
                    {isEnrolled && (
                      <View style={styles.enrolledBadge}>
                        <Text style={styles.enrolledBadgeText}>✓ Enrolled</Text>
                      </View>
                    )}
                  </View>

                  {/* Quick info */}
                  <View style={styles.exploreInfo}>
                    {course.duration && (
                      <View style={styles.exploreInfoItem}>
                        <FontAwesome5 name="clock" size={11} color="#6B7F99" />
                        <Text style={styles.exploreInfoText} numberOfLines={1}>{course.duration}</Text>
                      </View>
                    )}
                    {course.subjects && course.subjects.length > 0 && (
                      <View style={styles.exploreInfoItem}>
                        <FontAwesome5 name="book" size={11} color="#6B7F99" />
                        <Text style={styles.exploreInfoText}>{course.subjects.length} Subjects</Text>
                      </View>
                    )}
                    {course.teachers && course.teachers.length > 0 && (
                      <View style={styles.exploreInfoItem}>
                        <FontAwesome5 name="user-tie" size={11} color="#6B7F99" />
                        <Text style={styles.exploreInfoText}>{course.teachers.length} Teachers</Text>
                      </View>
                    )}
                  </View>

                  {/* Fees preview */}
                  {course.fees && course.fees.length > 0 && (
                    <View style={styles.feesPreview}>
                      <FontAwesome5 name="rupee-sign" size={11} color="#059669" />
                      <Text style={styles.feesPreviewText}>
                        {course.fees[0].amount} — {course.fees[0].label}
                      </Text>
                    </View>
                  )}

                  {/* ─── 2 Action Buttons ─── */}
                  <View style={styles.exploreActions}>
                    {/* Explore Button */}
                    <TouchableOpacity
                      style={styles.exploreBtn}
                      onPress={() => { setDetailCourse(course); setShowDetail(true); }}>
                      <Ionicons name="information-circle-outline" size={15} color="#1B1464" />
                      <Text style={styles.exploreBtnText}>Explore</Text>
                    </TouchableOpacity>

                    {/* Contact Button */}
                    <TouchableOpacity
                      style={styles.contactBtn}
                      onPress={() => setShowContact(true)}>
                      <Ionicons name="call-outline" size={15} color="#fff" />
                      <Text style={styles.contactBtnText}>Contact</Text>
                    </TouchableOpacity>
                  </View>

                </View>
              );
            })}
          </ScrollView>
        )}

        <BottomNav active="batches" />
      </View>

      {/* Modals */}
      <CourseDetailModal
        course={detailCourse}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        isEnrolled={enrolledCourse?.id === detailCourse?.id}
      />
      <ContactModal visible={showContact} onClose={() => setShowContact(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FA' },
  loadingText: { marginTop: 12, color: '#6B7F99', fontSize: 14 },

  // Header
  header: { backgroundColor: '#1B1464', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#C9A44E', marginTop: 2 },
  headerContactBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  headerContactText: { color: '#C9A44E', fontSize: 12, fontWeight: '800' },

  // Tabs
  tabRow: { flexDirection: 'row', margin: 16, marginBottom: 0, backgroundColor: '#E8EFF8', borderRadius: 14, padding: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 11 },
  tabBtnActive: { backgroundColor: '#fff', elevation: 2 },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7F99' },
  tabBtnTextActive: { color: '#1B1464' },

  // Section label
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#6B7F99', marginBottom: 12, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Empty
  emptyBox: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#6B7F99' },
  emptySubText: { fontSize: 13, color: '#B0C4DC' },
  contactNowBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1B1464', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  contactNowBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Enrolled Card
  enrolledCard: { backgroundColor: '#1B1464', borderRadius: 18, padding: 16, marginBottom: 8 },
  enrolledHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  enrolledIconWrap: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  enrolledTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  enrolledSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  enrolledBadge: { backgroundColor: '#C9A44E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  enrolledBadgeText: { fontSize: 10, fontWeight: '800', color: '#1B1464' },
  batchDates: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  batchDatesText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  enrolledActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  viewDetailBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10 },
  viewDetailBtnText: { color: '#1B1464', fontWeight: '800', fontSize: 13 },
  studyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#C9A44E', borderRadius: 10, paddingVertical: 10 },
  studyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Subject Card
  subjectCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, elevation: 2 },
  subjectIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  subjectText: { flex: 1 },
  subjectTitle: { fontSize: 15, fontWeight: '700', color: '#0B1826' },
  subjectSub: { fontSize: 12, color: '#6B7F99', marginTop: 2 },

  // Chapter Card
  chapterCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, elevation: 2 },
  chapterIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  chapterText: { flex: 1 },
  chapterTitle: { fontSize: 14, fontWeight: '700', color: '#0B1826' },
  chapterStats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statChipText: { fontSize: 11, color: '#6B7F99', fontWeight: '600' },

  // Material Card
  materialCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, elevation: 2 },
  matIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  matText: { flex: 1 },
  matTitle: { fontSize: 14, fontWeight: '700', color: '#0B1826' },
  matSub: { fontSize: 12, color: '#6B7F99', marginTop: 2 },

  // Explore Card
  exploreCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, elevation: 2 },
  exploreCardEnrolled: { borderWidth: 2, borderColor: '#C9A44E' },
  exploreHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  exploreIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  exploreTitle: { fontSize: 15, fontWeight: '800', color: '#0B1826' },
  exploreSub: { fontSize: 12, color: '#6B7F99', marginTop: 2 },
  exploreInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  exploreInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  exploreInfoText: { fontSize: 12, color: '#6B7F99', fontWeight: '600', maxWidth: 140 },
  feesPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  feesPreviewText: { fontSize: 12, color: '#059669', fontWeight: '700' },

  // Explore Action Buttons
  exploreActions: { flexDirection: 'row', gap: 10 },
  exploreBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 10, borderWidth: 1.5, borderColor: '#1B1464' },
  exploreBtnText: { color: '#1B1464', fontWeight: '800', fontSize: 13 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1B1464', borderRadius: 10, paddingVertical: 10 },
  contactBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Contact Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  contactModal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  contactModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  contactModalTitle: { fontSize: 18, fontWeight: '900', color: '#0B1826' },
  contactModalSub: { fontSize: 13, color: '#6B7F99', marginBottom: 20 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F4FA', alignItems: 'center', justifyContent: 'center' },
  contactPersonCard: { backgroundColor: '#F8FAFD', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E0E8F4' },
  contactPersonInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  contactPersonName: { fontSize: 14, fontWeight: '800', color: '#0B1826' },
  contactPersonPhone: { fontSize: 13, color: '#6B7F99', marginTop: 2 },
  contactBtns: { flexDirection: 'row', gap: 10 },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1B1464', borderRadius: 10, paddingVertical: 10 },
  callBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  whatsappBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#25D366', borderRadius: 10, paddingVertical: 10 },
  whatsappBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  contactCloseFullBtn: { backgroundColor: '#F0F4FA', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  contactCloseFullBtnText: { color: '#6B7F99', fontWeight: '700', fontSize: 14 },

  // Course Detail Modal
  courseDetailModal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%', overflow: 'hidden' },
  courseDetailHeader: { backgroundColor: '#1B1464', padding: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  courseDetailTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  courseTag: { backgroundColor: 'rgba(201,164,78,0.3)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  courseTagText: { color: '#C9A44E', fontSize: 11, fontWeight: '700' },

  // Detail Sections
  detailSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F4FA' },
  detailSectionTitle: { fontSize: 14, fontWeight: '800', color: '#0B1826', marginBottom: 10 },
  detailDesc: { fontSize: 13, color: '#6B7F99', lineHeight: 20 },
  durationBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10 },
  durationText: { fontSize: 13, color: '#D97706', fontWeight: '600', flex: 1 },
  subjectsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F8FAFD', borderRadius: 20, borderWidth: 1, borderColor: '#E0E8F4' },
  subjectChipText: { fontSize: 12, fontWeight: '700' },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  featureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C9A44E', marginTop: 6 },
  featureText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 20 },
  batchTypeCard: { backgroundColor: '#F8FAFD', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E0E8F4' },
  batchTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  batchTypeBadge: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  batchTypeBadgeText: { fontSize: 11, fontWeight: '800', color: '#1B1464' },
  batchTypeMedium: { fontSize: 12, fontWeight: '700', color: '#374151' },
  batchTypeBoard: { fontSize: 11, color: '#6B7F99', marginLeft: 'auto' },
  batchTimingRow: { flexDirection: 'row', gap: 8 },
  timingChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  timingChipText: { fontSize: 11, color: '#1B1464', fontWeight: '600' },
  teacherCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFD', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E0E8F4' },
  teacherPhoto: { width: 48, height: 48, borderRadius: 24 },
  teacherPhotoPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  teacherName: { fontSize: 14, fontWeight: '800', color: '#0B1826' },
  teacherSubject: { fontSize: 12, color: '#6B7F99', marginTop: 2 },
  teacherExpRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  teacherExp: { fontSize: 11, color: '#C9A44E', fontWeight: '700' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F4FA' },
  feeLabel: { fontSize: 13, color: '#374151', fontWeight: '600', flex: 1 },
  feeAmount: { fontSize: 14, color: '#059669', fontWeight: '800' },
  courseDetailFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#F0F4FA' },
  enquiryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 14 },
  enquiryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

const navStyles = StyleSheet.create({
  bar: { backgroundColor: '#fff', flexDirection: 'row', paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#E8EFF8', elevation: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: '#EFF6FF' },
  tabLabel: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  tabLabelActive: { color: '#1B1464', fontWeight: '800' },
  navBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
