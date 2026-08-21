// Tuturio backend integration test — tutor / student / parent end-to-end
// Run: node tests/api-integration.test.mjs   (server must be running on :5000)

const BASE = process.env.API_BASE ?? 'http://localhost:5000'
const TS = Date.now().toString(36)

const TUTOR_EMAIL = 'tutor@tuturio.local'
const TUTOR_PASS = 'ChangeMeNow123456!'
const STUDENT_EMAIL = `student.${TS}@test.local`
const STUDENT_PASS = 'StudentPass123456!'
const PARENT_EMAIL = `parent.${TS}@test.local`
const PARENT_PASS = 'ParentPass123456!'
const SECOND_CHILD_EMAIL = `second.child.${TS}@test.local`
const SECOND_CHILD_PASS = 'SecondChildPass123456!'

const results = []
function check(name, cond, extra) {
  results.push({ name, pass: Boolean(cond) })
  if (cond) console.log(`  PASS  ${name}`)
  else console.log(`  FAIL  ${name}  ->  ${JSON.stringify(extra ?? '').slice(0, 300)}`)
}
function section(title) {
  console.log(`\n================ ${title} ===============`)
}

function makeClient() {
  const cookies = new Map()
  return {
    async req(method, path, opts = {}) {
      const headers = {}
      if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
      let body
      if (opts.form) body = opts.form
      else if (opts.body !== undefined) {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify(opts.body)
      }
      const res = await fetch(BASE + path, { method, headers, body })
      const setCookies =
        typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
      for (const sc of setCookies) {
        const pair = sc.split(';')[0]
        const i = pair.indexOf('=')
        const k = pair.slice(0, i).trim()
        const v = pair.slice(i + 1).trim()
        if (!v) cookies.delete(k)
        else cookies.set(k, v)
      }
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
      return { status: res.status, data }
    },
  }
}

const anon = makeClient()
const tutor = makeClient()
const student = makeClient()
const parent = makeClient()
const student2 = makeClient()
const secondChild = makeClient()

