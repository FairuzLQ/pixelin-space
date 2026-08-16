// Lightweight profanity filter (Indonesian + English) used server-side on
// user content and nicknames. It is a moderation aid, not a guarantee — the
// admin block/delete tools remain the backstop.
//
// Behaviour:
//   - content (posts/comments/DMs): matched words are masked with '*'
//   - nicknames: rejected outright if they contain a listed word
// Matching is case-insensitive and word-boundary based (so normal words that
// merely contain a fragment, e.g. "assassin", are not falsely censored).

const INDONESIAN = [
  'anjing', 'anjg', 'anjeng', 'ajg', 'asu', 'asw',
  'bangsat', 'bajingan', 'bangke', 'bangsad',
  'kontol', 'kntl', 'kontl', 'kimak', 'kimac', 'pukimak', 'pukima',
  'memek', 'mmk', 'pepek', 'pepe', 'tempek', 'henceut',
  'ngentot', 'ngntd', 'ngentd', 'entot', 'ngewe', 'ewe', 'coli', 'colmek',
  'tai', 'taik', 'taek', 'tolol', 'goblok', 'goblog', 'bego', 'bangsat',
  'jancok', 'jancuk', 'cok', 'cuk', 'diancok', 'jembut', 'jmbt',
  'babi', 'lonte', 'sundal', 'pelacur', 'pecun', 'jablay',
  'bencong', 'banci', 'homo', 'lgbt',
  'pantek', 'pantat', 'silit', 'peler', 'pler', 'titit', 'kutang',
  'ngaceng', 'coki', 'itil',
]

const ENGLISH = [
  'fuck', 'fucker', 'fucking', 'fuk', 'fck', 'motherfucker', 'mf',
  'shit', 'shite', 'bullshit', 'crap',
  'bitch', 'biatch', 'asshole', 'ass', 'arse', 'jackass',
  'bastard', 'dick', 'dickhead', 'cock', 'prick',
  'pussy', 'cunt', 'twat', 'wanker',
  'slut', 'whore', 'hoe', 'skank',
  'nigger', 'nigga', 'niggah', 'faggot', 'fag', 'retard', 'retarded',
  'jerk', 'douche', 'dildo', 'boobs', 'coon',
]

const WORDS = [...INDONESIAN, ...ENGLISH]

function escape(w: string) {
  return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const PATTERN = `\\b(?:${WORDS.map(escape).join('|')})\\b`

/** Mask any profane words in free text with asterisks. Safe on null/empty. */
export function censorText<T extends string | null | undefined>(text: T): T {
  if (!text) return text
  const re = new RegExp(PATTERN, 'gi')
  return text.replace(re, (m) => '*'.repeat(m.length)) as T
}

/** True if the text contains a listed profane word (used to reject nicknames). */
export function hasProfanity(text: string | null | undefined): boolean {
  if (!text) return false
  return new RegExp(PATTERN, 'i').test(text)
}
