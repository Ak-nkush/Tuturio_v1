// Tuturio backend integration test — tutor / student / parent end-to-end
// Run: node tests/api-integration.test.mjs   (server must be running on :5000)

const BASE = process.env.API_BASE ?? 'http://localhost:5000'
const TS = Date.now().toString(36)

const TUTOR_EMAIL = 'tutor@tuturio.local'
const TUTOR_PASS = 'MeeraJoshi8'
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
  let tutorId, tutorName, batchId, studentCode, parentCode, linkedStudentId
  let studentUserId, parentUserId, parentName
  let sessionId, assignmentId, submissionId, progressId, announcementId, resourceId, submissionDownloadUrl, messageDownloadUrl

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
    tutorName = login.data?.user?.name

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

    const nowMs = Date.now()
    const futureIds = (list) =>
      (list ?? [])
        .filter((session) => session.status === 'scheduled' && new Date(session.date).getTime() >= nowMs)
        .map((session) => session._id)
        .sort()
        .join(',')
    const beforeIds = futureIds(sessions.data.sessions)

    const timePreview = await tutor.req('POST', `/api/batches/${batchId}/preview-schedule-change`, {
      body: { schedule: { days: [1, 3, 5], time: '19:00' }, weeksAhead: 4 },
    })
    check(
      'Preview time change reports toModify without writing',
      timePreview.status === 200 &&
        Array.isArray(timePreview.data?.preview?.toModify) &&
        timePreview.data.preview.toModify.length > 0 &&
        Array.isArray(timePreview.data.preview.toRemove) &&
        Array.isArray(timePreview.data.preview.toCreate),
      timePreview,
    )

    const dayPreview = await tutor.req('POST', `/api/batches/${batchId}/preview-schedule-change`, {
      body: { schedule: { days: [2, 4], time: '17:30' }, weeksAhead: 4 },
    })
    check(
      'Preview day change reports toRemove and toCreate',
      dayPreview.status === 200 &&
        dayPreview.data.preview.toRemove.length > 0 &&
        dayPreview.data.preview.toCreate.length > 0,
      dayPreview,
    )

    const afterPreview = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    check(
      'Preview endpoint does not modify sessions',
      afterPreview.status === 200 && futureIds(afterPreview.data.sessions) === beforeIds,
      afterPreview,
    )

    const patchedSchedule = await tutor.req('PATCH', `/api/batches/${batchId}`, {
      body: { days: [2, 4], time: '17:30' },
    })
    check(
      'Schedule change without regenerateSessions updates batch only',
      patchedSchedule.status === 200 && patchedSchedule.data?.batch?.schedule?.time === '17:30',
      patchedSchedule,
    )
    const afterSilentPatch = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    check(
      'Schedule change without regenerateSessions does not modify future sessions',
      afterSilentPatch.status === 200 && futureIds(afterSilentPatch.data.sessions) === beforeIds,
      afterSilentPatch,
    )

    const regenerated = await tutor.req('PATCH', `/api/batches/${batchId}`, {
      body: { days: [2, 4], time: '17:30', regenerateSessions: true },
    })
    check(
      'Explicit regenerateSessions recreates future sessions',
      regenerated.status === 200 && regenerated.data?.sessionsCreated > 0,
      regenerated,
    )
    const afterRegen = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    const regenFuture = (afterRegen.data?.sessions ?? []).filter(
      (session) => session.status === 'scheduled' && new Date(session.date).getTime() >= nowMs,
    )
    check(
      'Regenerated sessions follow the new timetable',
      afterRegen.status === 200 &&
        regenFuture.length > 0 &&
        regenFuture.every((session) => [2, 4].includes(new Date(session.date).getDay())),
      afterRegen,
    )

    const holidayTarget = regenFuture[0]
    const holidayDate = holidayTarget?.date
    const holidayAdd = await tutor.req('POST', `/api/batches/${batchId}/holidays`, {
      body: { date: holidayDate },
    })
    check('POST holiday marks the date', holidayAdd.status === 200, holidayAdd)
    const afterHoliday = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    const holidaySession = (afterHoliday.data?.sessions ?? []).find((session) => session._id === holidayTarget?._id)
    check(
      'Adding a holiday cancels the session on that date',
      holidaySession?.status === 'cancelled' && holidaySession?.isHoliday === true,
      afterHoliday,
    )
    const holidayRemove = await tutor.req('DELETE', `/api/batches/${batchId}/holidays`, {
      body: { date: holidayDate },
    })
    check('DELETE holiday restores the date', holidayRemove.status === 200, holidayRemove)
    const afterHolidayRemove = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    const restoredHolidaySession = (afterHolidayRemove.data?.sessions ?? []).find((session) => session._id === holidayTarget?._id)
    check(
      'Removing a holiday restores the cancelled session',
      restoredHolidaySession?.status === 'scheduled' && restoredHolidaySession?.isHoliday === false,
      afterHolidayRemove,
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
    const calFrom = new Date()
    calFrom.setHours(0, 0, 0, 0)
    const calTo = new Date()
    calTo.setHours(23, 59, 59, 999)
    const calendar = await tutor.req(
      'GET',
      `/api/sessions/calendar?from=${encodeURIComponent(calFrom.toISOString())}&to=${encodeURIComponent(calTo.toISOString())}&batchId=${batchId}`,
    )
    check(
      'GET /api/sessions/calendar returns sessions in range',
      calendar.status === 200 && Array.isArray(calendar.data?.sessions) && calendar.data.sessions.length > 0,
      calendar,
    )
    const calendarBad = await tutor.req('GET', '/api/sessions/calendar')
    check('GET /api/sessions/calendar without dates is 400', calendarBad.status === 400, calendarBad)
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
      body: { password: STUDENT_PASS },
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
    const calFrom = new Date()
    calFrom.setHours(0, 0, 0, 0)
    const calTo = new Date()
    calTo.setFullYear(calTo.getFullYear() + 1)
    const studentCal = await student.req(
      'GET',
      `/api/sessions/calendar?from=${encodeURIComponent(calFrom.toISOString())}&to=${encodeURIComponent(calTo.toISOString())}`,
    )
    check(
      'GET /api/sessions/calendar as student returns sessions',
      studentCal.status === 200 && Array.isArray(studentCal.data?.sessions),
      studentCal,
    )

    const overview = await student.req('GET', '/api/analytics/student/overview')
    check(
      'GET /api/analytics/student/overview works',
      overview.status === 200 && overview.data?.batchCount >= 1,
      overview,
    )

    const profile = await student.req('PUT', '/api/users/profile', { body: { bio: 'Integration test bio' } })
    check('PUT /api/users/profile as student', profile.status === 200 && profile.data?.user?.bio === 'Integration test bio', profile)
  }

  section('6. Parent: invite redemption & parent endpoints')
  {
    const redeem = await parent.req('POST', `/api/invites/${parentCode}/redeem`, {
      body: { password: PARENT_PASS },
    })
    check(
      'Parent redeem creates account (201, role=parent)',
      redeem.status === 201 && redeem.data?.user?.role === 'parent',
      redeem,
    )
    parentUserId = redeem.data?.user?.userId
    parentName = redeem.data?.user?.name

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
    const calFrom = new Date()
    calFrom.setHours(0, 0, 0, 0)
    const calTo = new Date()
    calTo.setFullYear(calTo.getFullYear() + 1)
    const parentCal = await parent.req(
      'GET',
      `/api/sessions/calendar?from=${encodeURIComponent(calFrom.toISOString())}&to=${encodeURIComponent(calTo.toISOString())}&studentId=${studentUserId}`,
    )
    check(
      'GET /api/sessions/calendar as parent returns sessions',
      parentCal.status === 200 && Array.isArray(parentCal.data?.sessions),
      parentCal,
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
      body: { password: SECOND_CHILD_PASS },
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
    submissionDownloadUrl = sub.data?.submission?.downloadUrl

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

    const pAsgChild = await parent.req('GET', `/api/assignments/parent/students?studentId=${studentUserId}`)
    check(
      'Parent assignment list includes status and grade for the selected child',
      pAsgChild.status === 200 &&
        pAsgChild.data?.assignments?.some(
          (a) => a._id === assignmentId && a.submission?.status === 'graded' && a.submission?.score === 92,
        ),
      pAsgChild,
    )
    const studentAsParent = await student.req('GET', '/api/assignments/parent/students')
    check('Student cannot use parent assignment endpoint -> 403', studentAsParent.status === 403, studentAsParent)

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

    const resourceForm = new FormData()
    resourceForm.append('batchId', batchId)
    resourceForm.append('file', new Blob(['private resource'], { type: 'text/plain' }), 'private-note.txt')
    const uploaded = await tutor.req('POST', '/api/resources/upload', { form: resourceForm })
    const privateResourceUrl = uploaded.data?.resource?.downloadUrl
    check('Tutor uploads a private resource', uploaded.status === 201 && privateResourceUrl, uploaded)
    const anonResource = await anon.req('GET', privateResourceUrl)
    check('Anonymous resource download is blocked -> 401', anonResource.status === 401, anonResource)
    const studentResource = await student.req('GET', privateResourceUrl)
    check('Enrolled student downloads resource -> 200', studentResource.status === 200, studentResource)
    const parentResource = await parent.req('GET', privateResourceUrl)
    check('Linked parent downloads resource -> 200', parentResource.status === 200, parentResource)
  }

  section('8. Messaging between roles')
  {
    const m1 = await tutor.req('POST', '/api/messages', {
      body: { receiverId: studentUserId, content: 'Hello from tutor' },
    })
    check('Tutor sends message to student', m1.status === 201, m1)

    const m2 = await tutor.req('POST', '/api/messages', {
      body: { receiverId: parentUserId, content: 'Hello parent' },
    })
    check('Tutor sends message to parent', m2.status === 201, m2)

    const blockedParentChild = await student.req('POST', '/api/messages', {
      body: { receiverId: parentUserId, content: 'This must be blocked' },
    })
    check(
      'Student cannot message parent -> 403',
      blockedParentChild.status === 403,
      blockedParentChild,
    )

    const parentStudentThread = await parent.req('GET', `/api/messages/${studentUserId}`)
    check('Parent cannot read tutor-student thread -> 403', parentStudentThread.status === 403, parentStudentThread)

    const read = await student.req('PATCH', '/api/messages/read', { body: { senderId: tutorId } })
    check('Student marks tutor messages read', read.status === 200, read)
  }

  section('9. Notifications & tutor search/exports')
  {
    const n1 = await student.req('GET', '/api/notifications')
    check('GET /api/notifications as student', n1.status === 200 && Array.isArray(n1.data?.notifications), n1)
    const n2 = await student.req('PATCH', '/api/notifications/read-all')
    check('PATCH /api/notifications/read-all', n2.status === 200, n2)

    const search = await tutor.req('GET', '/api/users/search?q=Test')
    check(
      'Tutor user search finds student',
      search.status === 200 && search.data?.users?.some((u) => u.userId === studentUserId),
      search,
    )

    const allStudents = await tutor.req('GET', '/api/batches/students/all')
    check(
      'GET /api/batches/students/all includes student with parent name',
      allStudents.status === 200 &&
        allStudents.data?.students?.some((s) => s.studentId === studentUserId && s.parentName === parentName && s.parentId === parentUserId),
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

    const messageForm = new FormData()
    messageForm.append('receiverId', studentUserId)
    messageForm.append('files', new Blob(['private message attachment'], { type: 'text/plain' }), 'private-message.txt')
    const attachedMessage = await tutor.req('POST', '/api/messages', { form: messageForm })
    messageDownloadUrl = attachedMessage.data?.message?.attachments?.[0]?.url
    check('Tutor sends private message attachment', attachedMessage.status === 201 && messageDownloadUrl, attachedMessage)
    const anonMessageFile = await anon.req('GET', messageDownloadUrl)
    check('Anonymous message attachment is blocked -> 401', anonMessageFile.status === 401, anonMessageFile)
    const recipientMessageFile = await student.req('GET', messageDownloadUrl)
    check('Message recipient downloads attachment -> 200', recipientMessageFile.status === 200, recipientMessageFile)
    const parentMessageFile = await parent.req('GET', messageDownloadUrl)
    check('Parent cannot download tutor-student attachment -> 403', parentMessageFile.status === 403, parentMessageFile)

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

    // Submission files use a role-aware private endpoint.
    const anonSubmission = await anon.req('GET', submissionDownloadUrl)
    check('Anonymous submission download is blocked -> 401', anonSubmission.status === 401, anonSubmission)
    const tutorSubmission = await tutor.req('GET', submissionDownloadUrl)
    check('Assignment tutor downloads submission -> 200', tutorSubmission.status === 200, tutorSubmission)
    const parentSubmission = await parent.req('GET', submissionDownloadUrl)
    check('Linked parent downloads submission -> 200', parentSubmission.status === 200, parentSubmission)
    const strangerSubmission = await student2.req('GET', submissionDownloadUrl)
    check('Unrelated student cannot download submission -> 403', strangerSubmission.status === 403, strangerSubmission)

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

    // Enrollment statuses
    const setPending = await tutor.req('PATCH', `/api/batches/${batchId}/students/${studentUserId}`, {
      body: { status: 'pending' },
    })
    check('Enrollment status pending is persisted', setPending.status === 200 && setPending.data?.enrollment?.status === 'pending', setPending)
    const setArchived = await tutor.req('PATCH', `/api/batches/${batchId}/students/${studentUserId}`, {
      body: { status: 'archived' },
    })
    check('Enrollment status archived is persisted', setArchived.status === 200 && setArchived.data?.enrollment?.status === 'archived', setArchived)
    const badEnrollmentStatus = await tutor.req('PATCH', `/api/batches/${batchId}/students/${studentUserId}`, {
      body: { status: 'unknown' },
    })
    check('Invalid enrollment status -> 400', badEnrollmentStatus.status === 400, badEnrollmentStatus)
    const setActive = await tutor.req('PATCH', `/api/batches/${batchId}/students/${studentUserId}`, {
      body: { status: 'active' },
    })
    check('Enrollment status active is restored', setActive.status === 200 && setActive.data?.enrollment?.status === 'active', setActive)
    const setRemoved = await tutor.req('PATCH', `/api/batches/${batchId}/students/${studentUserId}`, {
      body: { status: 'removed' },
    })
    check('Enrollment status removed is persisted', setRemoved.status === 200 && setRemoved.data?.enrollment?.status === 'removed', setRemoved)
    const restoreActive = await tutor.req('PATCH', `/api/batches/${batchId}/students/${studentUserId}`, {
      body: { status: 'active' },
    })
    check('Enrollment restored to active after status checks', restoreActive.status === 200 && restoreActive.data?.enrollment?.status === 'active', restoreActive)

    const parentStudentThread = await parent.req('GET', `/api/messages/${studentUserId}`)
    check('Parent cannot open tutor-student conversation -> 403', parentStudentThread.status === 403, parentStudentThread)
    const studentParentConv = await student.req('POST', '/api/conversations', { body: { peerId: parentUserId } })
    check('Student cannot start conversation with parent -> 403', studentParentConv.status === 403, studentParentConv)
    const tutorStudentConv = await tutor.req('POST', '/api/conversations', { body: { peerId: studentUserId } })
    check(
      'Tutor can open tutor-student conversation',
      tutorStudentConv.status === 201 && tutorStudentConv.data?.conversation?.type === 'tutor_student',
      tutorStudentConv,
    )

    const progressLeak = await student.req('GET', `/api/progress/batch/${batchId}?studentId=USR-NOT-MINE`)
    check(
      'Student cannot query another student progress in-batch',
      progressLeak.status === 200 && (progressLeak.data?.progress ?? []).every((row) => row.studentId === studentUserId),
      progressLeak,
    )

    const attPresentToAbsent = await tutor.req('PATCH', `/api/attendance/session/${sessionId}/student/${studentUserId}`, {
      body: { status: 'absent' },
    })
    check(
      'Tutor can change present to absent without a note',
      attPresentToAbsent.status === 200 && attPresentToAbsent.data?.attendance?.status === 'absent',
      attPresentToAbsent,
    )
    const attCorrect = await tutor.req('PATCH', `/api/attendance/session/${sessionId}/student/${studentUserId}`, {
      body: { status: 'excused', note: 'Medical appointment' },
    })
    check(
      'Attendance correction with note is audited',
      attCorrect.status === 200 &&
        attCorrect.data?.attendance?.status === 'excused' &&
        Array.isArray(attCorrect.data?.attendance?.corrections) &&
        attCorrect.data.attendance.corrections.length >= 1,
      attCorrect,
    )
    const parentForeignAtt = await parent.req('GET', '/api/attendance/student/USR-NOPE')
    check('Parent cannot read unrelated student attendance -> 403', parentForeignAtt.status === 403, parentForeignAtt)

    const oneOffDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const oneOff = await tutor.req('POST', '/api/sessions', {
      body: { batchId, topic: 'Protected one-off session', date: oneOffDate.toISOString() },
    })
    check('Manual session is created as one-off', oneOff.status === 201 && oneOff.data?.session?.oneOff === true, oneOff)
    await tutor.req('POST', `/api/batches/${batchId}/regenerate-sessions`)
    const afterOneOffRegen = await tutor.req('GET', `/api/sessions/batch/${batchId}`)
    check(
      'One-off session survives regeneration',
      afterOneOffRegen.status === 200 &&
        (afterOneOffRegen.data?.sessions ?? []).some((session) => session._id === oneOff.data?.session?._id),
      afterOneOffRegen,
    )

    // Archive / unarchive student
    const archStu = await tutor.req('POST', `/api/users/${studentUserId}/archive`)
    check('Tutor archives student -> 200', archStu.status === 200, archStu)
    const archivedMe = await student.req('GET', '/api/auth/me')
    check('Archived student API access blocked -> 401/403', [401, 403].includes(archivedMe.status), archivedMe)
    const archivedLogin = await anon.req('POST', '/api/auth/login', {
      body: { email: STUDENT_EMAIL, password: STUDENT_PASS },
    })
    check('Archived student login blocked -> 403', archivedLogin.status === 403, archivedLogin)
    const unarch = await tutor.req('POST', `/api/users/${studentUserId}/unarchive`)
    check('Tutor unarchives student -> 200', unarch.status === 200, unarch)
    const restoredLogin = await student.req('POST', '/api/auth/login', {
      body: { email: STUDENT_EMAIL, password: STUDENT_PASS },
    })
    check('Unarchived student can log in again', restoredLogin.status === 200, restoredLogin)

    // Student search now works within their circle
    const stuSearch = await student.req('GET', `/api/users/search?q=${encodeURIComponent(String(tutorName).slice(0, 8))}`)
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