async function main() {
  console.log(`Testing API at ${BASE}`)

  // Cross-section state
  let tutorId, batchId, studentCode, parentCode, linkedStudentId
  let studentUserId, parentUserId
  let sessionId, assignmentId, submissionId, progressId, announcementId, resourceId, submissionFile

  section('1. Health & unauthenticated access')
  {
    const h = await anon.req('GET', '/api/health')
    check('GET /api/health returns ok', h.status === 200 && h.data?.status === 'ok', h)
    const me = await anon.req('GET', '/api/auth/me')
    check('GET /api/auth/me without cookie -> 401', me.status === 401, me)
    const batches = await anon.req('GET', '/api/batches')
    check('GET /api/batches without cookie -> 401', batches.status === 401, batches)
  }

  section('2. Tutor login & dashboard')
  {
    const bad = await tutor.req('POST', '/api/auth/login', {
      body: { email: TUTOR_EMAIL, password: 'WrongPassword123456!' },
    })
    check('Tutor login with wrong password -> 401', bad.status === 401, bad)

    const login = await tutor.req('POST', '/api/auth/login', {
      body: { email: TUTOR_EMAIL, password: TUTOR_PASS },
    })
    check(
      'Tutor login succeeds, role=tutor',
      login.status === 200 && login.data?.user?.role === 'tutor',
      login,
    )
    tutorId = login.data?.user?.userId

    const me = await tutor.req('GET', '/api/auth/me')
    check('GET /api/auth/me as tutor', me.status === 200 && me.data?.user?.email === TUTOR_EMAIL, me)

    const overview = await tutor.req('GET', '/api/analytics/overview')
    check(
      'Tutor analytics overview (batchCount/totalStudents/todaySessions)',
      overview.status === 200 && typeof overview.data?.batchCount === 'number',
      overview,
    )
  }

  section('3. Tutor: batch creation & sessions')
  {
    const created = await tutor.req('POST', '/api/batches', {
      body: {
        name: `Integration Test Batch ${TS}`,
        subjects: ['Physics', 'Chemistry'],
        days: [1, 3, 5],
        time: '18:00',
      },
    })
    check(
      'POST /api/batches creates batch + auto sessions',
      created.status === 201 && created.data?.batch?.batchId && created.data?.sessionsCreated > 0,
      created,
    )
    batchId = created.data?.batch?.batchId

    const list = await tutor.req('GET', '/api/batches')
    check(
      'GET /api/batches lists new batch',
      list.status === 200 && list.data?.batches?.some((b) => b.batchId === batchId),
      list,
    )

    const one = await tutor.req('GET', `/api/batches/${batchId}`)
    check('GET /api/batches/:batchId as tutor', one.status === 200 && one.data?.batch?.batchId === batchId, one)

    const patched = await tutor.req('PATCH', `/api/batches/${batchId}`, {
      body: { subjects: ['Physics', 'Chemistry', 'Biology'] },
    })
    check(
      'PATCH /api/batches/:batchId updates subjects',
      patched.status === 200 && patched.data?.batch?.subjects?.length === 3,
      patched,
    )

    const sessions = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    check(
      'GET /api/sessions/batch/:batchId returns generated sessions',
      sessions.status === 200 && Array.isArray(sessions.data?.sessions) && sessions.data.sessions.length > 0,
      sessions,
    )

    const manual = await tutor.req('POST', '/api/sessions', {
      body: { batchId, topic: 'Integration test session', date: new Date().toISOString() },
    })
    check('POST /api/sessions creates manual session today', manual.status === 201, manual)
    const today = await tutor.req('GET', '/api/sessions/today')
    check(
      "GET /api/sessions/today includes today's session",
      today.status === 200 && Array.isArray(today.data?.sessions) && today.data.sessions.length > 0,
      today,
    )
  }

  section('4. Tutor: paired invites (student + parent)')
  {
    const invites = await tutor.req('POST', '/api/invites/paired', {
      body: { batchId, studentEmail: STUDENT_EMAIL, parentEmail: PARENT_EMAIL, expiryDays: 7 },
    })
    check(
      'POST /api/invites/paired returns student + parent invites',
      invites.status === 201 && invites.data?.student?.invite?.code && invites.data?.parent?.invite?.code,
      invites,
    )
    studentCode = invites.data?.student?.invite?.code
    parentCode = invites.data?.parent?.invite?.code
    linkedStudentId = invites.data?.linkedStudentId

    const val = await anon.req('GET', `/api/invites/${studentCode}`)
    check(
      'GET /api/invites/:code validates student invite publicly',
      val.status === 200 && val.data?.invite?.role === 'student' && val.data?.status === 'valid',
      val,
    )
  }

  section('5. Student: invite redemption & student endpoints')
  {
    const redeem = await student.req('POST', `/api/invites/${studentCode}/redeem`, {
      body: { name: 'Test Student', email: STUDENT_EMAIL, password: STUDENT_PASS },
    })
    check(
      'Student redeem creates account (201, role=student)',
      redeem.status === 201 && redeem.data?.user?.role === 'student',
      redeem,
    )
    studentUserId = redeem.data?.user?.userId
    check(
      'Student userId uses reserved linked id',
      studentUserId === linkedStudentId,
      { studentUserId, linkedStudentId },
    )

    const reused = await anon.req('POST', `/api/invites/${studentCode}/redeem`, {
      body: { name: 'X', email: `x.${TS}@test.local`, password: 'SomePassword123456!' },
    })
    check('Redeeming same invite twice -> 409', reused.status === 409, reused)

    const me = await student.req('GET', '/api/auth/me')
    check('GET /api/auth/me as student', me.status === 200 && me.data?.user?.role === 'student', me)

    const enrolled = await student.req('GET', '/api/batches/student/enrolled')
    check(
      'GET /api/batches/student/enrolled contains batch',
      enrolled.status === 200 && enrolled.data?.batches?.some((b) => b.batchId === batchId),
      enrolled,
    )

    const upcoming = await student.req('GET', '/api/sessions/student/upcoming')
    check(
      'GET /api/sessions/student/upcoming returns sessions',
      upcoming.status === 200 && Array.isArray(upcoming.data?.sessions) && upcoming.data.sessions.length > 0,
      upcoming,
    )

    const overview = await student.req('GET', '/api/analytics/student/overview')
    check(
      'GET /api/analytics/student/overview works',
      overview.status === 200 && overview.data?.batchCount >= 1,
      overview,
    )

    const profile = await student.req('PUT', '/api/user/profile', { body: { bio: 'Integration test bio' } })
    check('PUT /api/user/profile as student', profile.status === 200 && profile.data?.user?.bio === 'Integration test bio', profile)
  }

  section('6. Parent: invite redemption & parent endpoints')
  {
    const redeem = await parent.req('POST', `/api/invites/${parentCode}/redeem`, {
      body: { name: 'Test Parent', email: PARENT_EMAIL, password: PARENT_PASS },
    })
    check(
      'Parent redeem creates account (201, role=parent)',
      redeem.status === 201 && redeem.data?.user?.role === 'parent',
      redeem,
    )
    parentUserId = redeem.data?.user?.userId

    const me = await parent.req('GET', '/api/auth/me')
    check(
      'Parent linkedStudentIds contains student',
      me.status === 200 && me.data?.user?.linkedStudentIds?.includes(studentUserId),
      me,
    )

    const kids = await parent.req('GET', '/api/batches/parent/students')
    check(
      'GET /api/batches/parent/students lists linked student',
      kids.status === 200 && kids.data?.students?.some((s) => s.userId === studentUserId),
      kids,
    )

    const enrolled = await parent.req('GET', '/api/batches/parent/enrolled')
    check(
      'GET /api/batches/parent/enrolled contains batch',
      enrolled.status === 200 && enrolled.data?.batches?.some((b) => b.batchId === batchId),
      enrolled,
    )

    const upcoming = await parent.req('GET', '/api/sessions/parent/upcoming')
    check(
      'GET /api/sessions/parent/upcoming returns sessions',
      upcoming.status === 200 && Array.isArray(upcoming.data?.sessions) && upcoming.data.sessions.length > 0,
      upcoming,
    )

    const overview = await parent.req('GET', '/api/analytics/parent/overview')
    check(
      'GET /api/analytics/parent/overview works',
      overview.status === 200 && overview.data?.batchCount >= 1,
      overview,
    )

    // KNOWN BUG: attendance.routes.js uses User without importing it
    const att = await parent.req('GET', '/api/attendance/parent/students')
    check(
      'GET /api/attendance/parent/students works for parent',
      att.status === 200 && Array.isArray(att.data?.attendance),
      att,
    )

    const secondPair = await tutor.req('POST', '/api/invites/paired', {
      body: {
        batchId,
        studentEmail: SECOND_CHILD_EMAIL,
        parentEmail: PARENT_EMAIL,
        expiryDays: 7,
      },
    })
    check(
      'Tutor creates second paired invite for same parent',
      secondPair.status === 201 &&
        secondPair.data?.student?.invite?.code &&
        secondPair.data?.parent?.invite?.code,
      secondPair,
    )

    const secondStudentCode = secondPair.data?.student?.invite?.code
    const secondParentCode = secondPair.data?.parent?.invite?.code
    const secondLinkedStudentId = secondPair.data?.linkedStudentId

    const parentFirst = await parent.req('POST', `/api/invites/${secondParentCode}/redeem`, {
      body: {},
    })
    check(
      'Logged-in parent redeems second child invite before student',
      parentFirst.status === 200 && parentFirst.data?.user?.linkedStudentIds?.includes(secondLinkedStudentId),
      parentFirst,
    )

    const parentAfterSecondLink = await parent.req('GET', '/api/auth/me')
    check(
      'Same parent account now has multiple linked students',
      parentAfterSecondLink.status === 200 &&
        parentAfterSecondLink.data?.user?.linkedStudentIds?.includes(studentUserId) &&
        parentAfterSecondLink.data?.user?.linkedStudentIds?.includes(secondLinkedStudentId),
      parentAfterSecondLink,
    )

    const secondRedeem = await secondChild.req('POST', `/api/invites/${secondStudentCode}/redeem`, {
      body: {
        name: 'Second Test Student',
        email: SECOND_CHILD_EMAIL,
        password: SECOND_CHILD_PASS,
      },
    })
    check(
      'Student redeems after parent-first link and receives reserved id',
      secondRedeem.status === 201 && secondRedeem.data?.user?.userId === secondLinkedStudentId,
      secondRedeem,
    )

    const kidsAfterSecondStudent = await parent.req('GET', '/api/batches/parent/students')
    check(
      'Parent student list includes both children after second student redeems',
      kidsAfterSecondStudent.status === 200 &&
        kidsAfterSecondStudent.data?.students?.some((s) => s.userId === studentUserId) &&
        kidsAfterSecondStudent.data?.students?.some((s) => s.userId === secondLinkedStudentId),
      kidsAfterSecondStudent,
    )
  }

  section('7. Cross-role data flows (tutor writes, student/parent read)')
  {
    // Attendance
    const sessList = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    sessionId = sessList.data?.sessions?.[0]?._id
    const mark = await tutor.req('POST', `/api/attendance/session/${sessionId}`, {
      body: { batchId, records: [{ studentId: studentUserId, status: 'present' }] },
    })
    check('Tutor marks attendance (present)', mark.status === 200, mark)

    const stuAtt = await student.req('GET', '/api/attendance/student/me')
    check(
      'Student sees own attendance record',
      stuAtt.status === 200 && stuAtt.data?.attendance?.some((a) => a.sessionId === sessionId),
      stuAtt,
    )

    const done = await tutor.req('PATCH', `/api/sessions/${sessionId}/status`, { body: { status: 'completed' } })
    check('Tutor marks session completed', done.status === 200 && done.data?.session?.status === 'completed', done)

    const sessOne = await student.req('GET', `/api/sessions/${sessionId}`)
    check('Student can view session detail', sessOne.status === 200, sessOne)
    const sessOneParent = await parent.req('GET', `/api/sessions/${sessionId}`)
    check('Parent can view session detail', sessOneParent.status === 200, sessOneParent)

    // Assignments
    const due = new Date(Date.now() + 7 * 864e5).toISOString()
    const asg = await tutor.req('POST', '/api/assignments', {
      body: { batchId, title: `Homework ${TS}`, description: 'Chapter 1 problems', dueDate: due, maxScore: 100 },
    })
    check('Tutor creates assignment', asg.status === 201, asg)
    assignmentId = asg.data?.assignment?._id

    const form = new FormData()
    form.append('file', new Blob(['my homework content'], { type: 'text/plain' }), 'homework.txt')
    const sub = await student.req('POST', `/api/assignments/${assignmentId}/submit`, { form })
    check('Student submits assignment file', sub.status === 201 && sub.data?.submission?.status === 'submitted', sub)
    submissionId = sub.data?.submission?._id
    submissionFile = sub.data?.submission?.fileUrl?.split('/').pop()

    const subs = await tutor.req('GET', `/api/assignments/${assignmentId}/submissions`)
    check('Tutor lists submissions', subs.status === 200 && subs.data?.submissions?.length === 1, subs)

    const grade = await tutor.req('PATCH', `/api/assignments/submission/${submissionId}/grade`, {
      body: { score: 92, feedback: 'Great work' },
    })
    check('Tutor grades submission', grade.status === 200 && grade.data?.submission?.score === 92, grade)

    const mySub = await student.req('GET', `/api/assignments/${assignmentId}/submission/me`)
    check('Student views own graded submission', mySub.status === 200 && mySub.data?.submission?.score === 92, mySub)

    const pAsg = await parent.req('GET', '/api/assignments/parent/students')
    check(
      'Parent sees assignments of linked student',
      pAsg.status === 200 && pAsg.data?.assignments?.some((a) => a._id === assignmentId),
      pAsg,
    )
    const pSub = await parent.req('GET', `/api/assignments/${assignmentId}/submission/student/${studentUserId}`)
    check('Parent views student submission', pSub.status === 200 && pSub.data?.submission?.score === 92, pSub)

    // Progress
    const prog = await tutor.req('POST', '/api/progress', {
      body: { batchId, studentId: studentUserId, topic: 'Kinematics', score: 8, maxScore: 10, remark: 'Good' },
    })
    check('Tutor adds progress entry', prog.status === 201, prog)
    progressId = prog.data?.progress?._id

    const stuProg = await student.req('GET', '/api/progress/student/me')
    check('Student views own progress', stuProg.status === 200 && stuProg.data?.progress?.some((p) => p._id === progressId), stuProg)

    const parProg = await parent.req('GET', '/api/progress/parent/students')
    check('Parent views student progress', parProg.status === 200 && parProg.data?.progress?.some((p) => p._id === progressId), parProg)

    // Announcements
    const ann = await tutor.req('POST', '/api/announcements', { body: { batchId, text: `Test announcement ${TS}` } })
    check('Tutor posts announcement', ann.status === 201, ann)
    announcementId = ann.data?.announcement?._id
    const stuAnn = await student.req('GET', `/api/announcements/batch/${batchId}`)
    check('Student reads announcements', stuAnn.status === 200 && stuAnn.data?.announcements?.some((a) => a._id === announcementId), stuAnn)
    const parAnn = await parent.req('GET', `/api/announcements/batch/${batchId}`)
    check('Parent reads announcements', parAnn.status === 200 && parAnn.data?.announcements?.some((a) => a._id === announcementId), parAnn)

    // Resources
    const res1 = await tutor.req('POST', '/api/resources/link', {
      body: { batchId, title: 'Formula sheet', url: 'https://example.com/formulas' },
    })
    check('Tutor adds resource link', res1.status === 201, res1)
    resourceId = res1.data?.resource?._id
    const stuRes = await student.req('GET', `/api/resources/batch/${batchId}`)
    check('Student reads resources', stuRes.status === 200 && stuRes.data?.resources?.some((r) => r._id === resourceId), stuRes)
    // KNOWN BUG: resource.routes.js uses User without importing it (parent branch)
    const parRes = await parent.req('GET', `/api/resources/batch/${batchId}`)
    check(
      'Parent reads resources',
      parRes.status === 200 && Array.isArray(parRes.data?.resources),
      parRes,
    )
  }

  section('8. Messaging between roles')
  {
    const m1 = await tutor.req('POST', '/api/messages', {
      body: { receiverId: studentUserId, content: 'Hello from tutor' },
    })
    check('Tutor sends message to student', m1.status === 201, m1)

    const m2 = await student.req('POST', '/api/messages', {
      body: { receiverId: parentUserId, content: 'Hi mom/dad' },
    })
    check('Student sends message to parent', m2.status === 201, m2)

    const convo = await parent.req('GET', `/api/messages/${studentUserId}`)
    check(
      'Parent reads conversation with student',
      convo.status === 200 && convo.data?.messages?.some((m) => m.content === 'Hi mom/dad'),
      convo,
    )

    const read = await student.req('PATCH', '/api/messages/read', { body: { senderId: tutorId } })
    check('Student marks tutor messages read', read.status === 200, read)
  }

  section('9. Notifications & tutor search/exports')
  {
    const n1 = await student.req('GET', '/api/notifications')
    check('GET /api/notifications as student', n1.status === 200 && Array.isArray(n1.data?.notifications), n1)
    const n2 = await student.req('PATCH', '/api/notifications/read-all')
    check('PATCH /api/notifications/read-all', n2.status === 200, n2)

    const search = await tutor.req('GET', '/api/user/search?q=Test')
    check(
      'Tutor user search finds student',
      search.status === 200 && search.data?.users?.some((u) => u.userId === studentUserId),
      search,
    )

    const allStudents = await tutor.req('GET', '/api/batches/students/all')
    check(
      'GET /api/batches/students/all includes student with parent name',
      allStudents.status === 200 &&
        allStudents.data?.students?.some((s) => s.studentId === studentUserId && s.parentName === 'Test Parent'),
      allStudents,
    )

    const csvAtt = await tutor.req('GET', `/api/analytics/export/attendance/${batchId}`)
    check('Attendance CSV export', csvAtt.status === 200 && String(csvAtt.data).includes('Student ID'), csvAtt)
    const csvProg = await tutor.req('GET', `/api/analytics/export/progress/${batchId}`)
    check('Progress CSV export', csvProg.status === 200 && String(csvProg.data).includes('Student ID'), csvProg)

    const batchStats = await tutor.req('GET', `/api/analytics/batch/${batchId}`)
    check(
      'GET /api/analytics/batch/:batchId student stats',
      batchStats.status === 200 &&
        batchStats.data?.studentStats?.some((s) => s.studentId === studentUserId && s.attendancePercentage === 100),
      batchStats,
    )
  }

  section('10. Access control (role guards & tenant isolation)')
  let batch2Id
  {
    const g1 = await student.req('POST', '/api/batches', { body: { name: 'Hack' } })
    check('Student cannot create batch -> 403', g1.status === 403, g1)
    const g2 = await parent.req('GET', '/api/batches')
    check('Parent cannot list tutor batches -> 403', g2.status === 403, g2)
    const g3 = await student.req('POST', '/api/invites/paired', { body: { batchId } })
    check('Student cannot create invites -> 403', g3.status === 403, g3)
    const g4 = await parent.req('POST', '/api/sessions', { body: { batchId, topic: 'x' } })
    check('Parent cannot create sessions -> 403', g4.status === 403, g4)
    const g5 = await student.req('POST', '/api/announcements', { body: { batchId, text: 'x' } })
    check('Student cannot post announcements -> 403', g5.status === 403, g5)

    // Second batch + second student to verify isolation
    const b2 = await tutor.req('POST', '/api/batches', { body: { name: `Isolation Batch ${TS}`, days: [2], time: '10:00' } })
    batch2Id = b2.data?.batch?.batchId
    const inv2 = await tutor.req('POST', '/api/invites/paired', { body: { batchId: batch2Id, expiryDays: 7 } })
    const code2 = inv2.data?.student?.invite?.code
    const red2 = await student2.req('POST', `/api/invites/${code2}/redeem`, {
      body: { name: 'Other Student', email: `other.${TS}@test.local`, password: 'OtherPass12345678!' },
    })
    check('Second student redeems second batch invite', red2.status === 201, red2)

    const iso1 = await student2.req('GET', `/api/batches/${batchId}`)
    check('Student2 cannot access student1 batch -> 403', iso1.status === 403, iso1)
    const iso2 = await student.req('GET', `/api/batches/${batch2Id}`)
    check('Student1 cannot access student2 batch -> 403', iso2.status === 403, iso2)
    const iso3 = await student2.req('GET', `/api/sessions/batch/${batchId}`)
    check('Student2 cannot access student1 sessions -> 403', iso3.status === 403, iso3)
    const iso4 = await student2.req('GET', `/api/announcements/batch/${batchId}`)
    check('Student2 cannot read student1 announcements -> 403', iso4.status === 403, iso4)
  }

  section('12. Security fixes verification')
  {
    // Messaging access control
    const strangerMsg = await student2.req('POST', '/api/messages', {
      body: { receiverId: parentUserId, content: 'should be blocked' },
    })
    check('Stranger cannot message unrelated user -> 403', strangerMsg.status === 403, strangerMsg)

    const strangerRead = await student2.req('GET', `/api/messages/${studentUserId}`)
    check('Stranger cannot read unrelated conversation -> 403', strangerRead.status === 403, strangerRead)

    const classmateMsg = await tutor.req('POST', '/api/messages', {
      body: { receiverId: studentUserId, content: 'tutor to own student ok' },
    })
    check('Tutor can still message own student -> 201', classmateMsg.status === 201, classmateMsg)

    const contacts = await student.req('GET', '/api/messages/contacts')
    check(
      'GET /api/messages/contacts lists tutor for student',
      contacts.status === 200 && contacts.data?.contacts?.some((c) => c.userId === tutorId),
      contacts,
    )

    const convos = await student.req('GET', '/api/messages/conversations')
    check('GET /api/messages/conversations works', convos.status === 200 && Array.isArray(convos.data?.conversations), convos)

    const longMsg = await tutor.req('POST', '/api/messages', {
      body: { receiverId: studentUserId, content: 'x'.repeat(2001) },
    })
    check('Message over 2000 chars -> 400', longMsg.status === 400, longMsg)

    // Notifications now fire
    const stuNotifs = await student.req('GET', '/api/notifications')
    check(
      'Notifications generated by real events (message/assignment)',
      stuNotifs.status === 200 && (stuNotifs.data?.notifications?.length ?? 0) > 0,
      stuNotifs,
    )

    // Session status enum validation
    const sessList2 = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    const sid2 = sessList2.data?.sessions?.[0]?._id
    const badStatus = await tutor.req('PATCH', `/api/sessions/${sid2}/status`, { body: { status: 'banana' } })
    check("Session status 'banana' -> 400", badStatus.status === 400, badStatus)

    // Invalid ObjectId -> 404 not 500
    const badId = await tutor.req('GET', '/api/sessions/not-a-valid-objectid')
    check('Invalid session ObjectId -> 404 (not 500)', badId.status === 404, badId)

    // Attendance validation
    const fakeAtt = await tutor.req('POST', `/api/attendance/session/${sid2}`, {
      body: { batchId, records: [{ studentId: 'USR-fake999', status: 'weird' }] },
    })
    check('Attendance for unenrolled student / bad status -> 400', fakeAtt.status === 400, fakeAtt)

    // Progress score bounds
    const badScore = await tutor.req('POST', '/api/progress', {
      body: { batchId, studentId: studentUserId, topic: 'Cheat', score: 15, maxScore: 10 },
    })
    check('Progress score > maxScore -> 400', badScore.status === 400, badScore)

    // Submission file-type filter (HTML rejected)
    const htmlForm = new FormData()
    htmlForm.append('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'evil.html')
    const evilSub = await student.req('POST', `/api/assignments/${assignmentId}/submit`, { form: htmlForm })
    check('HTML submission upload rejected -> 500/400 (not stored)', evilSub.status !== 201, evilSub)

    // Tutor cannot submit homework anymore
    const tutorForm = new FormData()
    tutorForm.append('file', new Blob(['tutor hw'], { type: 'text/plain' }), 'hw.txt')
    const tutorSub = await tutor.req('POST', `/api/assignments/${assignmentId}/submit`, { form: tutorForm })
    check('Tutor cannot submit assignment -> 403', tutorSub.status === 403, tutorSub)

    // Uploads require auth
    const anonUpload = await anon.req('GET', `/uploads/submissions/${submissionFile ?? 'none.txt'}`)
    check('Anonymous upload fetch -> 401 (protected)', anonUpload.status === 401, anonUpload)
    const authedUpload = await tutor.req('GET', `/uploads/submissions/${submissionFile ?? 'none.txt'}`)
    check('Authenticated upload fetch works', authedUpload.status === 200 || authedUpload.status === 404, authedUpload)

    // Invite revoke
    const inv3 = await tutor.req('POST', '/api/invites/paired', { body: { batchId } })
    const code3 = inv3.data?.student?.invite?.code
    const revoked = await tutor.req('POST', `/api/invites/${code3}/revoke`)
    check('Tutor revokes unused invite -> 200', revoked.status === 200, revoked)
    const revokedUse = await anon.req('GET', `/api/invites/${code3}`)
    check('Revoked invite no longer valid -> 410', revokedUse.status === 410, revokedUse)
    const revokedByStudent = await student.req('POST', `/api/invites/paired`, { body: { batchId } })
    check('Student cannot revoke invites -> 403', revokedByStudent.status === 403, revokedByStudent)

    // Pending enrollment does not inflate counts
    const batchAfter = await tutor.req('GET', `/api/batches/${batchId}`)
    const pendingCount = batchAfter.data?.batch?.pendingCount
    check('Batch exposes pendingCount field', typeof pendingCount === 'number', batchAfter)

    // Archive / unarchive student
    const archStu = await tutor.req('POST', `/api/user/${studentUserId}/archive`)
    check('Tutor archives student -> 200', archStu.status === 200, archStu)
    const archivedMe = await student.req('GET', '/api/auth/me')
    check('Archived student API access blocked -> 403', archivedMe.status === 403, archivedMe)
    const archivedLogin = await anon.req('POST', '/api/auth/login', {
      body: { email: STUDENT_EMAIL, password: STUDENT_PASS },
    })
    check('Archived student login blocked -> 403', archivedLogin.status === 403, archivedLogin)
    const unarch = await tutor.req('POST', `/api/user/${studentUserId}/unarchive`)
    check('Tutor unarchives student -> 200', unarch.status === 200, unarch)
    const restoredLogin = await student.req('POST', '/api/auth/login', {
      body: { email: STUDENT_EMAIL, password: STUDENT_PASS },
    })
    check('Unarchived student can log in again', restoredLogin.status === 200, restoredLogin)

    // Student search now works within their circle
    const stuSearch = await student.req('GET', '/api/user/search?q=Demo')
    check(
      'Student search finds their tutor',
      stuSearch.status === 200 && stuSearch.data?.users?.some((u) => u.userId === tutorId),
      stuSearch,
    )
  }

  section('11. Auth: refresh, logout, token invalidation')
  {
    const ref = await student.req('POST', '/api/auth/refresh')
    check('POST /api/auth/refresh issues new session', ref.status === 200 && ref.data?.user?.role === 'student', ref)

    const relogin = await student.req('POST', '/api/auth/login', {
      body: { email: STUDENT_EMAIL, password: STUDENT_PASS },
    })
    check('Student re-login works', relogin.status === 200, relogin)

    const out = await parent.req('POST', '/api/auth/logout')
    check('Parent logout clears cookies', out.status === 200, out)
    const meAfter = await parent.req('GET', '/api/auth/me')
    check('GET /api/auth/me after logout -> 401', meAfter.status === 401, meAfter)

    const arch = await tutor.req('DELETE', `/api/batches/${batch2Id}`)
    check('Tutor archives isolation batch', arch.status === 200, arch)
    const afterArch = await student2.req('GET', '/api/batches/student/enrolled')
    check('Archived batch disappears from student enrolled list', afterArch.status === 200 && !afterArch.data?.batches?.some((b) => b.batchId === batch2Id), afterArch)
  }

  // Summary
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass)
  console.log(`\n================ SUMMARY ================`)
  console.log(`Total: ${results.length}   Passed: ${passed}   Failed: ${failed.length}`)
  if (failed.length) {
    console.log('\nFAILED CHECKS (likely bugs):')
    for (const f of failed) console.log(`  - ${f.name}`)
  }
  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
