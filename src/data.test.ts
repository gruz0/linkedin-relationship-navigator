import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  classifyRole,
  conversationCountsFor,
  matchesRoleFilters,
  normalizeProfileUrl,
  parseLinkedInArchive,
} from './data'

function archiveBuffer() {
  const files = {
    'Connections.csv': strToU8(
      [
        'Notes:',
        '"Email addresses depend on member settings."',
        '',
        'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
        'Ada,Lovelace,https://www.linkedin.com/in/ada/?trk=export,,Analytical Engines,Founder & CEO,10 Sep 2026',
        'Grace,Hopper,https://linkedin.com/in/grace,,Navy,Rear Admiral,01 Jan 2020',
        ',,,,,,02 Feb 2019',
      ].join('\n'),
    ),
    'Profile.csv': strToU8('First Name,Last Name,Geo Location\nAlex,Example,Dubai'),
    'messages.csv': strToU8(
      [
        'CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,RECIPIENT PROFILE URLS,DATE,SUBJECT,CONTENT,FOLDER,ATTACHMENTS',
        'c1,Hello,Alex Example,https://linkedin.com/in/alex,Ada Lovelace,https://www.linkedin.com/in/ada,2026-09-01 10:00:00 UTC,,Hello,INBOX,',
        'c1,Hello,Ada Lovelace,www.linkedin.com/in/ada,Alex Example,https://linkedin.com/in/alex,2026-09-01 11:00:00 UTC,,Hi,INBOX,',
      ].join('\n'),
    ),
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

  it('classifies people-function titles', () => {
    expect(classifyRole('Human Resources Generalist')).toEqual(['People & Talent'])
    expect(classifyRole('Senior Talent Partner I')).toEqual(['People & Talent'])
    expect(classifyRole('CHRO')).toEqual(['C-suite', 'People & Talent'])
  })

  it('recognizes additional executive and VP abbreviations', () => {
    expect(classifyRole('CBDO')).toEqual(['C-suite'])
    expect(classifyRole('SVP of Infrastructure')).toEqual(['VP'])
    expect(classifyRole('Executive Vice-President')).toEqual(['VP'])
  })

  it('adds functional badges to technology, product, and marketing executives', () => {
    expect(classifyRole('Chief Technology Officer')).toEqual(['C-suite', 'Engineering'])
    expect(classifyRole('CIO')).toEqual(['C-suite', 'Engineering'])
    expect(classifyRole('Chief Product Officer')).toEqual(['C-suite', 'Product'])
    expect(classifyRole('CMO')).toEqual(['C-suite', 'Marketing'])
  })

  it('leaves ambiguous leadership and founder-adjacent titles unchanged', () => {
    expect(classifyRole('Chief of Staff')).toEqual([])
    expect(classifyRole('Founding Software Engineer')).toEqual(['Engineering'])
    expect(classifyRole('Entrepreneur in Residence')).toEqual([])
  })

  it('treats Other as a derived filter for unclassified roles', () => {
    expect(matchesRoleFilters([], new Set(['Other']))).toBe(true)
    expect(matchesRoleFilters(['Founder'], new Set(['Other']))).toBe(false)
    expect(matchesRoleFilters(['Founder'], new Set(['Founder', 'Other']))).toBe(true)
    expect(matchesRoleFilters([], new Set())).toBe(true)
  })

  it('joins two-way conversations by canonical profile URL', async () => {
    const data = await parseLinkedInArchive(archiveBuffer(), 'test-export.zip')
    expect(data.sourceFileName).toBe('test-export.zip')
    expect(data.connections).toHaveLength(3)
    expect(data.unavailableConnectionCount).toBe(1)
    expect(data.messageCount).toBe(2)
    expect(data.archiveFileCount).toBe(3)
    expect(data.archiveFilesUsed).toEqual(['Connections.csv', 'messages.csv', 'Profile.csv'])
    expect(data.statsByPerson.get('linkedin.com/in/ada')).toMatchObject({
      status: 'two-way',
      sentCount: 1,
      receivedCount: 1,
    })
    expect(data.statsByPerson.get('linkedin.com/in/grace')?.status).toBe('none')
    expect(conversationCountsFor(data)).toEqual({
      all: 2,
      any: 1,
      'two-way': 1,
      outbound: 0,
      inbound: 0,
      none: 1,
    })
  })
})
