import dotenv from 'dotenv'
import { connectDb } from '../db/connect.js'
import { ensureDemoData } from '../db/ensureDemoData.js'

dotenv.config()

async function main() {
  await connectDb()
  await ensureDemoData({ force: true })
  console.log('\n=============================================')
  console.log('🎉 FULL REALISTIC DEMO DATASET READY!')
  console.log('=============================================')
  console.log('SOLE TUTOR:')
  console.log('  Name: Meera Joshi')
  console.log('  Email: tutor@tuturio.local')
  console.log('  Password: Password123!')
  console.log('  Batches: 3 Batches (Grade 10 ICSE, Grade 9 CBSE, Grade 11 JEE)')
  console.log('\nPARENT (Multi-Child Switcher):')
  console.log('  Email: ankushvijaymahadole@gmail.com')
  console.log('  Password: Password123!')
  console.log('  Linked Children: 2 (Child 1 in Grade 10 & Child 2 in Grade 9)')
  console.log('\nSTUDENT 1 (Child 1 - Grade 10):')
  console.log('  Email: 01ankush.mahadole@gmail.com')
  console.log('  Password: Password123!')
  console.log('\nSTUDENT 2 (Child 2 - Sibling in Grade 9):')
  console.log('  Email: rohan.mahadole@tuturio.local')
  console.log('  Password: Password123!')
  console.log('=============================================\n')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
