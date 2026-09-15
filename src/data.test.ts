import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { classifyRole, normalizeProfileUrl, parseLinkedInArchive } from './data'

function archiveBuffer() {
  const files = {
    'Connections.csv': strToU8([
      'Notes:',
      '"Email addresses depend on member settings."',
      '',
      'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
      'Ada,Lovelace,https://www.linkedin.com/in/ada/?trk=export,,Analytical Engines,Founder & CEO,10 Sep 2026',
      'Grace,Hopper,https://linkedin.com/in/grace,,Navy,Rear Admiral,01 Jan 2020',
      ',,,,,,02 Feb 2019',
    ].join('\n')),
    'Profile.csv': strToU8('First Name,Last Name,Geo Location\nAlex,Example,Dubai'),
    'messages.csv': strToU8([
      'CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,RECIPIENT PROFILE URLS,DATE,SUBJECT,CONTENT,FOLDER,ATTACHMENTS',
      'c1,Hello,Alex Example,https://linkedin.com/in/alex,Ada Lovelace,https://www.linkedin.com/in/ada,2026-09-01 10:00:00 UTC,,Hello,INBOX,',
      'c1,Hello,Ada Lovelace,www.linkedin.com/in/ada,Alex Example,https://linkedin.com/in/alex,2026-09-01 11:00:00 UTC,,Hi,INBOX,',
    ].join('\n')),
  }
  const zipped = zipSync(files)
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer
}

describe('LinkedIn archive parser', () => {
  it('normalizes profile URLs', () => {
    expect(normalizeProfileUrl('https://www.LinkedIn.com/in/Ada/?trk=export')).toBe('linkedin.com/in/ada')
  })

  it('classifies combined titles as multiple roles', () => {
    expect(classifyRole('Co-Founder & Chief Executive Officer')).toEqual(['Founder', 'CEO', 'C-suite'])
  })

  it('joins two-way conversations by canonical profile URL', async () => {
    const data = await parseLinkedInArchive(archiveBuffer())
    expect(data.connections).toHaveLength(3)
    expect(data.unavailableConnectionCount).toBe(1)
    expect(data.messageCount).toBe(2)
    expect(data.statsByPerson.get('linkedin.com/in/ada')).toMatchObject({
      status: 'two-way',
      sentCount: 1,
      receivedCount: 1,
    })
    expect(data.statsByPerson.get('linkedin.com/in/grace')?.status).toBe('none')
  })
})
