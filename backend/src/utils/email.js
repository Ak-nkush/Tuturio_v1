import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

let testAccount = null;

async function getTransporter() {
  if (env.isDev) {
    if (!testAccount) {
      testAccount = await nodemailer.createTestAccount();
    }
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  // TODO: Configure production transporter (e.g. Resend, SendGrid)
  return null;
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function sendPasswordResetEmail(email, resetUrl) {
  const transporter = await getTransporter()
  if (env.isDev && transporter) {
    const info = await transporter.sendMail({
      from: '"Tuturio" <noreply@tuturio.local>',
      to: email,
      subject: 'Reset your password',
      text: `Please reset your password by clicking here: ${resetUrl}`,
      html: `<p>Please reset your password by clicking here: <a href="${resetUrl}">${resetUrl}</a></p>`,
    })
    console.log('\n[DEV] Password reset link for', email)
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info), '\n')
    return
  }

  console.log('[EMAIL STUB] Reset link would be sent to', email)
}

export async function sendInviteEmail(email, role, inviteUrl, batchName) {
  const transporter = await getTransporter()
  
  const subject = `You've been invited to join ${batchName} on Tuturio`
  const text = `Hello! You've been invited to join the batch "${batchName}" as a ${role}. Click here to join: ${inviteUrl}`
  const html = `
    <h2>Welcome to Tuturio!</h2>
    <p>You've been invited to join the batch <strong>${batchName}</strong> as a <strong>${role}</strong>.</p>
    <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
  `

  if (env.isDev && transporter) {
    const info = await transporter.sendMail({
      from: '"Tuturio" <noreply@tuturio.local>',
      to: email,
      subject,
      text,
      html,
    })
    console.log(`\n[DEV] Invite email sent to ${email} (${role})`)
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info), '\n')
    return
  }

  console.log(`[EMAIL STUB] Invite link for ${email} (${role}): ${inviteUrl}`)
}
