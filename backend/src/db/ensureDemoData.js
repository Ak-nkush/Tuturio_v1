import { User } from '../models/User.js'
import { Batch } from '../models/Batch.js'
import { Session } from '../models/Session.js'
import { Attendance } from '../models/Attendance.js'
import { Progress } from '../models/Progress.js'
import { Assignment } from '../models/Assignment.js'
import { Submission } from '../models/Submission.js'
import { Announcement } from '../models/Announcement.js'
import { Resource } from '../models/Resource.js'
import { Message } from '../models/Message.js'
import { Subject } from '../models/Subject.js'
import { hashPassword, normalizeEmail } from '../utils/password.js'

export async function ensureDemoData({ force = false } = {}) {
  const tutorBatches = await Batch.countDocuments({ tutorId: 'USR-TUTOR01', status: 'active' })
  const tutorCount = await User.countDocuments({ role: 'tutor' })
  const studentCount = await User.countDocuments({ role: 'student' })
  const parentCount = await User.countDocuments({ role: 'parent' })
  const submissionCount = await Submission.countDocuments({})
  const hasPlaceholders = await User.exists({ userId: { $in: ['USR-STUD00', 'USR-PARENT00', 'USR-TUTOR02'] } })
  const oct10Start = new Date(2026, 9, 10, 0, 0, 0)
  const oct10End = new Date(2026, 9, 10, 23, 59, 59, 999)
  const oct10SessionsCount = await Session.countDocuments({ date: { $gte: oct10Start, $lte: oct10End } })

  if (!force && !hasPlaceholders && tutorCount === 1 && tutorBatches >= 3 && studentCount >= 14 && parentCount >= 10 && oct10SessionsCount >= 3 && submissionCount >= 6) {
    console.log(`✓ Classroom data ready (Sole Tutor: Meera Joshi with ${tutorBatches} batches, ${studentCount} students, ${parentCount} parents, ${oct10SessionsCount} Oct 10 demo sessions).`)
    return
  }

  console.log('--- Seeding Comprehensive Realistic Classroom Demo Dataset ---')

  try {
    await Attendance.collection.dropIndexes()
  } catch {
    // ignore
  }

  await Promise.all([
    User.deleteMany({}),
    Batch.deleteMany({}),
    Session.deleteMany({}),
    Attendance.deleteMany({}),
    Progress.deleteMany({}),
    Assignment.deleteMany({}),
    Submission.deleteMany({}),
    Announcement.deleteMany({}),
    Resource.deleteMany({}),
    Message.deleteMany({}),
    Subject.deleteMany({}),
  ])

  const defaultPasswordHash = await hashPassword('Password123!')

  // 1. SOLE TUTOR ACCOUNT: Meera Joshi
  const tutor = await User.create({
    userId: 'USR-TUTOR01',
    name: 'Meera Joshi',
    email: normalizeEmail('tutor@tuturio.local'),
    role: 'tutor',
    passwordHash: defaultPasswordHash,
    bio: 'Senior Physics, Mathematics & STEM Instructor with 8+ years teaching experience for ICSE, CBSE & JEE Advanced.',
    status: 'active',
  })

  // 2. PARENT ACCOUNTS
  // Primary Parent (Multi-child: 2 children in 2 different batches)
  const primaryParent = await User.create({
    userId: 'USR-PARENT01',
    name: 'Vijay Mahadole (Parent)',
    email: normalizeEmail('ankushvijaymahadole@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD01', 'USR-STUD02'],
    status: 'active',
  })

  // Batch 1 Parents
  const parentSharma = await User.create({
    userId: 'USR-PARENT02',
    name: 'Sunil Sharma',
    email: normalizeEmail('sunil.sharma@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD03'],
    status: 'active',
  })

  const parentDeshmukh = await User.create({
    userId: 'USR-PARENT03',
    name: 'Kavita Deshmukh',
    email: normalizeEmail('kavita.deshmukh@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD04'],
    status: 'active',
  })

  const parentKulkarni = await User.create({
    userId: 'USR-PARENT05',
    name: 'Ramesh Kulkarni',
    email: normalizeEmail('ramesh.kulkarni@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD05'],
    status: 'active',
  })

  const parentPatel = await User.create({
    userId: 'USR-PARENT06',
    name: 'Sanjay Patel',
    email: normalizeEmail('sanjay.patel@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD06'],
    status: 'active',
  })

  const parentMehta = await User.create({
    userId: 'USR-PARENT07',
    name: 'Deepa Mehta',
    email: normalizeEmail('deepa.mehta@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD06B'],
    status: 'active',
  })

  // Batch 2 Parents
  const parentVerma = await User.create({
    userId: 'USR-PARENT04',
    name: 'Pooja Verma',
    email: normalizeEmail('pooja.verma@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD07'],
    status: 'active',
  })

  const parentReddy = await User.create({
    userId: 'USR-PARENT08',
    name: 'Venkat Reddy',
    email: normalizeEmail('venkat.reddy@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD08'],
    status: 'active',
  })

  const parentPatil = await User.create({
    userId: 'USR-PARENT09',
    name: 'Rajesh Patil',
    email: normalizeEmail('rajesh.patil@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD09'],
    status: 'active',
  })

  const parentJoshi = await User.create({
    userId: 'USR-PARENT10',
    name: 'Suresh Joshi',
    email: normalizeEmail('suresh.joshi@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD10'],
    status: 'active',
  })

  // Batch 3 Parents
  const parentNair = await User.create({
    userId: 'USR-PARENT11',
    name: 'Mohan Nair',
    email: normalizeEmail('mohan.nair@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD11'],
    status: 'active',
  })

  const parentIyer = await User.create({
    userId: 'USR-PARENT12',
    name: 'Balaji Iyer',
    email: normalizeEmail('balaji.iyer@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD12'],
    status: 'active',
  })

  const parentHegde = await User.create({
    userId: 'USR-PARENT13',
    name: 'Vinay Hegde',
    email: normalizeEmail('vinay.hegde@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD13'],
    status: 'active',
  })

  const parentRao = await User.create({
    userId: 'USR-PARENT14',
    name: 'Anand Rao',
    email: normalizeEmail('anand.rao@gmail.com'),
    role: 'parent',
    passwordHash: defaultPasswordHash,
    linkedStudentIds: ['USR-STUD14'],
    status: 'active',
  })

  // 3. STUDENT ACCOUNTS
  // Child 1 (Grade 10 ICSE)
  const child1 = await User.create({
    userId: 'USR-STUD01',
    name: 'Ankush Mahadole (Child 1 - Gr 10)',
    email: normalizeEmail('01ankush.mahadole@gmail.com'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [primaryParent.userId],
    status: 'active',
  })

  // Child 2 (Grade 9 CBSE Sibling)
  const child2 = await User.create({
    userId: 'USR-STUD02',
    name: 'Rohan Mahadole (Child 2 - Gr 9)',
    email: normalizeEmail('rohan.mahadole@tuturio.local'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [primaryParent.userId],
    status: 'active',
  })

  // Batch 1 Students (Grade 10)
  const sIshaan = await User.create({
    userId: 'USR-STUD03',
    name: 'Ishaan Sharma',
    email: normalizeEmail('ishaan.sharma@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentSharma.userId],
    status: 'active',
  })

  const sTanvi = await User.create({
    userId: 'USR-STUD04',
    name: 'Tanvi Deshmukh',
    email: normalizeEmail('tanvi.deshmukh@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentDeshmukh.userId],
    status: 'active',
  })

  const sAryan = await User.create({
    userId: 'USR-STUD05',
    name: 'Aryan Kulkarni',
    email: normalizeEmail('aryan.kulkarni@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentKulkarni.userId],
    status: 'active',
  })

  const sRiya = await User.create({
    userId: 'USR-STUD06',
    name: 'Riya Patel',
    email: normalizeEmail('riya.patel@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentPatel.userId],
    status: 'active',
  })

  const sKabir = await User.create({
    userId: 'USR-STUD06B',
    name: 'Kabir Mehta',
    email: normalizeEmail('kabir.mehta@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentMehta.userId],
    status: 'active',
  })

  // Batch 2 Students (Grade 9)
  const sSiddharth = await User.create({
    userId: 'USR-STUD07',
    name: 'Siddharth Verma',
    email: normalizeEmail('siddharth.verma@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentVerma.userId],
    status: 'active',
  })

  const sSneha = await User.create({
    userId: 'USR-STUD08',
    name: 'Sneha Reddy',
    email: normalizeEmail('sneha.reddy@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentReddy.userId],
    status: 'active',
  })

  const sDevansh = await User.create({
    userId: 'USR-STUD09',
    name: 'Devansh Patil',
    email: normalizeEmail('devansh.patil@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentPatil.userId],
    status: 'active',
  })

  const sAnanya = await User.create({
    userId: 'USR-STUD10',
    name: 'Ananya Joshi',
    email: normalizeEmail('ananya.joshi@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentJoshi.userId],
    status: 'active',
  })

  // Batch 3 Students (Grade 11 JEE)
  const sAditya = await User.create({
    userId: 'USR-STUD11',
    name: 'Aditya Nair',
    email: normalizeEmail('aditya.nair@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentNair.userId],
    status: 'active',
  })

  const sManish = await User.create({
    userId: 'USR-STUD12',
    name: 'Manish Iyer',
    email: normalizeEmail('manish.iyer@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentIyer.userId],
    status: 'active',
  })

  const sPooja = await User.create({
    userId: 'USR-STUD13',
    name: 'Pooja Hegde',
    email: normalizeEmail('pooja.hegde@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentHegde.userId],
    status: 'active',
  })

  const sNikhil = await User.create({
    userId: 'USR-STUD14',
    name: 'Nikhil Rao',
    email: normalizeEmail('nikhil.rao@tuturio.edu'),
    role: 'student',
    passwordHash: defaultPasswordHash,
    linkedParentIds: [parentRao.userId],
    status: 'active',
  })

  const dayMs = 86400000
  const now = Date.now()

  // Helper to seed complete batch suite for any tutor
  async function seedTutorClassroom(tutor, prefix) {
    // Subjects
    await Subject.create([
      { subjectId: `SUBJ-${prefix}-MATH`, tutorId: tutor.userId, name: 'Mathematics' },
      { subjectId: `SUBJ-${prefix}-PHY`, tutorId: tutor.userId, name: 'Physics' },
      { subjectId: `SUBJ-${prefix}-CHEM`, tutorId: tutor.userId, name: 'Chemistry' },
      { subjectId: `SUBJ-${prefix}-BIO`, tutorId: tutor.userId, name: 'Biology' },
      { subjectId: `SUBJ-${prefix}-CALC`, tutorId: tutor.userId, name: 'Calculus' },
    ])

    // Batch 1 (Grade 10)
    const batch1 = await Batch.create({
      batchId: `BAT-${prefix}-GR10`,
      tutorId: tutor.userId,
      name: 'Grade 10 — ICSE Mathematics & Physics',
      subjects: ['Mathematics', 'Physics', 'Trigonometry', 'Coordinate Geometry'],
      schedule: { days: [1, 3, 5], time: '18:00' },
      status: 'active',
      enrollment: [
        { studentId: child1.userId, parentId: primaryParent.userId, status: 'active', joinedAt: new Date(now - 45 * dayMs) },
        { studentId: sIshaan.userId, parentId: parentSharma.userId, status: 'active', joinedAt: new Date(now - 45 * dayMs) },
        { studentId: sTanvi.userId, parentId: parentDeshmukh.userId, status: 'active', joinedAt: new Date(now - 40 * dayMs) },
        { studentId: sAryan.userId, parentId: parentKulkarni.userId, status: 'active', joinedAt: new Date(now - 40 * dayMs) },
        { studentId: sRiya.userId, parentId: parentPatel.userId, status: 'active', joinedAt: new Date(now - 35 * dayMs) },
        { studentId: sKabir.userId, parentId: parentMehta.userId, status: 'active', joinedAt: new Date(now - 35 * dayMs) },
      ],
    })

    // Batch 2 (Grade 9)
    const batch2 = await Batch.create({
      batchId: `BAT-${prefix}-GR9`,
      tutorId: tutor.userId,
      name: 'Grade 9 — CBSE Science Foundations',
      subjects: ['Physics', 'Chemistry', 'Biology'],
      schedule: { days: [2, 4], time: '17:00' },
      status: 'active',
      enrollment: [
        { studentId: child2.userId, parentId: primaryParent.userId, status: 'active', joinedAt: new Date(now - 30 * dayMs) },
        { studentId: sSiddharth.userId, parentId: parentVerma.userId, status: 'active', joinedAt: new Date(now - 30 * dayMs) },
        { studentId: sSneha.userId, parentId: parentReddy.userId, status: 'active', joinedAt: new Date(now - 28 * dayMs) },
        { studentId: sDevansh.userId, parentId: parentPatil.userId, status: 'active', joinedAt: new Date(now - 25 * dayMs) },
        { studentId: sAnanya.userId, parentId: parentJoshi.userId, status: 'active', joinedAt: new Date(now - 20 * dayMs) },
      ],
    })

    // Batch 3 (Grade 11)
    const batch3 = await Batch.create({
      batchId: `BAT-${prefix}-GR11`,
      tutorId: tutor.userId,
      name: 'Grade 11 — JEE Advanced Mechanics & Calculus',
      subjects: ['Rotational Dynamics', 'Integral Calculus', 'Thermodynamics'],
      schedule: { days: [6], time: '10:00' },
      status: 'active',
      enrollment: [
        { studentId: sAditya.userId, parentId: parentNair.userId, status: 'active', joinedAt: new Date(now - 20 * dayMs) },
        { studentId: sManish.userId, parentId: parentIyer.userId, status: 'active', joinedAt: new Date(now - 20 * dayMs) },
        { studentId: sPooja.userId, parentId: parentHegde.userId, status: 'active', joinedAt: new Date(now - 15 * dayMs) },
        { studentId: sNikhil.userId, parentId: parentRao.userId, status: 'active', joinedAt: new Date(now - 10 * dayMs) },
      ],
    })

    // Sessions for Batch 1 (Grade 10 ICSE)
    const b1s1 = await Session.create({
      batchId: batch1.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 8, 28, 17, 0, 0),
      topic: 'Quadratic Equations: Factorization & Quadratic Formula',
      status: 'completed',
    })
    const b1s2 = await Session.create({
      batchId: batch1.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 1, 17, 0, 0),
      topic: 'Trigonometric Identities & Heights & Distances',
      status: 'completed',
    })
    const b1s3 = await Session.create({
      batchId: batch1.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 3, 17, 0, 0),
      topic: "Newton's Laws of Motion, Friction & Free Body Diagrams",
      status: 'completed',
    })
    const b1s4 = await Session.create({
      batchId: batch1.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 5, 17, 0, 0),
      topic: 'Work, Energy, Power & Conservation of Energy Theorem',
      status: 'completed',
    })
    // October 10, 2026 Demo Class at 05:00 PM
    const b1s5 = await Session.create({
      batchId: batch1.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 10, 17, 0, 0),
      topic: 'Coordinate Geometry: Section Formula & Distance Formula',
      status: 'scheduled',
    })
    const b1s6 = await Session.create({
      batchId: batch1.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 12, 17, 0, 0),
      topic: "Current Electricity: Ohm's Law & Series-Parallel Circuits",
      status: 'scheduled',
    })
    const b1s7 = await Session.create({
      batchId: batch1.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 14, 17, 0, 0),
      topic: 'Weekly Doubt Clearing & Board Exam Practice',
      status: 'scheduled',
    })

    // Sessions for Batch 2 (Grade 9 CBSE)
    const b2s1 = await Session.create({
      batchId: batch2.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 8, 29, 14, 30, 0),
      topic: "Structure of the Atom: Rutherford's Model & Bohr Postulates",
      status: 'completed',
    })
    const b2s2 = await Session.create({
      batchId: batch2.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 2, 14, 30, 0),
      topic: 'Chemical Reactions: Balancing Equations & Redox Types',
      status: 'completed',
    })
    const b2s3 = await Session.create({
      batchId: batch2.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 6, 14, 30, 0),
      topic: 'Plant and Animal Cell Organelles (Mitosis/Meiosis)',
      status: 'completed',
    })
    // October 10, 2026 Demo Class at 02:30 PM
    const b2s4 = await Session.create({
      batchId: batch2.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 10, 14, 30, 0),
      topic: 'Laws of Motion & Inertia with Real-life Applications',
      status: 'scheduled',
    })
    const b2s5 = await Session.create({
      batchId: batch2.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 13, 14, 30, 0),
      topic: 'Gravitation: Universal Law & Free Fall Acceleration (g)',
      status: 'scheduled',
    })

    // Sessions for Batch 3 (Grade 11 JEE Advanced)
    const b3s1 = await Session.create({
      batchId: batch3.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 3, 10, 0, 0),
      topic: 'Rotational Dynamics: Moment of Inertia & Parallel Axis Theorem',
      status: 'completed',
    })
    // October 10, 2026 Demo Class at 10:00 AM
    const b3s2 = await Session.create({
      batchId: batch3.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 10, 10, 0, 0),
      topic: 'Limits & Continuity: Standard Trigonometric Limits & Squeeze Theorem',
      status: 'scheduled',
    })
    const b3s3 = await Session.create({
      batchId: batch3.batchId,
      tutorId: tutor.userId,
      date: new Date(2026, 9, 17, 10, 0, 0),
      topic: 'Thermodynamics & Heat Engines: Carnot Cycle & Entropy',
      status: 'scheduled',
    })

    // Attendance Records for Batch 1
    const b1MarksMatrix = [
      [
        { id: child1.userId, st: 'present' },
        { id: sIshaan.userId, st: 'present' },
        { id: sTanvi.userId, st: 'present' },
        { id: sAryan.userId, st: 'present' },
        { id: sRiya.userId, st: 'present' },
        { id: sKabir.userId, st: 'present' },
      ],
      [
        { id: child1.userId, st: 'present' },
        { id: sIshaan.userId, st: 'present' },
        { id: sTanvi.userId, st: 'late', note: 'Arrived 10 mins late due to school bus delay' },
        { id: sAryan.userId, st: 'absent' },
        { id: sRiya.userId, st: 'present' },
        { id: sKabir.userId, st: 'present' },
      ],
      [
        { id: child1.userId, st: 'present' },
        { id: sIshaan.userId, st: 'present' },
        { id: sTanvi.userId, st: 'present' },
        { id: sAryan.userId, st: 'excused', note: 'Family medical appointment' },
        { id: sRiya.userId, st: 'present' },
        { id: sKabir.userId, st: 'present' },
      ],
      [
        { id: child1.userId, st: 'present' },
        { id: sIshaan.userId, st: 'present' },
        { id: sTanvi.userId, st: 'present' },
        { id: sAryan.userId, st: 'present' },
        { id: sRiya.userId, st: 'late' },
        { id: sKabir.userId, st: 'excused' },
      ],
    ]

    const b1CompletedSessions = [b1s1, b1s2, b1s3, b1s4]
    for (let i = 0; i < b1CompletedSessions.length; i++) {
      for (const record of b1MarksMatrix[i]) {
        await Attendance.create({
          sessionId: b1CompletedSessions[i]._id,
          studentId: record.id,
          batchId: batch1.batchId,
          status: record.st,
          markedBy: tutor.userId,
          markedAt: b1CompletedSessions[i].date,
          corrections: record.note ? [{ previousStatus: 'absent', newStatus: record.st, note: record.note, changedBy: tutor.userId, changedAt: b1CompletedSessions[i].date }] : [],
        })
      }
    }

    // Attendance Records for Batch 2
    const b2MarksMatrix = [
      [
        { id: child2.userId, st: 'present' },
        { id: sSiddharth.userId, st: 'present' },
        { id: sSneha.userId, st: 'present' },
        { id: sDevansh.userId, st: 'late', note: 'Sports practice overlap' },
        { id: sAnanya.userId, st: 'present' },
      ],
      [
        { id: child2.userId, st: 'present' },
        { id: sSiddharth.userId, st: 'present' },
        { id: sSneha.userId, st: 'present' },
        { id: sDevansh.userId, st: 'present' },
        { id: sAnanya.userId, st: 'absent' },
      ],
      [
        { id: child2.userId, st: 'present' },
        { id: sSiddharth.userId, st: 'present' },
        { id: sSneha.userId, st: 'present' },
        { id: sDevansh.userId, st: 'present' },
        { id: sAnanya.userId, st: 'present' },
      ],
    ]

    const b2CompletedSessions = [b2s1, b2s2, b2s3]
    for (let i = 0; i < b2CompletedSessions.length; i++) {
      for (const record of b2MarksMatrix[i]) {
        await Attendance.create({
          sessionId: b2CompletedSessions[i]._id,
          studentId: record.id,
          batchId: batch2.batchId,
          status: record.st,
          markedBy: tutor.userId,
          markedAt: b2CompletedSessions[i].date,
          corrections: record.note ? [{ previousStatus: 'absent', newStatus: record.st, note: record.note, changedBy: tutor.userId, changedAt: b2CompletedSessions[i].date }] : [],
        })
      }
    }

    // Attendance Records for Batch 3
    for (const studId of [sAditya.userId, sManish.userId, sPooja.userId, sNikhil.userId]) {
      await Attendance.create({
        sessionId: b3s1._id,
        studentId: studId,
        batchId: batch3.batchId,
        status: 'present',
        markedBy: tutor.userId,
        markedAt: b3s1.date,
      })
    }

    // Progress Records
    await Progress.create([
      {
        studentId: child1.userId,
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        subject: 'Mathematics',
        topic: 'Quadratic Equations Unit Test',
        score: 24,
        maxScore: 25,
        remark: 'Outstanding algebraic accuracy and clear quadratic formula steps.',
        date: new Date(now - 9 * dayMs),
      },
      {
        studentId: child1.userId,
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        subject: 'Physics',
        topic: 'Kinematics & Free Body Diagrams Quiz',
        score: 19,
        maxScore: 20,
        remark: 'Clear vector resolution and proper sign convention usage.',
        date: new Date(now - 4 * dayMs),
      },
      {
        studentId: sIshaan.userId,
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        subject: 'Mathematics',
        topic: 'Quadratic Equations Unit Test',
        score: 23,
        maxScore: 25,
        remark: 'Very good score. Review word problem framing.',
        date: new Date(now - 9 * dayMs),
      },
      {
        studentId: sTanvi.userId,
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        subject: 'Physics',
        topic: 'Kinematics & Free Body Diagrams Quiz',
        score: 17,
        maxScore: 20,
        remark: 'Good conceptual grasp. Practice more numerical problems.',
        date: new Date(now - 4 * dayMs),
      },
      {
        studentId: child2.userId,
        tutorId: tutor.userId,
        batchId: batch2.batchId,
        subject: 'Chemistry',
        topic: 'Atomic Structure & Valence Quiz',
        score: 15,
        maxScore: 15,
        remark: 'Perfect score on Bohr orbital configurations and isotope definitions!',
        date: new Date(now - 7 * dayMs),
      },
      {
        studentId: child2.userId,
        tutorId: tutor.userId,
        batchId: batch2.batchId,
        subject: 'Chemistry',
        topic: 'Chemical Equations Balancing Assessment',
        score: 18,
        maxScore: 20,
        remark: 'Great grasp on coefficient balancing and reaction types.',
        date: new Date(now - 2 * dayMs),
      },
      {
        studentId: sSiddharth.userId,
        tutorId: tutor.userId,
        batchId: batch2.batchId,
        subject: 'Chemistry',
        topic: 'Atomic Structure & Valence Quiz',
        score: 14,
        maxScore: 15,
        remark: 'Strong effort. Minor slip in subatomic particle masses.',
        date: new Date(now - 7 * dayMs),
      },
    ])

    // Assignments
    const [a1, a2, a3, a4] = await Assignment.create([
      {
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        title: 'Trigonometry & Quadratic Equations Practice Sheet #1',
        description: 'Solve problems 1 through 15 from Chapter 4. Show complete intermediate algebraic steps neatly.',
        dueDate: new Date(now + 4 * dayMs),
        maxScore: 25,
      },
      {
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        title: 'Physics: Work, Energy & Power Numerical Problem Set',
        description: 'Calculate work done against friction and power output for the 8 numerical problems given in the handout.',
        dueDate: new Date(now + 6 * dayMs),
        maxScore: 20,
      },
      {
        tutorId: tutor.userId,
        batchId: batch2.batchId,
        title: 'Valency & Chemical Formula Writing Worksheet',
        description: 'Complete the chemical formula writing chart for common ionic compounds on textbook page 42.',
        dueDate: new Date(now + 5 * dayMs),
        maxScore: 20,
      },
      {
        tutorId: tutor.userId,
        batchId: batch3.batchId,
        title: 'JEE Mechanics: Moment of Inertia of Continuous Bodies',
        description: 'Derive the moment of inertia for a hollow cylinder, solid cone, and triangular laminar sheet about their respective centroidal axes.',
        dueDate: new Date(now + 6 * dayMs),
        maxScore: 30,
      },
    ])

    // Student Submissions for Assignments
    await Submission.create([
      // Assignment 1 (Trigonometry Sheet #1 - Batch 1)
      {
        assignmentId: a1._id,
        studentId: child1.userId,
        storageKey: 'submissions/demo_trig_ankush.pdf',
        fileName: 'Trigonometry_Sheet1_Ankush.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 245000,
        status: 'graded',
        score: 24,
        feedback: 'Well written solutions with clear step-by-step working. Excellent work!',
      },
      {
        assignmentId: a1._id,
        studentId: sIshaan.userId,
        storageKey: 'submissions/demo_trig_ishaan.pdf',
        fileName: 'Ishaan_Trigonometry_HW.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 310000,
        status: 'graded',
        score: 22,
        feedback: 'Good effort. Recheck question 9 step 3 for sign convention.',
      },
      {
        assignmentId: a1._id,
        studentId: sTanvi.userId,
        storageKey: 'submissions/demo_trig_tanvi.pdf',
        fileName: 'Tanvi_Deshmukh_Trig_Assignment.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 198000,
        status: 'submitted',
      },
      {
        assignmentId: a1._id,
        studentId: sAryan.userId,
        storageKey: 'submissions/demo_trig_aryan.pdf',
        fileName: 'Aryan_Kulkarni_Maths_HW1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 280000,
        status: 'submitted',
      },

      // Assignment 2 (Physics Work & Power - Batch 1)
      {
        assignmentId: a2._id,
        studentId: child1.userId,
        storageKey: 'submissions/demo_physics_ankush.pdf',
        fileName: 'Physics_Work_Power_Ankush.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 350000,
        status: 'submitted',
      },
      {
        assignmentId: a2._id,
        studentId: sIshaan.userId,
        storageKey: 'submissions/demo_physics_ishaan.pdf',
        fileName: 'Physics_Numericals_Ishaan.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 220000,
        status: 'submitted',
      },

      // Assignment 3 (Valency Worksheet - Batch 2)
      {
        assignmentId: a3._id,
        studentId: child2.userId,
        storageKey: 'submissions/demo_valency_rohan.pdf',
        fileName: 'Rohan_Chemistry_Valency_Worksheet.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 215000,
        status: 'graded',
        score: 19,
        feedback: 'All molecular valencies and reaction coefficients correctly calculated.',
      },
      {
        assignmentId: a3._id,
        studentId: sSiddharth.userId,
        storageKey: 'submissions/demo_valency_siddharth.pdf',
        fileName: 'Siddharth_Verma_Chemistry.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 290000,
        status: 'submitted',
      },
      {
        assignmentId: a3._id,
        studentId: sSneha.userId,
        storageKey: 'submissions/demo_valency_sneha.pdf',
        fileName: 'Sneha_Reddy_Science_HW.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 180000,
        status: 'graded',
        score: 18,
        feedback: 'Very neat presentation and accurate answers.',
      },

      // Assignment 4 (JEE Mechanics - Batch 3)
      {
        assignmentId: a4._id,
        studentId: sAditya.userId,
        storageKey: 'submissions/demo_jee_aditya.pdf',
        fileName: 'Aditya_JEE_MomentOfInertia_Derivations.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 420000,
        status: 'graded',
        score: 28,
        feedback: 'Rigorous calculus integration and clean centroidal axis derivations.',
      },
      {
        assignmentId: a4._id,
        studentId: sManish.userId,
        storageKey: 'submissions/demo_jee_manish.pdf',
        fileName: 'Manish_Iyer_RotationalDynamics.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 380000,
        status: 'submitted',
      },
    ])

    // Announcements
    await Announcement.create([
      {
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        text: '📅 Term 1 Mid-Semester Examination Schedule: Physics test on 18th Oct, Mathematics on 22nd Oct. Prepare chapters 1 through 5 thoroughly.',
      },
      {
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        text: '📚 Formula Handbook & Trigonometry Identity Cheat Sheet has been uploaded to the Materials tab. Please download and print it for reference.',
      },
      {
        tutorId: tutor.userId,
        batchId: batch2.batchId,
        text: "🔬 Reminder: Please bring your Science NCERT textbook and drawing stationery for Thursday's plant cell diagram session.",
      },
      {
        tutorId: tutor.userId,
        batchId: batch3.batchId,
        text: '⚡ Advanced JEE problem set on Rolling Motion is now live. Attempt all level-2 questions before Saturday.',
      },
    ])

    // Resources
    await Resource.create([
      {
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        title: 'Trigonometry Formulas & Derivation Summary Guide',
        type: 'link',
        url: 'https://ptable.com',
      },
      {
        tutorId: tutor.userId,
        batchId: batch1.batchId,
        title: 'PhET Interactive Simulation: Forces & Motion on Incline',
        type: 'link',
        url: 'https://phet.colorado.edu/en/simulations/forces-and-motion-basics',
      },
      {
        tutorId: tutor.userId,
        batchId: batch2.batchId,
        title: 'Interactive 3D Periodic Table of Elements',
        type: 'link',
        url: 'https://ptable.com',
      },
    ])

    // Messages
    await Message.create([
      {
        senderId: child1.userId,
        receiverId: tutor.userId,
        content: 'Sir, I had a quick question regarding question 7 in the Trigonometry worksheet — should we apply the half-angle formula or standard complement identities?',
        isRead: true,
        isDelivered: true,
        createdAt: new Date(now - 3 * dayMs),
      },
      {
        senderId: tutor.userId,
        receiverId: child1.userId,
        content: 'Great question Ankush! Use the standard identity sin(90-θ) = cos(θ) first to simplify the numerator, then factor out the common term. Let me know if you get stuck!',
        isRead: true,
        isDelivered: true,
        createdAt: new Date(now - 3 * dayMs + 15 * 60000),
      },
      {
        senderId: child1.userId,
        receiverId: tutor.userId,
        content: 'Understood sir, got the exact RHS proof. Thank you!',
        isRead: true,
        isDelivered: true,
        createdAt: new Date(now - 3 * dayMs + 30 * 60000),
      },
      {
        senderId: primaryParent.userId,
        receiverId: tutor.userId,
        content: 'Hello Ma\'am, how is Rohan coping with the new Chemistry topics in Grade 9?',
        isRead: true,
        isDelivered: true,
        createdAt: new Date(now - 2 * dayMs),
      },
      {
        senderId: tutor.userId,
        receiverId: primaryParent.userId,
        content: 'Hello Mr. Mahadole! Rohan is doing wonderful. He scored 15/15 in the recent Atomic Structure quiz and actively participates in class discussions.',
        isRead: true,
        isDelivered: true,
        createdAt: new Date(now - 2 * dayMs + 20 * 60000),
      },
    ])
  }

  // Seed classroom suite for sole Tutor (Meera Joshi)
  await seedTutorClassroom(tutor, 'T1')

  console.log('✓ Realistic classroom demo dataset seeded successfully for all accounts.')
}


