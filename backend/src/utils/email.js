import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

function smtpConfigured() {
  const host = String(env.smtpHost ?? '').trim()
  const user = String(env.smtpUser ?? '').trim()
  const pass = String(env.smtpPassword ?? '').trim()
  if (!host || !user || !pass) return false
  const blob = `${host} ${user} ${pass}`
  if (/smtp\.example\.com|your-smtp-username|your-smtp-password|noreply@example\.com/i.test(blob)) {
    return false
  }
  return true
}

function fromAddress() {
  const from = String(env.emailFrom ?? '').trim()
  if (from && !/example\.com|tuturio\.local/i.test(from)) return from
  return `Tuturio <${env.smtpUser}>`
}

function smtpSetupError() {
  return new Error(
    'Email is not set up yet. In backend/.env set SMTP_HOST=smtp.gmail.com, SMTP_USER to your Gmail address, and SMTP_PASSWORD to a Gmail App Password (Google Account → Security → 2-Step Verification → App passwords). Restart the API after saving.',
  )
}

export function isSmtpConfigured() {
  return smtpConfigured()
}

async function getTransporter() {
  if (!smtpConfigured()) throw smtpSetupError()

  return nodemailer.createTransport({
    host: env.smtpHost.trim(),
    port: env.smtpPort || 587,
    secure: env.smtpPort === 465 || env.smtpSecure,
    auth: {
      user: env.smtpUser.trim(),
      pass: env.smtpPassword.replace(/\s+/g, ''),
    },
  })
}

function describeMailError(err) {
  const text = `${err?.response ?? ''} ${err?.message ?? ''}`
  if (/Invalid login|EAUTH|535/i.test(text)) {
    return 'Gmail rejected the login. Use a Gmail App Password, not your normal Gmail password, and make sure 2-Step Verification is on.'
  }
  if (/EENVELOPE|from address/i.test(text)) {
    return 'Gmail requires EMAIL_FROM to be the same Gmail address as SMTP_USER.'
  }
  return err?.message || 'Failed to send email'
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function sendPasswordResetEmail(email, resetUrl) {
  const transporter = await getTransporter()
  try {
    const info = await transporter.sendMail({
      from: fromAddress(),
      to: email,
      subject: 'Reset your Tuturio password',
      text: `Reset your password: ${resetUrl}`,
      html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    })
    console.log(`Password reset email sent to ${email}, messageId: ${info.messageId}`)
  } catch (err) {
    throw new Error(describeMailError(err))
  }
}

export async function sendInviteEmail(email, role, inviteUrl, batchName) {
  const transporter = await getTransporter()
  const subject = `You're invited to join ${batchName} on Tuturio`
  const text = `You've been invited to join "${batchName}" as a ${role}. Open this link to join: ${inviteUrl}`
  const html = `
    <div style="font-family:Georgia,serif;line-height:1.5;color:#19332D">
      <h2>You're invited to Tuturio</h2>
      <p>Join the batch <strong>${batchName}</strong> as a <strong>${role}</strong>.</p>
      <p><a href="${inviteUrl}">Accept the invitation</a></p>
      <p style="color:#667">If the button does not work, paste this link into your browser:<br>${inviteUrl}</p>
    </div>
  `

  try {
    const info = await transporter.sendMail({
      from: fromAddress(),
      to: email,
      subject,
      text,
      html,
    })
    console.log(`Invite email sent to ${email} (${role}), messageId: ${info.messageId}`)
  } catch (err) {
    throw new Error(describeMailError(err))
  }
}
